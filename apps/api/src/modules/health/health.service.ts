import { Injectable, Logger } from '@nestjs/common';
import type { HealthResponse } from '@skillflow/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { APP_VERSION } from '../../version';

// Long enough for a first connection over a slow network; later pings reuse the connection.
const DB_TIMEOUT_MS = 10_000;

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(private readonly prisma: PrismaService) {}

  async check(): Promise<HealthResponse> {
    const databaseUp = await this.pingDatabase();
    return {
      status: databaseUp ? 'ok' : 'degraded',
      database: databaseUp ? 'up' : 'down',
      version: APP_VERSION,
      time: new Date().toISOString(),
    };
  }

  private async pingDatabase(): Promise<boolean> {
    let timer: NodeJS.Timeout | undefined;
    try {
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Database ping timed out')), DB_TIMEOUT_MS);
      });
      await Promise.race([this.prisma.$queryRaw`SELECT 1`, timeout]);
      return true;
    } catch (error) {
      const err = error as Error & { errorCode?: string };
      const firstLine = err.message
        .split('\n')
        .map((line) => line.trim())
        .find((line) => line.length > 0);
      this.logger.warn(
        `Database ping failed: ${[err.errorCode, firstLine ?? err.name].filter(Boolean).join(' ')}`,
      );
      return false;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
