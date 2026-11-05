import { Inject, Injectable } from '@nestjs/common';
import { BusinessRuleError } from '../../../../shared/domain/errors/domain.error.js';
import type { PrismaTransaction } from '../../../../shared/infra/database/prisma.transaction.js';
import { TransactionManager } from '../../../../shared/infra/database/transaction.manager.js';
import { PaginatedDto } from '../../../../shared/application/dto/paginated.dto.js';
import type { Pagination } from '../../../../shared/domain/pagination.js';
import { AuditoriaService } from '../../../auditoria/application/services/auditoria.service.js';
import {
  CONFIGURACAO_REPOSITORY,
  type ConfiguracaoRepository,
  type ConfiguracaoChave,
} from '../../domain/repositories/configuracao.repository.interface.js';
import type { UpdateConfiguracoesDto } from '../dto/update-configuracoes.dto.js';
import { ConfiguracaoDto, PrazosDto } from '../dto/configuracao.dto.js';
@Injectable()
export class ConfiguracaoService {
  private cache: { valor: PrazosDto; expiraEm: number } | null = null;
  private versao = 0;
  constructor(
    @Inject(CONFIGURACAO_REPOSITORY)
    private readonly repository: ConfiguracaoRepository,
    private readonly transactions: TransactionManager,
    private readonly auditoria: AuditoriaService,
  ) {}
  async getLimiteRenovacoes(tx: PrismaTransaction): Promise<number | null> {
    const valor = await this.repository.readLimiteRenovacoes(tx);
    if (valor === null) return null;
    const limite = Number(valor);
    if (!/^\d+$/.test(valor) || !Number.isSafeInteger(limite))
      throw new BusinessRuleError(
        'CONFIGURACAO_INVALIDA',
        'Limite de renovações inválido',
      );
    return limite;
  }
  async getPrazoReservaDias(tx?: PrismaTransaction): Promise<number> {
    return (await this.read(tx)).prazoReservaDias;
  }
  async getPrazoAnaliseDiasUteis(tx?: PrismaTransaction): Promise<number> {
    return (await this.read(tx)).prazoAnaliseDiasUteis;
  }
  async list(query: Pagination): Promise<PaginatedDto<ConfiguracaoDto>> {
    const prazos = await this.read();
    const items = [
      { chave: 'prazo_reserva_dias', valor: prazos.prazoReservaDias },
      {
        chave: 'prazo_analise_dias_uteis',
        valor: prazos.prazoAnaliseDiasUteis,
      },
    ];
    return PaginatedDto.of(
      {
        items: items.slice(
          (query.page - 1) * query.pageSize,
          query.page * query.pageSize,
        ),
        total: items.length,
      },
      query,
    );
  }
  async update(
    dto: UpdateConfiguracoesDto,
    usuarioId: string,
  ): Promise<PrazosDto> {
    if (
      dto.prazoReservaDias === undefined &&
      dto.prazoAnaliseDiasUteis === undefined
    )
      throw new BusinessRuleError(
        'CONFIGURACAO_VAZIA',
        'Informe ao menos um prazo',
      );
    const entries: [ConfiguracaoChave, number | undefined][] = [
      ['prazo_reserva_dias', dto.prazoReservaDias],
      ['prazo_analise_dias_uteis', dto.prazoAnaliseDiasUteis],
    ];
    for (const [, valor] of entries)
      if (valor !== undefined) this.positive(valor);
    const result = await this.transactions.run(async (tx) => {
      await this.repository.lock(tx);
      for (const [chave, valor] of entries) {
        if (valor === undefined) continue;
        const registro = await this.repository.set(chave, valor, tx);
        await this.auditoria.registrar(
          {
            usuarioId,
            entidadeTipo: 'Configuracao',
            entidadeId: registro.id,
            acao: 'ALTERAR',
            valorAnterior: {
              chave,
              valor:
                registro.anterior === null
                  ? 7
                  : this.positive(Number(registro.anterior)),
            },
            valorNovo: { chave, valor },
          },
          tx,
        );
      }
      return this.read(tx);
    });
    this.versao++;
    this.cache = null;
    return result;
  }
  private positive(valor: number): number {
    if (!Number.isSafeInteger(valor) || valor < 1)
      throw new BusinessRuleError(
        'CONFIGURACAO_INVALIDA',
        'O prazo deve ser um inteiro positivo',
      );
    return valor;
  }
  private async read(tx?: PrismaTransaction): Promise<PrazosDto> {
    if (!tx && this.cache && this.cache.expiraEm > Date.now())
      return { ...this.cache.valor };
    const versao = this.versao;
    const rows = await this.repository.read(tx);
    const values = Object.fromEntries(
      rows.map((row) => [row.chave, this.positive(Number(row.valor))]),
    );
    const valor = {
      prazoReservaDias: values.prazo_reserva_dias ?? 7,
      prazoAnaliseDiasUteis: values.prazo_analise_dias_uteis ?? 7,
    };
    if (!tx && versao === this.versao)
      this.cache = { valor, expiraEm: Date.now() + 30000 };
    return { ...valor };
  }
}
