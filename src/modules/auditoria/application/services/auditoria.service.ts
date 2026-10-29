import { Inject, Injectable } from '@nestjs/common';
import type { PrismaTransaction } from '../../../../shared/infra/database/prisma.transaction.js';
import {
  HistoricoAuditoria,
  type RegistrarAuditoriaInput,
} from '../../domain/models/historico-auditoria.entity.js';
import {
  HISTORICO_AUDITORIA_REPOSITORY,
  type HistoricoAuditoriaRepository,
} from '../../domain/repositories/historico-auditoria.repository.interface.js';
@Injectable()
export class AuditoriaService {
  constructor(
    @Inject(HISTORICO_AUDITORIA_REPOSITORY)
    private readonly repository: HistoricoAuditoriaRepository,
  ) {}
  async registrar(
    input: RegistrarAuditoriaInput,
    tx?: PrismaTransaction,
  ): Promise<void> {
    await this.repository.create(HistoricoAuditoria.create(input), tx);
  }
}
