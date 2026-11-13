import { Module } from '@nestjs/common';
import { WorldModule } from './world/world.module';
import { ExtrasModule } from './extras/extras.module';
import { ReelsModule } from './reels/reels.module';
import { PublishModule } from './publish/publish.module';
import { WatchModule } from './watch/watch.module';
import { OnThisDayModule } from './onthisday/onthisday.module';
import { GrowthModule } from './growth/growth.module';
import { TrendsModule } from './trends/trends.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { AiModule } from './ai/ai.module';
import { ProjectsModule } from './projects/projects.module';
import { AssetsModule } from './assets/assets.module';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { ResearchModule } from './research/research.module';
import { CalendarModule } from './calendar/calendar.module';
import { SettingsModule } from './settings/settings.module';
import { SocialModule } from './social/social.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { CreativeModule } from './creative/creative.module';
import { OttModule } from './ott/ott.module';
import { CinemaModule } from './cinema/cinema.module';
import { MediaModule } from './media/media.module';

@Module({
  imports: [
    PrismaModule, 
    AuthModule, 
    AiModule, 
    ProjectsModule, 
    AssetsModule,
    ResearchModule,
    CalendarModule,
    SettingsModule,
    SocialModule,
    AnalyticsModule,
    CreativeModule,
    OttModule,
    CinemaModule,
    MediaModule,
    WorldModule,
    ExtrasModule,
    ReelsModule,
    PublishModule,
    WatchModule,
    OnThisDayModule,
    GrowthModule,
    TrendsModule,
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'uploads'),
      serveRoot: '/uploads',
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
