import { Module } from '@nestjs/common';
import { AgentsController } from './agents.controller';
import { AgentsService } from './agents.service';
import { TemplatesService } from './templates.service';

@Module({
  controllers: [AgentsController],
  providers: [AgentsService, TemplatesService],
})
export class AgentsModule {}
