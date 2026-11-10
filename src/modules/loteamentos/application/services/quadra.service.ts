import { Inject, Injectable } from '@nestjs/common';
import { PaginatedDto } from '../../../../shared/application/dto/paginated.dto.js';
import {
  ConflictError,
  NotFoundError,
} from '../../../../shared/domain/errors/domain.error.js';
import type { UsuarioAutenticado } from '../../../../shared/domain/usuario-autenticado.js';
import type { PrismaTransaction } from '../../../../shared/infra/database/prisma.transaction.js';
import { TransactionManager } from '../../../../shared/infra/database/transaction.manager.js';
import { AuditoriaService } from '../../../auditoria/application/services/auditoria.service.js';
import { Quadra } from '../../domain/models/quadra.entity.js';
import {
  LOTEAMENTO_REPOSITORY,
  type LoteamentoRepository,
} from '../../domain/repositories/loteamento.repository.interface.js';
import {
  QUADRA_REPOSITORY,
  type QuadraRepository,
} from '../../domain/repositories/quadra.repository.interface.js';
import type { CreateQuadraDto } from '../dto/create-quadra.dto.js';
import type { ListQuadrasQueryDto } from '../dto/list-quadras-query.dto.js';
import { QuadraDto } from '../dto/quadra.dto.js';
import type { UpdateQuadraDto } from '../dto/update-quadra.dto.js';

const ENTIDADE_TIPO = 'Quadra';

@Injectable()
export class QuadraService {
  constructor(
    @Inject(QUADRA_REPOSITORY)
    private readonly quadraRepository: QuadraRepository,
    @Inject(LOTEAMENTO_REPOSITORY)
    private readonly loteamentoRepository: LoteamentoRepository,
    private readonly transactionManager: TransactionManager,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  async create(
    loteamentoId: string,
    dto: CreateQuadraDto,
    usuario: UsuarioAutenticado,
  ): Promise<QuadraDto> {
    return this.transactionManager.run(async (tx) => {
      await this.ensureLoteamentoExiste(loteamentoId, tx);
      await this.ensureNumeroDisponivel(loteamentoId, dto.numero);
      const quadra = Quadra.create({ loteamentoId, numero: dto.numero });
      await this.quadraRepository.create(quadra, tx);
      await this.auditoriaService.registrar(
        {
          usuarioId: usuario.id,
          entidadeTipo: ENTIDADE_TIPO,
          entidadeId: quadra.id,
          acao: 'CRIAR',
          valorNovo: quadra.auditoria,
        },
        tx,
      );
      return QuadraDto.from(quadra);
    });
  }

  async findById(id: string): Promise<QuadraDto> {
    return QuadraDto.from(await this.getOrFail(id));
  }

  async list(
    loteamentoId: string,
    query: ListQuadrasQueryDto,
  ): Promise<PaginatedDto<QuadraDto>> {
    await this.ensureLoteamentoExiste(loteamentoId);
    const { page, pageSize, ...filtros } = query;
    const result = await this.quadraRepository.list(
      { ...filtros, loteamentoId },
      { page, pageSize },
    );
    return PaginatedDto.of(
      { items: result.items.map(QuadraDto.from), total: result.total },
      { page, pageSize },
    );
  }

  async update(
    id: string,
    dto: UpdateQuadraDto,
    usuario: UsuarioAutenticado,
  ): Promise<QuadraDto> {
    return this.transactionManager.run(async (tx) => {
      const quadra = await this.getOrFail(id, tx);
      if (dto.numero != null) {
        await this.ensureNumeroDisponivel(quadra.loteamentoId, dto.numero, id);
      }
      const anterior = quadra.auditoria;
      quadra.atualizar(dto);
      await this.quadraRepository.update(quadra, tx);
      await this.auditoriaService.registrar(
        {
          usuarioId: usuario.id,
          entidadeTipo: ENTIDADE_TIPO,
          entidadeId: quadra.id,
          acao: 'ALTERAR',
          valorAnterior: anterior,
          valorNovo: quadra.auditoria,
        },
        tx,
      );
      return QuadraDto.from(quadra);
    });
  }

  async delete(id: string, usuario: UsuarioAutenticado): Promise<void> {
    await this.transactionManager.run(async (tx) => {
      const quadra = await this.getOrFail(id, tx);
      if (await this.quadraRepository.hasLotes(id, tx)) {
        throw new ConflictError(
          'QUADRA_COM_LOTES',
          'Não é possível excluir uma quadra com lotes cadastrados',
        );
      }
      await this.quadraRepository.delete(id, tx);
      await this.auditoriaService.registrar(
        {
          usuarioId: usuario.id,
          entidadeTipo: ENTIDADE_TIPO,
          entidadeId: id,
          acao: 'EXCLUIR',
          valorAnterior: quadra.auditoria,
        },
        tx,
      );
    });
  }

  private async getOrFail(id: string, tx?: PrismaTransaction): Promise<Quadra> {
    const quadra = await this.quadraRepository.findById(id, tx);
    if (!quadra) {
      throw new NotFoundError('QUADRA_NAO_ENCONTRADA', 'Quadra não encontrada');
    }
    return quadra;
  }

  private async ensureLoteamentoExiste(
    loteamentoId: string,
    tx?: PrismaTransaction,
  ): Promise<void> {
    if (!(await this.loteamentoRepository.findById(loteamentoId, tx))) {
      throw new NotFoundError(
        'LOTEAMENTO_NAO_ENCONTRADO',
        'Loteamento não encontrado',
      );
    }
  }

  private async ensureNumeroDisponivel(
    loteamentoId: string,
    numero: string,
    ignoreId?: string,
  ): Promise<void> {
    if (
      await this.quadraRepository.existsByNumero(loteamentoId, numero, ignoreId)
    ) {
      throw new ConflictError(
        'QUADRA_JA_EXISTE',
        'Já existe uma quadra com esse número no loteamento',
      );
    }
  }
}
