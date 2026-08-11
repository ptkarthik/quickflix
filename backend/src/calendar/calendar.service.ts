import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CalendarService {
  constructor(private prisma: PrismaService) {}

  async createSchedule(data: {
    projectId: string;
    title: string;
    contentType: string;
    contentId?: string;
    assetId?: string;
    scheduledFor: Date;
    platform: string;
    notes?: string;
  }) {
    return this.prisma.contentSchedule.create({
      data: {
        ...data,
        status: 'SCHEDULED',
      },
    });
  }

  async getAllSchedules() {
    return this.prisma.contentSchedule.findMany({
      orderBy: { scheduledFor: 'asc' },
      include: {
        project: { select: { title: true } },
        asset: { select: { path: true, format: true, template: true } }
      }
    });
  }

  async updateStatus(id: string, status: string) {
    return this.prisma.contentSchedule.update({
      where: { id },
      data: { status },
    });
  }
}
