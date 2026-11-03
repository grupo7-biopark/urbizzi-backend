import { Module } from '@nestjs/common';
import { AuditoriaModule } from '../auditoria/auditoria.module.js';
import { LoteamentoService } from './application/services/loteamento.service.js';
import { LOTEAMENTO_REPOSITORY } from './domain/repositories/loteamento.repository.interface.js';
import { LoteamentosController } from './infra/controllers/loteamentos.controller.js';
import { PrismaLoteamentoRepository } from './infra/repositories/prisma-loteamento.repository.js';

@Module({
  imports: [AuditoriaModule],
  controllers: [LoteamentosController],
  providers: [
    LoteamentoService,
    { provide: LOTEAMENTO_REPOSITORY, useClass: PrismaLoteamentoRepository },
  ],
  exports: [LoteamentoService],
})
export class LoteamentosModule {}
