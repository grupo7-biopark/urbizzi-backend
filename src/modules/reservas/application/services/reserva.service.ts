import { EncerramentoPropostasService } from '../../../propostas/application/services/encerramento-propostas.service.js';
import type { PrismaTransaction } from '../../../../shared/infra/database/prisma.transaction.js';
import { Inject, Injectable } from '@nestjs/common';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../../../shared/domain/errors/domain.error.js';
import { PropriedadePolicy } from '../../../../shared/domain/policies/propriedade.policy.js';
import type { UsuarioAutenticado } from '../../../../shared/domain/usuario-autenticado.js';
import { TransactionManager } from '../../../../shared/infra/database/transaction.manager.js';
import { LoteService } from '../../../loteamentos/application/services/lote.service.js';
import { ClienteService } from '../../../clientes/application/services/cliente.service.js';
import { ConfiguracaoService } from '../../../configuracoes/application/services/configuracao.service.js';
import { AuditoriaService } from '../../../auditoria/application/services/auditoria.service.js';
import { Reserva } from '../../domain/models/reserva.entity.js';
import {
  RESERVA_REPOSITORY,
  type ReservaRepository,
} from '../../domain/repositories/reserva.repository.interface.js';
import type { CreateReservaDto } from '../dto/create-reserva.dto.js';
import type { PrevisaoReservaDto } from '../dto/previsao-reserva.dto.js';
import { ReservaDto } from '../dto/reserva.dto.js';
import { toSkipTake } from '../../../../shared/domain/pagination.js';
import { PaginatedDto } from '../../../../shared/application/dto/paginated.dto.js';
import type { PaginationQueryDto } from '../../../../shared/application/dto/pagination-query.dto.js';
import type { CancelarReservaDto } from '../dto/cancelar-reserva.dto.js';
@Injectable()
export class ReservaService {
  constructor(
    @Inject(RESERVA_REPOSITORY) private readonly repository: ReservaRepository,
    private readonly lotes: LoteService,
    private readonly clientes: ClienteService,
    private readonly configuracoes: ConfiguracaoService,
    private readonly auditoria: AuditoriaService,
    private readonly transactions: TransactionManager,
    private readonly encerramento: EncerramentoPropostasService,
  ) {}
  async preverVencimento(
    usuario: UsuarioAutenticado,
  ): Promise<PrevisaoReservaDto> {
    this.assertPerfil(usuario);
    const prazoDias = await this.configuracoes.getPrazoReservaDias();
    return {
      prazoDias,
      dataVencimento: Reserva.calcularVencimento(
        prazoDias,
        new Date(),
      ).toISOString(),
    };
  }
  async create(
    dto: CreateReservaDto,
    usuario: UsuarioAutenticado,
  ): Promise<ReservaDto> {
    this.assertPerfil(usuario);
    return this.transactions.run(async (tx) => {
      await this.clientes.validarExistencia(dto.clienteId, tx);
      await this.lotes.reservar(dto.loteId, usuario.id, tx);
      const reserva = Reserva.create(
        { ...dto, vendedorId: usuario.id },
        await this.configuracoes.getPrazoReservaDias(tx),
      );
      await this.repository.create(reserva, tx);
      const { id, loteId, status, dataInicio, dataVencimento } = reserva.dados;
      await this.auditoria.registrar(
        {
          usuarioId: usuario.id,
          entidadeTipo: 'Reserva',
          entidadeId: id,
          acao: 'CRIAR',
          valorNovo: {
            loteId,
            status,
            dataInicio: dataInicio.toISOString(),
            dataVencimento: dataVencimento.toISOString(),
          },
        },
        tx,
      );
      return ReservaDto.from(reserva);
    });
  }
  async renovar(id: string, usuario: UsuarioAutenticado): Promise<ReservaDto> {
    return this.transactions.run(async (tx) => {
      const reserva = await this.carregar(id, usuario, tx);
      const anterior = reserva.dados.dataVencimento;
      reserva.renovar(await this.configuracoes.getPrazoReservaDias(tx));
      const limite = await this.configuracoes.getLimiteRenovacoes(tx);
      if (
        limite !== null &&
        (await this.repository.contarRenovacoes(id, tx)) >= limite
      )
        throw new ConflictError(
          'LIMITE_RENOVACOES_ATINGIDO',
          'Limite de renovações atingido',
        );
      await this.repository.renovar(reserva, anterior, usuario.id, tx);
      await this.auditoria.registrar(
        {
          usuarioId: usuario.id,
          entidadeTipo: 'Reserva',
          entidadeId: id,
          acao: 'RENOVAR',
          valorAnterior: { dataVencimento: anterior.toISOString() },
          valorNovo: {
            dataVencimento: reserva.dados.dataVencimento.toISOString(),
          },
        },
        tx,
      );
      return ReservaDto.from(reserva);
    });
  }

  async cancelar(
    id: string,
    dto: CancelarReservaDto,
    usuario: UsuarioAutenticado,
  ): Promise<ReservaDto> {
    return this.transactions.run(async (tx) => {
      const reserva = await this.carregar(id, usuario, tx);
      reserva.cancelar();
      await this.encerramento.porCancelamento(
        id,
        usuario.id,
        dto.confirmar === true,
        dto.motivo,
        tx,
      );
      await this.repository.cancelar(id, dto.motivo, tx);
      await this.lotes.liberarReserva(reserva.dados.loteId, tx, usuario.id);
      await this.auditoria.registrar(
        {
          usuarioId: usuario.id,
          entidadeTipo: 'Reserva',
          entidadeId: id,
          acao: 'CANCELAR',
          valorAnterior: { status: 'ATIVA' },
          valorNovo: { status: 'CANCELADA' },
          motivo: dto.motivo,
        },
        tx,
      );
      return ReservaDto.from(reserva);
    });
  }

  async listarRenovacoes(
    id: string,
    query: PaginationQueryDto,
    usuario: UsuarioAutenticado,
  ) {
    await this.carregar(id, usuario);
    const { skip, take } = toSkipTake(query);
    return PaginatedDto.of(
      await this.repository.listarRenovacoes(id, skip, take),
      query,
    );
  }

  async venderLote(loteId: string, usuario: UsuarioAutenticado): Promise<void> {
    if (usuario.perfil !== 'ADMINISTRADOR' && usuario.perfil !== 'GESTOR')
      throw new ForbiddenError(
        'ACESSO_NEGADO',
        'Você não tem permissão para executar esta ação',
      );
    await this.transactions.run(async (tx) => {
      const reservaId = await this.repository.travarAtivaPorLote(loteId, tx);
      if (!reservaId) {
        await this.lotes.findById(loteId, tx);
        throw new ConflictError(
          'LOTE_SEM_RESERVA_ATIVA',
          'O lote não possui uma reserva ativa para a venda',
        );
      }
      const propostaId = await this.repository.findPropostaAprovada(
        reservaId,
        tx,
      );
      if (!propostaId)
        throw new ConflictError(
          'LOTE_SEM_PROPOSTA_APROVADA',
          'A venda exige uma proposta aprovada na reserva ativa',
        );

      await this.lotes.vender(loteId, usuario.id, tx);
      await this.repository.converter(reservaId, tx);
      await this.auditoria.registrar(
        {
          usuarioId: usuario.id,
          entidadeTipo: 'Reserva',
          entidadeId: reservaId,
          acao: 'CONVERTER',
          valorAnterior: { status: 'ATIVA' },
          valorNovo: { status: 'CONVERTIDA', loteId, propostaId },
        },
        tx,
      );
    });
  }

  async findById(
    id: string,
    usuario: UsuarioAutenticado,
    tx?: PrismaTransaction,
  ): Promise<ReservaDto> {
    return ReservaDto.from(await this.carregar(id, usuario, tx));
  }

  private async carregar(
    id: string,
    usuario: UsuarioAutenticado,
    tx?: PrismaTransaction,
  ): Promise<Reserva> {
    this.assertPerfil(usuario);
    const reserva = await this.repository.findById(id, tx);
    if (!reserva)
      throw new NotFoundError(
        'RESERVA_NAO_ENCONTRADA',
        'Reserva não encontrada',
      );
    PropriedadePolicy.assertPodeAlterar(usuario, reserva.dados.vendedorId);
    return reserva;
  }
  private assertPerfil(usuario: UsuarioAutenticado): void {
    if (usuario.perfil === 'CONSULTA')
      throw new ForbiddenError(
        'ACESSO_NEGADO',
        'Você não tem permissão para executar esta ação',
      );
  }
}
