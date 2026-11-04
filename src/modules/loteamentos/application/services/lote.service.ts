import type { BloquearLoteDto } from '../dto/bloquear-lote.dto.js';
import { Inject, Injectable } from '@nestjs/common';
import { PaginatedDto } from '../../../../shared/application/dto/paginated.dto.js';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../../../shared/domain/errors/domain.error.js';
import type { UsuarioAutenticado } from '../../../../shared/domain/usuario-autenticado.js';
import type { PrismaTransaction } from '../../../../shared/infra/database/prisma.transaction.js';
import { TransactionManager } from '../../../../shared/infra/database/transaction.manager.js';
import { AuditoriaService } from '../../../auditoria/application/services/auditoria.service.js';
import { Lote } from '../../domain/models/lote.entity.js';
import {
  LOTE_REPOSITORY,
  type LoteRepository,
} from '../../domain/repositories/lote.repository.interface.js';
import {
  QUADRA_REPOSITORY,
  type QuadraRepository,
} from '../../domain/repositories/quadra.repository.interface.js';
import type { CreateLoteDto } from '../dto/create-lote.dto.js';
import type { ListLotesQueryDto } from '../dto/list-lotes-query.dto.js';
import { LoteDto } from '../dto/lote.dto.js';
import type { UpdateLoteDto } from '../dto/update-lote.dto.js';

const ENTIDADE_TIPO = 'Lote';

@Injectable()
export class LoteService {
  constructor(
    @Inject(LOTE_REPOSITORY)
    private readonly loteRepository: LoteRepository,
    @Inject(QUADRA_REPOSITORY)
    private readonly quadraRepository: QuadraRepository,
    private readonly transactionManager: TransactionManager,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  async create(
    dto: CreateLoteDto,
    usuario: UsuarioAutenticado,
  ): Promise<LoteDto> {
    const quadra = await this.quadraRepository.findById(dto.quadraId);
    if (!quadra) {
      throw new NotFoundError('QUADRA_NAO_ENCONTRADA', 'Quadra não encontrada');
    }
    await this.ensureNumeroDisponivel(dto.quadraId, dto.numero);
    const lote = Lote.create({ ...dto, loteamentoId: quadra.loteamentoId });
    await this.transactionManager.run(async (tx) => {
      await this.loteRepository.create(lote, tx);
      await this.auditoriaService.registrar(
        {
          usuarioId: usuario.id,
          entidadeTipo: ENTIDADE_TIPO,
          entidadeId: lote.id,
          acao: 'CRIAR',
          valorNovo: lote.auditoria,
        },
        tx,
      );
    });
    return LoteDto.from(lote);
  }

  async listExcluindo(
    idsExcluir: string[],
    query: { page: number; pageSize: number; loteamentoId?: string },
  ): Promise<PaginatedDto<LoteDto>> {
    const result = await this.loteRepository.list(
      { idsExcluir, loteamentoId: query.loteamentoId },
      query,
    );
    return PaginatedDto.of(
      { items: result.items.map(LoteDto.from), total: result.total },
      query,
    );
  }
  async findById(id: string): Promise<LoteDto> {
    return LoteDto.from(await this.getOrFail(id));
  }

  async list(query: ListLotesQueryDto): Promise<PaginatedDto<LoteDto>> {
    const { page, pageSize, ...filtros } = query;
    const result = await this.loteRepository.list(filtros, {
      page,
      pageSize,
    });
    return PaginatedDto.of(
      { items: result.items.map(LoteDto.from), total: result.total },
      { page, pageSize },
    );
  }

  async update(
    id: string,
    dto: UpdateLoteDto,
    usuario: UsuarioAutenticado,
  ): Promise<LoteDto> {
    const lote = await this.getOrFail(id);
    if (dto.numero != null) {
      await this.ensureNumeroDisponivel(lote.quadraId, dto.numero, id);
    }
    const anterior = lote.auditoria;
    lote.atualizar(dto);
    await this.transactionManager.run(async (tx) => {
      await this.loteRepository.update(lote, tx);
      await this.auditoriaService.registrar(
        {
          usuarioId: usuario.id,
          entidadeTipo: ENTIDADE_TIPO,
          entidadeId: lote.id,
          acao: 'ALTERAR',
          valorAnterior: anterior,
          valorNovo: lote.auditoria,
        },
        tx,
      );
    });
    return LoteDto.from(lote);
  }

  async delete(id: string, usuario: UsuarioAutenticado): Promise<void> {
    await this.transactionManager.run(async (tx) => {
      const lote = await this.getOrFail(id, tx);
      lote.assertPodeExcluir();
      await this.loteRepository.delete(id, tx);
      await this.auditoriaService.registrar(
        {
          usuarioId: usuario.id,
          entidadeTipo: ENTIDADE_TIPO,
          entidadeId: id,
          acao: 'EXCLUIR',
          valorAnterior: lote.auditoria,
        },
        tx,
      );
    });
  }

  async reservar(
    id: string,
    usuarioId: string,
    tx: PrismaTransaction,
  ): Promise<void> {
    const lote = await this.getOrFail(id, tx);
    lote.reservar();
    await this.loteRepository.alterarStatus(id, 'DISPONIVEL', 'RESERVADO', tx);
    await this.auditoriaService.registrar(
      {
        usuarioId,
        entidadeTipo: 'Lote',
        entidadeId: id,
        acao: 'RESERVAR',
        valorAnterior: { status: 'DISPONIVEL' },
        valorNovo: { status: 'RESERVADO', teveReserva: true },
      },
      tx,
    );
  }
  bloquear(
    id: string,
    dto: BloquearLoteDto,
    usuario: UsuarioAutenticado,
  ): Promise<LoteDto> {
    return this.alterarBloqueio(id, usuario, true, dto.motivo);
  }

  desbloquear(id: string, usuario: UsuarioAutenticado): Promise<LoteDto> {
    return this.alterarBloqueio(id, usuario, false);
  }

  private async alterarBloqueio(
    id: string,
    usuario: UsuarioAutenticado,
    bloquear: boolean,
    motivo?: string,
  ): Promise<LoteDto> {
    if (usuario.perfil !== 'ADMINISTRADOR' && usuario.perfil !== 'GESTOR')
      throw new ForbiddenError(
        'ACESSO_NEGADO',
        'Você não tem permissão para executar esta ação',
      );
    return this.transactionManager.run(async (tx) => {
      const lote = await this.getOrFail(id, tx);
      const anterior = lote.status;
      if (bloquear) lote.bloquear(motivo ?? '');
      else lote.desbloquear();
      await this.loteRepository.alterarStatus(id, anterior, lote.status, tx);
      await this.auditoriaService.registrar(
        {
          usuarioId: usuario.id,
          entidadeTipo: ENTIDADE_TIPO,
          entidadeId: id,
          acao: bloquear ? 'BLOQUEAR' : 'DESBLOQUEAR',
          valorAnterior: { status: anterior },
          valorNovo: { status: lote.status },
          motivo: bloquear ? motivo!.trim() : null,
        },
        tx,
      );
      return LoteDto.from(lote);
    });
  }

  private async getOrFail(id: string, tx?: PrismaTransaction): Promise<Lote> {
    const lote = await this.loteRepository.findById(id, tx);
    if (!lote) {
      throw new NotFoundError('LOTE_NAO_ENCONTRADO', 'Lote não encontrado');
    }
    return lote;
  }

  private async ensureNumeroDisponivel(
    quadraId: string,
    numero: string,
    ignoreId?: string,
  ): Promise<void> {
    if (await this.loteRepository.existsByNumero(quadraId, numero, ignoreId)) {
      throw new ConflictError(
        'LOTE_JA_EXISTE',
        'Já existe um lote com esse número na quadra',
      );
    }
  }
}
