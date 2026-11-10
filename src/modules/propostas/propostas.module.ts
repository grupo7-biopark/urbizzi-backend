import { Module } from '@nestjs/common';
import { ReservasModule } from '../reservas/reservas.module.js';
import { ConfiguracoesModule } from '../configuracoes/configuracoes.module.js';
import { AuditoriaModule } from '../auditoria/auditoria.module.js';
import { PropostaService } from './application/services/proposta.service.js';
import { PROPOSTA_REPOSITORY } from './domain/repositories/proposta.repository.interface.js';
import { PrismaPropostaRepository } from './infra/repositories/prisma-proposta.repository.js';
import { PropostasController } from './infra/controllers/propostas.controller.js';
@Module({
  imports: [ReservasModule, ConfiguracoesModule, AuditoriaModule],
  controllers: [PropostasController],
  providers: [
    PropostaService,
    { provide: PROPOSTA_REPOSITORY, useClass: PrismaPropostaRepository },
  ],
  exports: [PropostaService],
})
export class PropostasModule {}
