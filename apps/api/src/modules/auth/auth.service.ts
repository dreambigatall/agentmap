import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { hash, verify } from '@node-rs/argon2';
import type { AuthTokenType } from '@prisma/client';
import type {
  ForgotPasswordInput,
  Me,
  ResetPasswordInput,
  SignInInput,
  SignUpInput,
} from '@skillflow/shared';
import { randomToken, sha256 } from '../../common/crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { InviteAcceptance } from '../workspaces/invite-acceptance.service';
import { SessionService, type SessionTokens } from './session.service';

const VERIFY_TTL_MS = 48 * 60 * 60 * 1000;
const RESET_TTL_MS = 60 * 60 * 1000;

export interface SignedIn {
  userId: string;
  tokens: SessionTokens;
}

@Injectable()
export class AuthService {
  /** Checked against when the email is unknown, so a wrong email and a wrong password take as long. */
  private readonly dummyHash = hash('not-a-real-password-just-for-timing');

  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
    private readonly mail: MailService,
    private readonly invites: InviteAcceptance,
  ) {}

  async signUp(input: SignUpInput, userAgent?: string): Promise<SignedIn> {
    const existing = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw new ConflictException('An account with this email already exists. Sign in instead.');
    }

    // Signing up from an invite sent to this address proves the person owns it.
    const invite = input.inviteToken
      ? await this.invites.findUsable(input.inviteToken, input.email)
      : null;

    const user = await this.prisma.user.create({
      data: {
        email: input.email,
        name: input.name,
        passwordHash: await hash(input.password),
        emailVerifiedAt: invite ? new Date() : null,
      },
    });

    if (invite) {
      await this.invites.accept(user.id, user.email, input.inviteToken!);
    } else {
      await this.sendVerification(user.id);
    }
    return { userId: user.id, tokens: await this.sessions.issue(user.id, userAgent) };
  }

  async signIn(input: SignInInput, userAgent?: string): Promise<SignedIn> {
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    const storedHash = user?.passwordHash ?? (await this.dummyHash);
    const valid = await verify(storedHash, input.password).catch(() => false);
    if (!user || !user.passwordHash || !valid) {
      throw new UnauthorizedException('Email or password is not correct');
    }
    return { userId: user.id, tokens: await this.sessions.issue(user.id, userAgent) };
  }

  async me(userId: string): Promise<Me> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        memberships: { include: { workspace: true }, orderBy: { createdAt: 'asc' } },
      },
    });
    if (!user) throw new UnauthorizedException('Sign in to continue');
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      emailVerified: user.emailVerifiedAt !== null,
      workspaces: user.memberships.map((m) => ({
        id: m.workspace.id,
        name: m.workspace.name,
        slug: m.workspace.slug,
        level: m.level,
      })),
    };
  }

  async sendVerification(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Account not found');
    if (user.emailVerifiedAt) return;

    const token = await this.createToken(user.id, 'email_verification', VERIFY_TTL_MS);
    const link = this.mail.link(`/verify-email?token=${token}`);
    await this.mail.send({
      to: user.email,
      subject: 'Confirm your email for Skillflow',
      text: `Hi ${user.name},\n\nConfirm your email address to start inviting your team:\n${link}\n\nThe link works for 48 hours.`,
      link,
    });
  }

  async verifyEmail(token: string): Promise<void> {
    const stored = await this.useToken(token, 'email_verification');
    await this.prisma.user.update({
      where: { id: stored.userId },
      data: { emailVerifiedAt: new Date() },
    });
  }

  /** Always succeeds, so the answer never reveals whether an account exists. */
  async forgotPassword(input: ForgotPasswordInput): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (!user) return;

    const token = await this.createToken(user.id, 'password_reset', RESET_TTL_MS);
    const link = this.mail.link(`/reset-password?token=${token}`);
    await this.mail.send({
      to: user.email,
      subject: 'Reset your Skillflow password',
      text: `Hi ${user.name},\n\nUse this link to choose a new password:\n${link}\n\nThe link works for 1 hour. If you did not ask for this, ignore this email.`,
      link,
    });
  }

  async resetPassword(input: ResetPasswordInput): Promise<void> {
    const stored = await this.useToken(input.token, 'password_reset');
    await this.prisma.user.update({
      where: { id: stored.userId },
      // The reset link reached their inbox, so the address is confirmed too.
      data: { passwordHash: await hash(input.password), emailVerifiedAt: new Date() },
    });
    await this.sessions.endAllForUser(stored.userId);
  }

  private async createToken(userId: string, type: AuthTokenType, ttlMs: number): Promise<string> {
    const token = randomToken();
    await this.prisma.$transaction([
      // A new link replaces any earlier unused one of the same kind.
      this.prisma.authToken.updateMany({
        where: { userId, type, usedAt: null },
        data: { usedAt: new Date() },
      }),
      this.prisma.authToken.create({
        data: { userId, type, tokenHash: sha256(token), expiresAt: new Date(Date.now() + ttlMs) },
      }),
    ]);
    return token;
  }

  private async useToken(token: string, type: AuthTokenType) {
    const stored = await this.prisma.authToken.findUnique({ where: { tokenHash: sha256(token) } });
    if (!stored || stored.type !== type || stored.usedAt || stored.expiresAt < new Date()) {
      throw new BadRequestException('This link has expired or was already used. Ask for a new one.');
    }
    const spent = await this.prisma.authToken.updateMany({
      where: { id: stored.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (spent.count === 0) {
      throw new BadRequestException('This link has expired or was already used. Ask for a new one.');
    }
    return stored;
  }
}
