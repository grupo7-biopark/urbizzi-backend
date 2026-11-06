import { Module } from '@nestjs/common';
import { HistoricoClienteController } from './infra/controllers/historico-cliente.controller.js';
import { HistoricoClienteService } from './application/services/historico-cliente.service.js';
import { HISTORICO_CLIENTE_REPOSITORY } from './domain/repositories/historico-cliente.repository.interface.js';
import { PrismaHistoricoClienteRepository } from './infra/repositories/prisma-historico-cliente.repository.js';
import { AuditoriaModule } from '../auditoria/auditoria.module.js';
import { ClienteService } from './application/services/cliente.service.js';
import { CLIENTE_REPOSITORY } from './domain/repositories/cliente.repository.interface.js';
import { PrismaClienteRepository } from './infra/repositories/prisma-cliente.repository.js';
import { ClientesController } from './infra/controllers/clientes.controller.js';
@Module({
  imports: [AuditoriaModule],
  providers: [
    ClienteService,
    HistoricoClienteService,
    {
      provide: HISTORICO_CLIENTE_REPOSITORY,
      useClass: PrismaHistoricoClienteRepository,
    },
    { provide: CLIENTE_REPOSITORY, useClass: PrismaClienteRepository },
  ],
  controllers: [ClientesController, HistoricoClienteController],
  exports: [ClienteService],
})
export class ClientesModule {}
