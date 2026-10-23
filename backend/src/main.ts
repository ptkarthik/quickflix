import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as dns from 'node:dns';

// Fix undici fetch failed on Windows IPv6 and Antivirus SSL interception
dns.setDefaultResultOrder('ipv4first');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
// Trigger restart to load new .env variables 3
