import { Module } from '@nestjs/common';
import { AuditoriaModule } from '../auditoria/auditoria.module.js';
import { ClienteService } from './application/services/cliente.service.js';
import { CLIENTE_REPOSITORY } from './domain/repositories/cliente.repository.interface.js';
import { PrismaClienteRepository } from './infra/repositories/prisma-cliente.repository.js';
import { ClientesController } from './infra/controllers/clientes.controller.js';
@Module({
  imports: [AuditoriaModule],
  providers: [
    ClienteService,
    { provide: CLIENTE_REPOSITORY, useClass: PrismaClienteRepository },
  ],
  controllers: [ClientesController],
  exports: [ClienteService],
})
export class ClientesModule {}
