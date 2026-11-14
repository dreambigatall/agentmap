import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../../common/decorators';
import { ApiOkResponse, ApiProperty, ApiTags } from '@nestjs/swagger';
import type { HealthResponse } from '@skillflow/shared';
import { HealthService } from './health.service';

class HealthResponseDto implements HealthResponse {
  @ApiProperty({ enum: ['ok', 'degraded'] })
  status: 'ok' | 'degraded';

  @ApiProperty({ enum: ['up', 'down'] })
  database: 'up' | 'down';

  @ApiProperty({ example: '0.1.0' })
  version: string;

  @ApiProperty({ example: '2026-11-14T12:00:00.000Z' })
  time: string;
}

@ApiTags('health')
@Public()
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  @ApiOkResponse({ type: HealthResponseDto })
  check(): Promise<HealthResponse> {
    return this.health.check();
  }
}
