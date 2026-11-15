import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ReadyInput, ReadyService } from './ready.service';

@Controller('ready')
export class ReadyController {
  constructor(private readonly ready: ReadyService) {}

  @Get(':desk')
  list(@Param('desk') desk: string, @Query('all') all?: string) {
    return this.ready.list(desk, all === 'true');
  }

  @Get(':desk/recently-posted')
  recent(@Param('desk') desk: string) {
    return this.ready.recentlyPosted(desk);
  }

  @Post(':desk/sync')
  sync(@Param('desk') desk: string, @Body() body: { today: string; posts: ReadyInput[]; drops?: Array<{ id: string; itemIds: string[]; dropped: Array<{ id: string; title: string; why: string; at: string }> }>; keepPeriods?: string[] }) {
    return this.ready.sync(desk, body);
  }

  @Patch('post/:id')
  update(@Param('id') id: string, @Body() body: Partial<ReadyInput> & { status?: string; permalink?: string | null }) {
    return this.ready.update(id, body);
  }

  @Post('post/:id/reset')
  reset(@Param('id') id: string) {
    return this.ready.reset(id);
  }
}
