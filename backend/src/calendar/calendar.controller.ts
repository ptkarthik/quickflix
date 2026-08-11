import { Controller, Get, Post, Body, Param, Put, Delete, Patch } from '@nestjs/common';
import { CalendarService } from './calendar.service';

@Controller('calendar')
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Post()
  async create(@Body() body: {
    projectId: string;
    title: string;
    contentType: string;
    contentId?: string;
    assetId?: string;
    scheduledFor: string;
    platform: string;
    notes?: string;
  }) {
    return this.calendarService.createSchedule({
      ...body,
      scheduledFor: new Date(body.scheduledFor)
    });
  }

  @Get()
  async findAll() {
    return this.calendarService.getAllSchedules();
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: string
  ) {
    return this.calendarService.updateStatus(id, status);
  }
}
