import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import {
  ALLOWED_FILE_TYPES,
  atLeast,
  fileExtension,
  fileProblem,
  WORKSPACE_FILE_BYTES,
  type FileSummary,
} from '@skillflow/shared';
import type { AuthUser, WorkspaceAccess } from '../../common/request';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestsService } from './requests.service';

/** What the upload route hands over. Matches multer's in-memory file. */
export interface UploadedFileData {
  originalname: string;
  size: number;
  buffer: Buffer;
}

/**
 * Checks the first bytes match the extension, so a renamed program cannot pass as a PDF.
 * Text formats must not contain NUL bytes, which binaries always do.
 */
export function contentMatches(extension: string, data: Buffer): boolean {
  const starts = (...bytes: number[]) => bytes.every((b, i) => data[i] === b);
  switch (extension) {
    case 'pdf':
      return starts(0x25, 0x50, 0x44, 0x46); // %PDF
    case 'png':
      return starts(0x89, 0x50, 0x4e, 0x47);
    case 'jpg':
    case 'jpeg':
      return starts(0xff, 0xd8, 0xff);
    case 'gif':
      return starts(0x47, 0x49, 0x46, 0x38);
    case 'webp':
      return starts(0x52, 0x49, 0x46, 0x46) && data.subarray(8, 12).toString('ascii') === 'WEBP';
    case 'docx':
    case 'xlsx':
    case 'pptx':
      return starts(0x50, 0x4b, 0x03, 0x04); // zip
    case 'doc':
    case 'xls':
    case 'ppt':
      return starts(0xd0, 0xcf, 0x11, 0xe0); // old Office
    case 'csv':
    case 'txt':
      return !data.subarray(0, 4096).includes(0);
    default:
      return false;
  }
}

/** Keeps a name safe to show and to send back in a download header. */
export function cleanFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? 'file';
  // Drop control characters and quotes, which could break the download header.
  const safe = [...base].filter((ch) => ch.charCodeAt(0) > 31 && ch.charCodeAt(0) !== 127 && ch !== '"').join('');
  return safe.trim().slice(0, 180) || 'file';
}

@Injectable()
export class FilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requests: RequestsService,
  ) {}

  async upload(
    access: WorkspaceAccess,
    user: AuthUser,
    requestId: string,
    file: UploadedFileData | undefined,
    requestInputId: string | null,
  ): Promise<FileSummary> {
    if (!file) throw new BadRequestException('Choose a file to attach');
    const db = this.prisma.forWorkspace(access.workspaceId);
    const request = await this.requests.load(db, requestId);
    this.requests.assertCanEdit(access, user, request);

    const name = cleanFileName(file.originalname);
    const problem = fileProblem({ name, size: file.size });
    if (problem) throw new BadRequestException(problem);
    const extension = fileExtension(name);
    if (!contentMatches(extension, file.buffer)) {
      throw new BadRequestException(`This file does not look like a real .${extension} file.`);
    }
    if (requestInputId && !request.inputs.some((i) => i.id === requestInputId)) {
      throw new BadRequestException('Save the form first, then attach the file to that item.');
    }

    const used = await db.storedFile.aggregate({ _sum: { size: true } });
    if ((used._sum.size ?? 0) + file.size > WORKSPACE_FILE_BYTES) {
      throw new PayloadTooLargeException('This workspace has used its 100 MB of file storage. Remove old files first.');
    }

    const saved = await db.storedFile.create({
      data: {
        workspaceId: access.workspaceId,
        requestId,
        requestInputId,
        name,
        // The type comes from our list, never from the browser.
        mimeType: ALLOWED_FILE_TYPES[extension],
        size: file.size,
        data: new Uint8Array(file.buffer),
        uploadedById: user.id,
      },
      select: { id: true, name: true, mimeType: true, size: true, requestInputId: true, createdAt: true },
    });
    const uploader = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { name: true } });
    return { ...saved, uploadedBy: uploader.name, createdAt: saved.createdAt.toISOString() };
  }

  /** The only place file contents are read. */
  async download(access: WorkspaceAccess, fileId: string) {
    const file = await this.prisma.forWorkspace(access.workspaceId).storedFile.findFirst({
      where: { id: fileId, request: { archivedAt: null } },
      select: { name: true, mimeType: true, data: true },
    });
    if (!file) throw new NotFoundException('File not found');
    return file;
  }

  async remove(access: WorkspaceAccess, user: AuthUser, fileId: string): Promise<void> {
    const db = this.prisma.forWorkspace(access.workspaceId);
    const file = await db.storedFile.findFirst({ where: { id: fileId }, select: { id: true, uploadedById: true } });
    if (!file) throw new NotFoundException('File not found');
    if (file.uploadedById !== user.id && !atLeast(access.level, 'editor')) {
      throw new ForbiddenException('Only the person who attached it or an editor can remove it');
    }
    await db.storedFile.delete({ where: { id: fileId } });
  }
}
