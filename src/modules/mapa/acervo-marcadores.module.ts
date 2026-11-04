import { Module } from '@nestjs/common';
import { CopiaMarcadoresService } from './application/services/copia-marcadores.service.js';
import { MARCADOR_REPOSITORY } from './domain/repositories/marcador.repository.interface.js';
import { PrismaMarcadorRepository } from './infra/repositories/prisma-marcador.repository.js';
@Module({
  providers: [
    CopiaMarcadoresService,
    { provide: MARCADOR_REPOSITORY, useClass: PrismaMarcadorRepository },
  ],
  exports: [CopiaMarcadoresService, MARCADOR_REPOSITORY],
})
export class AcervoMarcadoresModule {}
