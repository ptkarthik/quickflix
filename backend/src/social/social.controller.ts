import { Controller, Get, Post, Body, Param, Patch } from '@nestjs/common';
import { SocialService } from './social.service';
import { PublishingService } from './publishing.service';

@Controller()
export class SocialController {
  constructor(
    private readonly socialService: SocialService,
    private readonly publishingService: PublishingService
  ) {}

  // Social Account Endpoints
  @Get('social/accounts')
  getAccounts() {
    return this.socialService.getAccounts();
  }

  @Post('social/mock-connect')
  mockConnect(@Body() body: { platform: string; accountName: string }) {
    return this.socialService.mockConnect(body.platform, body.accountName);
  }

  // Publishing Endpoints
  @Post('calendar/:id/publish')
  publish(@Param('id') id: string) {
    // Fire and forget (don't await) so the UI can poll state, or await if we want synchronous response.
    // Given the architecture, since we have PUBLISHING state, we can return immediately or await.
    // Let's await for simplicity in the UI, but it takes 2.5s.
    return this.publishingService.publishSchedule(id);
  }
}
