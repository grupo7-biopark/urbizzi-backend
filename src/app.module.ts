import { AuditoriaModule } from './modules/auditoria/auditoria.module.js';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validate } from './config/env.validation.js';
import { PrismaModule } from './shared/infra/database/prisma.module.js';
import { HealthModule } from './shared/infra/health/health.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true, validate }),
    PrismaModule,
    HealthModule,
    AuditoriaModule,
    // Módulos de domínio (src/modules/<modulo>/<modulo>.module.ts) entram aqui.
  ],
})
export class AppModule {}
