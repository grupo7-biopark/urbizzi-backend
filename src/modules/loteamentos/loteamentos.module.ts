import { Module } from '@nestjs/common';
import { AuditoriaModule } from '../auditoria/auditoria.module.js';
import { LoteService } from './application/services/lote.service.js';
import { LoteamentoService } from './application/services/loteamento.service.js';
import { QuadraService } from './application/services/quadra.service.js';
import { LOTE_REPOSITORY } from './domain/repositories/lote.repository.interface.js';
import { LOTEAMENTO_REPOSITORY } from './domain/repositories/loteamento.repository.interface.js';
import { QUADRA_REPOSITORY } from './domain/repositories/quadra.repository.interface.js';
import { LoteamentosController } from './infra/controllers/loteamentos.controller.js';
import { LotesController } from './infra/controllers/lotes.controller.js';
import { QuadrasController } from './infra/controllers/quadras.controller.js';
import { PrismaLoteRepository } from './infra/repositories/prisma-lote.repository.js';
import { PrismaLoteamentoRepository } from './infra/repositories/prisma-loteamento.repository.js';
import { PrismaQuadraRepository } from './infra/repositories/prisma-quadra.repository.js';

@Module({
  imports: [AuditoriaModule],
  controllers: [LoteamentosController, QuadrasController, LotesController],
  providers: [
    LoteamentoService,
    QuadraService,
    LoteService,
    { provide: LOTEAMENTO_REPOSITORY, useClass: PrismaLoteamentoRepository },
    { provide: QUADRA_REPOSITORY, useClass: PrismaQuadraRepository },
    { provide: LOTE_REPOSITORY, useClass: PrismaLoteRepository },
  ],
  exports: [LoteamentoService, LoteService],
})
export class LoteamentosModule {}
