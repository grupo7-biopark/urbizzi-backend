import { Inject, Injectable } from '@nestjs/common';
import {
  MARCADOR_REPOSITORY,
  type MarcadorRepository,
} from '../../domain/repositories/marcador.repository.interface.js';
import type { PrismaTransaction } from '../../../../shared/infra/database/prisma.transaction.js';
@Injectable()
export class CopiaMarcadoresService {
  constructor(
    @Inject(MARCADOR_REPOSITORY)
    private readonly repository: MarcadorRepository,
  ) {}
  copiar(
    origem: string,
    destino: string,
    mudouProporcao: boolean,
    tx: PrismaTransaction,
  ) {
    return this.repository.copiar(origem, destino, mudouProporcao, tx);
  }
}
