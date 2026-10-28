import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module.js';
import { setupApp } from './app.setup.js';
import type { Env } from './config/env.validation.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  setupApp(app);

  const configService = app.get<ConfigService<Env, true>>(ConfigService);
  await app.listen(configService.get('PORT', { infer: true }));
}
await bootstrap();
