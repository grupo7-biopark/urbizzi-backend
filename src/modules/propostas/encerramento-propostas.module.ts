import { Module } from '@nestjs/common';
import { AuditoriaModule } from '../auditoria/auditoria.module.js';
import { EncerramentoPropostasService } from './application/services/encerramento-propostas.service.js';
import { ENCERRAMENTO_PROPOSTA_REPOSITORY } from './domain/repositories/encerramento-proposta.repository.interface.js';
import { PrismaEncerramentoPropostaRepository } from './infra/repositories/prisma-encerramento-proposta.repository.js';
/** Serviço dono das propostas, sem depender de reservas nem criar ciclo. */
@Module({
  imports: [AuditoriaModule],
  providers: [
    EncerramentoPropostasService,
    {
      provide: ENCERRAMENTO_PROPOSTA_REPOSITORY,
      useClass: PrismaEncerramentoPropostaRepository,
    },
  ],
  exports: [EncerramentoPropostasService],
})
export class EncerramentoPropostasModule {}
