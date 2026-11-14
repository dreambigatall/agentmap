import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import { ACCESS_TTL_SECONDS, REFRESH_TTL_SECONDS } from '../../common/cookies';
import { randomToken, sha256 } from '../../common/crypto';
import { PrismaService } from '../../prisma/prisma.service';

export interface SessionTokens {
  access: string;
  refresh: string;
}

/**
 * A spent refresh token presented again within this window is treated as two tabs
 * refreshing at the same moment, not as theft.
 */
const REUSE_GRACE_MS = 20_000;

/**
 * Issues and rotates sign-in sessions.
 * Access token: a 15-minute JWT holding only the user id.
 * Refresh token: random, 30 days, stored hashed, replaced on every use. Presenting a
 * spent one outside the grace window revokes every token from that sign-in.
 */
@Injectable()
export class SessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async issue(userId: string, userAgent?: string, familyId: string = randomUUID()): Promise<SessionTokens> {
    const refresh = randomToken();
    await this.prisma.refreshToken.create({
      data: {
        userId,
        familyId,
        tokenHash: sha256(refresh),
        expiresAt: new Date(Date.now() + REFRESH_TTL_SECONDS * 1000),
        userAgent: userAgent?.slice(0, 300),
      },
    });
    const access = await this.jwt.signAsync({ sub: userId }, { expiresIn: ACCESS_TTL_SECONDS });
    return { access, refresh };
  }

  async rotate(refresh: string | undefined, userAgent?: string): Promise<SessionTokens> {
    if (!refresh) throw new UnauthorizedException('Sign in to continue');

    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: sha256(refresh) },
    });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Your session has ended. Sign in again.');
    }

    if (stored.usedAt) {
      if (Date.now() - stored.usedAt.getTime() > REUSE_GRACE_MS) {
        await this.revokeFamily(stored.familyId);
        throw new UnauthorizedException('Your session has ended. Sign in again.');
      }
      return this.issue(stored.userId, userAgent, stored.familyId);
    }

    // Mark it spent. A concurrent request that loses this race lands in the grace
    // window above on its next attempt, so both tabs stay signed in.
    await this.prisma.refreshToken.updateMany({
      where: { id: stored.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    return this.issue(stored.userId, userAgent, stored.familyId);
  }

  /** Ends the sign-in the token belongs to. Unknown tokens are ignored. */
  async end(refresh: string | undefined): Promise<void> {
    if (!refresh) return;
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: sha256(refresh) },
      select: { familyId: true },
    });
    if (stored) await this.revokeFamily(stored.familyId);
  }

  /** Signs the user out everywhere, for example after a password reset. */
  async endAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async revokeFamily(familyId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
