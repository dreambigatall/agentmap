import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiNoContentResponse, ApiOkResponse, ApiProduces, ApiTags } from '@nestjs/swagger';
import {
  convertRequestSchema,
  createRequestSchema,
  fileSummarySchema,
  MAX_FILE_BYTES,
  requestDetailSchema,
  requestStatusChangeSchema,
  requestSummarySchema,
  saveRequestSchema,
  skillDetailSchema,
} from '@skillflow/shared';
import type { Response } from 'express';
import { createZodDto, ZodResponse } from 'nestjs-zod';
import { z } from 'zod';
import { UUID_PATTERN } from '../../common/crypto';
import { CurrentUser, CurrentWorkspace, MinLevel } from '../../common/decorators';
import type { AuthUser, WorkspaceAccess } from '../../common/request';
import { WorkspaceGuard } from '../../common/workspace.guard';
import { FilesService, type UploadedFileData } from './files.service';
import { RequestsService } from './requests.service';

export class CreateRequestDto extends createZodDto(createRequestSchema) {}
export class SaveRequestDto extends createZodDto(saveRequestSchema) {}
export class RequestStatusDto extends createZodDto(requestStatusChangeSchema) {}
export class ConvertRequestDto extends createZodDto(convertRequestSchema) {}
export class RequestSummaryDto extends createZodDto(requestSummarySchema) {}
export class RequestDetailDto extends createZodDto(requestDetailSchema) {}
export class FileSummaryDto extends createZodDto(fileSummarySchema) {}
export class ConvertedSkillDto extends createZodDto(skillDetailSchema) {}
export class ListRequestsQuery extends createZodDto(z.object({ agentId: z.string().uuid().optional() })) {}

@ApiTags('requests')
@UseGuards(WorkspaceGuard)
@Controller('w/:workspaceId')
export class RequestsController {
  constructor(
    private readonly requests: RequestsService,
    private readonly files: FilesService,
  ) {}

  @Get('requests')
  @ZodResponse({ type: [RequestSummaryDto] })
  list(@Param('workspaceId') _id: string, @CurrentWorkspace() access: WorkspaceAccess, @Query() query: ListRequestsQuery) {
    return this.requests.list(access, query.agentId);
  }

  /** Every member may submit a request; reviewers included. */
  @Post('requests')
  @ZodResponse({ status: 201, type: RequestDetailDto })
  create(
    @Param('workspaceId') _id: string,
    @CurrentWorkspace() access: WorkspaceAccess,
    @CurrentUser() user: AuthUser,
    @Body() body: CreateRequestDto,
  ) {
    return this.requests.create(access, user, body);
  }

  @Get('requests/:requestId')
  @ZodResponse({ type: RequestDetailDto })
  get(
    @Param('workspaceId') _id: string,
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @CurrentWorkspace() access: WorkspaceAccess,
  ) {
    return this.requests.get(access, requestId);
  }

  /** The author or an editor, until the request is decided. Checked in the service. */
  @Put('requests/:requestId')
  @ZodResponse({ type: RequestDetailDto })
  save(
    @Param('workspaceId') _id: string,
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @CurrentWorkspace() access: WorkspaceAccess,
    @CurrentUser() user: AuthUser,
    @Body() body: SaveRequestDto,
  ) {
    return this.requests.save(access, user, requestId, body);
  }

  @Post('requests/:requestId/status')
  @MinLevel('editor')
  @ZodResponse({ status: 200, type: RequestDetailDto })
  changeStatus(
    @Param('workspaceId') _id: string,
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @CurrentWorkspace() access: WorkspaceAccess,
    @CurrentUser() user: AuthUser,
    @Body() body: RequestStatusDto,
  ) {
    return this.requests.changeStatus(access, user, requestId, body);
  }

  @Post('requests/:requestId/convert')
  @MinLevel('editor')
  @ZodResponse({ status: 201, type: ConvertedSkillDto })
  convert(
    @Param('workspaceId') _id: string,
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @CurrentWorkspace() access: WorkspaceAccess,
    @CurrentUser() user: AuthUser,
    @Body() body: ConvertRequestDto,
  ) {
    return this.requests.convert(access, user, requestId, body);
  }

  @Delete('requests/:requestId')
  @HttpCode(204)
  @ApiNoContentResponse()
  archive(
    @Param('workspaceId') _id: string,
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @CurrentWorkspace() access: WorkspaceAccess,
    @CurrentUser() user: AuthUser,
  ): Promise<void> {
    return this.requests.archive(access, user, requestId);
  }

  @Post('requests/:requestId/files')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_FILE_BYTES, files: 1 } }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
        requestInputId: { type: 'string', format: 'uuid' },
      },
    },
  })
  @ZodResponse({ status: 201, type: FileSummaryDto })
  upload(
    @Param('workspaceId') _id: string,
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @CurrentWorkspace() access: WorkspaceAccess,
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: UploadedFileData | undefined,
    @Body('requestInputId') requestInputId?: string,
  ) {
    if (requestInputId && !UUID_PATTERN.test(requestInputId)) {
      throw new BadRequestException('requestInputId must be an id');
    }
    return this.files.upload(access, user, requestId, file, requestInputId || null);
  }

  /** Always a download, never shown inline, so an uploaded file can never run as a page. */
  @Get('files/:fileId')
  @ApiProduces('application/octet-stream')
  @ApiOkResponse({ description: 'The file' })
  async download(
    @Param('workspaceId') _id: string,
    @Param('fileId', ParseUUIDPipe) fileId: string,
    @CurrentWorkspace() access: WorkspaceAccess,
    @Res() res: Response,
  ): Promise<void> {
    const file = await this.files.download(access, fileId);
    res.set({
      'Content-Type': file.mimeType,
      'Content-Length': String(file.data.length),
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
      'Content-Security-Policy': "default-src 'none'",
    });
    res.end(Buffer.from(file.data));
  }

  @Delete('files/:fileId')
  @HttpCode(204)
  @ApiNoContentResponse()
  removeFile(
    @Param('workspaceId') _id: string,
    @Param('fileId', ParseUUIDPipe) fileId: string,
    @CurrentWorkspace() access: WorkspaceAccess,
    @CurrentUser() user: AuthUser,
  ): Promise<void> {
    return this.files.remove(access, user, fileId);
  }
}
