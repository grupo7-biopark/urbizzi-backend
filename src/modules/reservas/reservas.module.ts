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
@Module({
  imports: [
    LoteamentosModule,
    ClientesModule,
    ConfiguracoesModule,
    AuditoriaModule,
  ],
  controllers: [ReservasConsultaController, ReservasController],
  providers: [
    ReservaService,
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
