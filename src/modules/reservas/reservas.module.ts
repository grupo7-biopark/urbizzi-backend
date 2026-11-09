import { ScheduleModule } from '@nestjs/schedule';
import { ExpiracaoReservaService } from './application/services/expiracao-reserva.service.js';
import { EXPIRACAO_RESERVA_REPOSITORY } from './domain/repositories/expiracao-reserva.repository.interface.js';
import { PrismaExpiracaoReservaRepository } from './infra/repositories/prisma-expiracao-reserva.repository.js';
import { ExpiracaoReservasJob } from './infra/workers/expiracao-reservas.job.js';
import { ReservaConsultaService } from './application/services/reserva-consulta.service.js';
import { RESERVA_CONSULTA_REPOSITORY } from './domain/repositories/reserva-consulta.repository.interface.js';
import { PrismaReservaConsultaRepository } from './infra/repositories/prisma-reserva-consulta.repository.js';
import { ReservasConsultaController } from './infra/controllers/reservas-consulta.controller.js';
import { Module } from '@nestjs/common';
import { LoteamentosModule } from '../loteamentos/loteamentos.module.js';
import { ClientesModule } from '../clientes/clientes.module.js';
import { ConfiguracoesModule } from '../configuracoes/configuracoes.module.js';
import { AuditoriaModule } from '../auditoria/auditoria.module.js';
import { ReservaService } from './application/services/reserva.service.js';
import { RESERVA_REPOSITORY } from './domain/repositories/reserva.repository.interface.js';
import { PrismaReservaRepository } from './infra/repositories/prisma-reserva.repository.js';
import { ReservasController } from './infra/controllers/reservas.controller.js';
import { VendasLotesController } from './infra/controllers/vendas-lotes.controller.js';
@Module({
  imports: [
    ScheduleModule.forRoot(),
    LoteamentosModule,
    ClientesModule,
    ConfiguracoesModule,
    AuditoriaModule,
  ],
  controllers: [
    ReservasConsultaController,
    ReservasController,
    VendasLotesController,
  ],
  providers: [
    ReservaService,
    ExpiracaoReservaService,
    ExpiracaoReservasJob,
    {
      provide: EXPIRACAO_RESERVA_REPOSITORY,
      useClass: PrismaExpiracaoReservaRepository,
    },
    ReservaConsultaService,
    {
      provide: RESERVA_CONSULTA_REPOSITORY,
      useClass: PrismaReservaConsultaRepository,
    },
    { provide: RESERVA_REPOSITORY, useClass: PrismaReservaRepository },
  ],
  exports: [ReservaService],
})
export class ReservasModule {}
