import { MapaService } from './application/services/mapa.service.js';
import { MAPA_CONSULTA_REPOSITORY } from './domain/repositories/mapa-consulta.repository.interface.js';
import { PrismaMapaConsultaRepository } from './infra/repositories/prisma-mapa-consulta.repository.js';
import { MapaController } from './infra/controllers/mapa.controller.js';
import { Module } from '@nestjs/common';
import { PlantasModule } from '../plantas/plantas.module.js';
import { LoteamentosModule } from '../loteamentos/loteamentos.module.js';
import { AuditoriaModule } from '../auditoria/auditoria.module.js';
import { MarcadorService } from './application/services/marcador.service.js';
import { AcervoMarcadoresModule } from './acervo-marcadores.module.js';

import { MarcadoresController } from './infra/controllers/marcadores.controller.js';
@Module({
  imports: [
    AcervoMarcadoresModule,
    PlantasModule,
    LoteamentosModule,
    AuditoriaModule,
  ],
  controllers: [MarcadoresController, MapaController],
  providers: [
    MarcadorService,
    MapaService,
    {
      provide: MAPA_CONSULTA_REPOSITORY,
      useClass: PrismaMapaConsultaRepository,
    },
  ],
  exports: [MarcadorService, MapaService],
})
export class MapaModule {}
