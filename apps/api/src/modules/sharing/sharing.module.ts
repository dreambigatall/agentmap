import { Module } from '@nestjs/common';
import { PublicShareController, SharingController } from './sharing.controller';
import { SharingService } from './sharing.service';

@Module({
  controllers: [SharingController, PublicShareController],
  providers: [SharingService],
})
export class SharingModule {}
