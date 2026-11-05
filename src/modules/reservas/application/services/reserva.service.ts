import type { PrismaTransaction } from '../../../../shared/infra/database/prisma.transaction.js';
import { Inject, Injectable } from '@nestjs/common';
import {
  ForbiddenError,
  ConflictError,
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
  ) {}
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
      const propostas = await this.repository.cancelar(
        id,
        usuario.id,
        dto.confirmar === true,
        tx,
      );
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
      for (const propostaId of propostas) {
        await this.auditoria.registrar(
          {
            usuarioId: usuario.id,
            entidadeTipo: 'Proposta',
            entidadeId: propostaId,
            acao: 'ENCERRAR_POR_CANCELAMENTO',
            valorNovo: { status: 'REJEITADA' },
          },
          tx,
        );
      }
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
