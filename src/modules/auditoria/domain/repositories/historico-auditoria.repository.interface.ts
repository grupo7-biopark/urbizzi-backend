import type { PrismaTransaction } from '../../../../shared/infra/database/prisma.transaction.js';
import type { HistoricoAuditoria } from '../models/historico-auditoria.entity.js';
export const HISTORICO_AUDITORIA_REPOSITORY = Symbol(
  'HISTORICO_AUDITORIA_REPOSITORY',
);
export interface HistoricoAuditoriaRepository {
  create(historico: HistoricoAuditoria, tx?: PrismaTransaction): Promise<void>;
}
