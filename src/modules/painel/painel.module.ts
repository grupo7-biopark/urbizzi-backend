import { Module } from '@nestjs/common';
import { LoteamentosModule } from '../loteamentos/loteamentos.module.js';
import { PainelService } from './application/services/painel.service.js';
import { PAINEL_CONSULTA_REPOSITORY } from './domain/repositories/painel-consulta.repository.interface.js';
import { PainelController } from './infra/controllers/painel.controller.js';
import { PrismaPainelConsultaRepository } from './infra/repositories/prisma-painel-consulta.repository.js';

@Module({
  imports: [LoteamentosModule],
  controllers: [PainelController],
  providers: [
    PainelService,
    {
      provide: PAINEL_CONSULTA_REPOSITORY,
      useClass: PrismaPainelConsultaRepository,
    },
  ],
  exports: [PainelService],
})
export class PainelModule {}
