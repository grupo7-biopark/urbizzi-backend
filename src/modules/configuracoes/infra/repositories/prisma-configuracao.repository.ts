import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infra/database/prisma.service.js';
import type { PrismaTransaction } from '../../../../shared/infra/database/prisma.transaction.js';
import type {
  ConfiguracaoRepository,
  ConfiguracaoChave,
} from '../../domain/repositories/configuracao.repository.interface.js';
@Injectable()
export class PrismaConfiguracaoRepository implements ConfiguracaoRepository {
  constructor(private readonly prisma: PrismaService) {}
  read(tx?: PrismaTransaction) {
    return (tx ?? this.prisma).configuracao.findMany({
      where: {
        chave: { in: ['prazo_reserva_dias', 'prazo_analise_dias_uteis'] },
      },
      select: { chave: true, valor: true },
    });
  }
  async lock(tx: PrismaTransaction): Promise<void> {
    await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(110011)`;
  }
  async set(chave: ConfiguracaoChave, valor: number, tx: PrismaTransaction) {
    const anterior = await tx.configuracao.findUnique({ where: { chave } });
    const row = await tx.configuracao.upsert({
      where: { chave },
      create: { chave, valor: String(valor) },
      update: { valor: String(valor) },
    });
    return { id: row.id, anterior: anterior?.valor ?? null };
  }
}
