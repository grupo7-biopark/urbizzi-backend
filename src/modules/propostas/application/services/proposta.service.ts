import { Inject, Injectable } from '@nestjs/common';
import {
  ConflictError,
  NotFoundError,
} from '../../../../shared/domain/errors/domain.error.js';
import type { UsuarioAutenticado } from '../../../../shared/domain/usuario-autenticado.js';
import type { Pagination } from '../../../../shared/domain/pagination.js';
import { TransactionManager } from '../../../../shared/infra/database/transaction.manager.js';
import { PaginatedDto } from '../../../../shared/application/dto/paginated.dto.js';
import { ReservaService } from '../../../reservas/application/services/reserva.service.js';
import { ConfiguracaoService } from '../../../configuracoes/application/services/configuracao.service.js';
import { AuditoriaService } from '../../../auditoria/application/services/auditoria.service.js';
import { Proposta } from '../../domain/models/proposta.entity.js';
import {
  PROPOSTA_REPOSITORY,
  type PropostaRepository,
} from '../../domain/repositories/proposta.repository.interface.js';
import type { CreatePropostaDto } from '../dto/create-proposta.dto.js';
import { PropostaDto } from '../dto/proposta.dto.js';
@Injectable()
export class PropostaService {
  constructor(
    @Inject(PROPOSTA_REPOSITORY)
    private readonly repository: PropostaRepository,
    private readonly reservas: ReservaService,
    private readonly configuracoes: ConfiguracaoService,
    private readonly auditoria: AuditoriaService,
    private readonly transactions: TransactionManager,
  ) {}
  create(
    reservaId: string,
    dto: CreatePropostaDto,
    usuario: UsuarioAutenticado,
  ): Promise<PropostaDto> {
    return this.transactions.run(async (tx) => {
      const reserva = await this.reservas.findById(reservaId, usuario, tx);
      const agora = new Date();
      if (
        reserva.status !== 'ATIVA' ||
        new Date(reserva.dataVencimento) <= agora
      )
        throw new ConflictError(
          'RESERVA_INVALIDA_PARA_PROPOSTA',
          'A reserva deve estar ativa e dentro do prazo',
        );
      const impedimento = await this.repository.findImpedimento(reservaId, tx);
      if (impedimento === 'EM_ANALISE')
        throw new ConflictError(
          'PROPOSTA_EM_ANALISE',
          'A reserva já possui proposta em análise',
        );
      if (impedimento === 'APROVADA')
        throw new ConflictError(
          'PROPOSTA_JA_APROVADA',
          'A reserva já possui proposta aprovada',
        );
      const proposta = Proposta.create(
        {
          ...dto,
          observacoes: dto.observacoes ?? null,
          reservaId,
          vendedorId: reserva.vendedorId,
        },
        await this.configuracoes.getPrazoAnaliseDiasUteis(tx),
        agora,
      );
      await this.repository.create(proposta, tx);
      const { id, status, valor, prazoLimite, dataEnvio } = proposta.dados;
      await this.auditoria.registrar(
        {
          usuarioId: usuario.id,
          entidadeTipo: 'Proposta',
          entidadeId: id,
          acao: 'CRIAR',
          valorNovo: {
            reservaId,
            status,
            valor,
            dataEnvio: dataEnvio.toISOString(),
            prazoLimite: prazoLimite.toISOString(),
          },
        },
        tx,
      );
      return PropostaDto.from(proposta);
    });
  }
  async findById(
    id: string,
    usuario: UsuarioAutenticado,
  ): Promise<PropostaDto> {
    const proposta = await this.repository.findById(id);
    if (!proposta)
      throw new NotFoundError(
        'PROPOSTA_NAO_ENCONTRADA',
        'Proposta não encontrada',
      );
    await this.reservas.findById(proposta.dados.reservaId, usuario);
    return PropostaDto.from(proposta);
  }
  async list(
    reservaId: string,
    query: Pagination,
    usuario: UsuarioAutenticado,
  ): Promise<PaginatedDto<PropostaDto>> {
    await this.reservas.findById(reservaId, usuario);
    const result = await this.repository.list(reservaId, query);
    return PaginatedDto.of(
      { items: result.items.map(PropostaDto.from), total: result.total },
      query,
    );
  }
}
