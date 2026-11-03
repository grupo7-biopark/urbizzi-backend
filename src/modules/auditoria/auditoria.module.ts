import { HistoricoService } from './application/services/historico.service.js';
import { HistoricoController } from './infra/controllers/historico.controller.js';
import { HISTORICO_CONSULTA_REPOSITORY } from './domain/repositories/historico-consulta.repository.interface.js';
import { PrismaHistoricoConsultaRepository } from './infra/repositories/prisma-historico-consulta.repository.js';
import { Module } from '@nestjs/common';
import { AuditoriaService } from './application/services/auditoria.service.js';
import { HISTORICO_AUDITORIA_REPOSITORY } from './domain/repositories/historico-auditoria.repository.interface.js';
import { PrismaHistoricoAuditoriaRepository } from './infra/repositories/prisma-historico-auditoria.repository.js';
@Module({
  controllers: [HistoricoController],
  providers: [
    HistoricoService,
    {
      provide: HISTORICO_CONSULTA_REPOSITORY,
      useClass: PrismaHistoricoConsultaRepository,
    },
    AuditoriaService,
    {
      provide: HISTORICO_AUDITORIA_REPOSITORY,
      useClass: PrismaHistoricoAuditoriaRepository,
    },
  ],
  exports: [AuditoriaService],
})
export class AuditoriaModule {}
