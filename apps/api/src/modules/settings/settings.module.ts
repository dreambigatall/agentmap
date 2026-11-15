import { Module } from '@nestjs/common';
import { ChannelsController, RolesController } from './settings.controller';
import { SettingsService } from './settings.service';

@Module({
  controllers: [RolesController, ChannelsController],
  providers: [SettingsService],
})
export class SettingsModule {}
