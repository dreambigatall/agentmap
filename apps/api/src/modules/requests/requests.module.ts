import { Module } from '@nestjs/common';
import { FilesService } from './files.service';
import { RequestsController } from './requests.controller';
import { RequestsService } from './requests.service';

@Module({
  controllers: [RequestsController],
  providers: [RequestsService, FilesService],
  exports: [RequestsService],
})
export class RequestsModule {}
