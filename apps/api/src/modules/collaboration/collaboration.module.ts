import { Module } from '@nestjs/common';
import { CommentsController, SignoffsController } from './collaboration.controller';
import { CommentsService } from './comments.service';
import { SignoffsService } from './signoffs.service';

@Module({
  controllers: [CommentsController, SignoffsController],
  providers: [CommentsService, SignoffsService],
})
export class CollaborationModule {}
