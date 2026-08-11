import { Controller, Get, Post, Patch, Body, Param } from '@nestjs/common';
import { SettingsService } from './settings.service';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('voice')
  getVoiceProfiles() {
    return this.settingsService.getVoiceProfiles();
  }

  @Post('voice')
  createVoiceProfile(@Body() body: any) {
    return this.settingsService.createVoiceProfile(body);
  }

  @Patch('voice/:id/active')
  setActiveVoiceProfile(@Param('id') id: string) {
    return this.settingsService.setActiveVoiceProfile(id);
  }

  @Get('voice/active')
  getActiveVoiceProfile() {
    return this.settingsService.getActiveVoiceProfile();
  }
}
