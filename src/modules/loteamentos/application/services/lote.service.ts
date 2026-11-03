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
