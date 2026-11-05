import { AcervoMarcadoresModule } from '../mapa/acervo-marcadores.module.js';
import { Module } from '@nestjs/common';
import { StorageModule } from '../../shared/infra/storage/storage.module.js';
import { AuditoriaModule } from '../auditoria/auditoria.module.js';
import { PlantaService } from './application/services/planta.service.js';
import { ProcessamentoPlantaService } from './application/services/processamento-planta.service.js';
import { PLANTA_REPOSITORY } from './domain/repositories/planta.repository.interface.js';
import { PROCESSADOR_IMAGEM } from './domain/repositories/processador-imagem.interface.js';
import { PlantasController } from './infra/controllers/plantas.controller.js';
import { PrismaPlantaRepository } from './infra/repositories/prisma-planta.repository.js';
import { SharpProcessadorImagem } from './infra/repositories/sharp-processador-imagem.js';
import { PlantasWorker } from './infra/workers/plantas.worker.js';

@Module({
  imports: [AcervoMarcadoresModule, AuditoriaModule, StorageModule],
  controllers: [PlantasController],
  providers: [
    PlantaService,
    ProcessamentoPlantaService,
    PlantasWorker,
    { provide: PLANTA_REPOSITORY, useClass: PrismaPlantaRepository },
    { provide: PROCESSADOR_IMAGEM, useClass: SharpProcessadorImagem },
  ],
  exports: [PlantaService],
})
export class PlantasModule {}
