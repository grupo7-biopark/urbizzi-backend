import { Module } from '@nestjs/common';
import { PlantasModule } from '../plantas/plantas.module.js';
import { LoteamentosModule } from '../loteamentos/loteamentos.module.js';
import { AuditoriaModule } from '../auditoria/auditoria.module.js';
import { MarcadorService } from './application/services/marcador.service.js';
import { MARCADOR_REPOSITORY } from './domain/repositories/marcador.repository.interface.js';
import { PrismaMarcadorRepository } from './infra/repositories/prisma-marcador.repository.js';
import { MarcadoresController } from './infra/controllers/marcadores.controller.js';
@Module({
  imports: [PlantasModule, LoteamentosModule, AuditoriaModule],
  controllers: [MarcadoresController],
  providers: [
    MarcadorService,
    { provide: MARCADOR_REPOSITORY, useClass: PrismaMarcadorRepository },
  ],
  exports: [MarcadorService],
})
export class MapaModule {}
