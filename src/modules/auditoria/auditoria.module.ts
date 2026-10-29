import { Module } from '@nestjs/common';
import { AuditoriaService } from './application/services/auditoria.service.js';
import { HISTORICO_AUDITORIA_REPOSITORY } from './domain/repositories/historico-auditoria.repository.interface.js';
import { PrismaHistoricoAuditoriaRepository } from './infra/repositories/prisma-historico-auditoria.repository.js';
@Module({
  providers: [
    AuditoriaService,
    {
      provide: HISTORICO_AUDITORIA_REPOSITORY,
      useClass: PrismaHistoricoAuditoriaRepository,
    },
  ],
  exports: [AuditoriaService],
})
export class AuditoriaModule {}
