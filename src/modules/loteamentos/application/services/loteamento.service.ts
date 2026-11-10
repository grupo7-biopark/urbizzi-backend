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
import { Loteamento } from '../../domain/models/loteamento.entity.js';
import {
  LOTEAMENTO_REPOSITORY,
  type LoteamentoRepository,
} from '../../domain/repositories/loteamento.repository.interface.js';
import type { CreateLoteamentoDto } from '../dto/create-loteamento.dto.js';
import type { ListLoteamentosQueryDto } from '../dto/list-loteamentos-query.dto.js';
import { LoteamentoDto } from '../dto/loteamento.dto.js';
import type { UpdateLoteamentoDto } from '../dto/update-loteamento.dto.js';

const ENTIDADE_TIPO = 'Loteamento';

@Injectable()
export class LoteamentoService {
  constructor(
    @Inject(LOTEAMENTO_REPOSITORY)
    private readonly loteamentoRepository: LoteamentoRepository,
    private readonly transactionManager: TransactionManager,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  async create(
    dto: CreateLoteamentoDto,
    usuario: UsuarioAutenticado,
    transaction?: PrismaTransaction,
  ): Promise<LoteamentoDto> {
    await this.ensureNomeDisponivel(dto.nome);
    const loteamento = Loteamento.create(dto);
    const execute = async (tx: PrismaTransaction) => {
      await this.loteamentoRepository.create(loteamento, tx);
      await this.auditoriaService.registrar(
        {
          usuarioId: usuario.id,
          entidadeTipo: ENTIDADE_TIPO,
          entidadeId: loteamento.id,
          acao: 'CRIAR',
          valorNovo: loteamento.auditoria,
        },
        tx,
      );
    };
    if (transaction) await execute(transaction);
    else await this.transactionManager.run(execute);
    return LoteamentoDto.from(loteamento);
  }

  async findById(id: string): Promise<LoteamentoDto> {
    return LoteamentoDto.from(await this.getOrFail(id));
  }

  async list(
    query: ListLoteamentosQueryDto,
  ): Promise<PaginatedDto<LoteamentoDto>> {
    const { page, pageSize, ...filtros } = query;
    const result = await this.loteamentoRepository.list(filtros, {
      page,
      pageSize,
    });
    return PaginatedDto.of(
      { items: result.items.map(LoteamentoDto.from), total: result.total },
      { page, pageSize },
    );
  }

  async update(
    id: string,
    dto: UpdateLoteamentoDto,
    usuario: UsuarioAutenticado,
    transaction?: PrismaTransaction,
  ): Promise<LoteamentoDto> {
    const execute = async (tx: PrismaTransaction) => {
      const loteamento = await this.getOrFail(id, tx);
      if (dto.nome != null) await this.ensureNomeDisponivel(dto.nome, id);
      const anterior = loteamento.auditoria;
      loteamento.atualizar(dto);
      await this.loteamentoRepository.update(loteamento, tx);
      await this.auditoriaService.registrar(
        {
          usuarioId: usuario.id,
          entidadeTipo: ENTIDADE_TIPO,
          entidadeId: loteamento.id,
          acao: 'ALTERAR',
          valorAnterior: anterior,
          valorNovo: loteamento.auditoria,
        },
        tx,
      );
      return LoteamentoDto.from(loteamento);
    };
    return transaction
      ? execute(transaction)
      : this.transactionManager.run(execute);
  }

  async delete(id: string, usuario: UsuarioAutenticado): Promise<void> {
    await this.transactionManager.run(async (tx) => {
      const loteamento = await this.getOrFail(id, tx);
      if (await this.loteamentoRepository.hasQuadras(id, tx)) {
        throw new ConflictError(
          'LOTEAMENTO_COM_QUADRAS',
          'Não é possível excluir um loteamento com quadras cadastradas',
        );
      }
      await this.loteamentoRepository.delete(id, tx);
      await this.auditoriaService.registrar(
        {
          usuarioId: usuario.id,
          entidadeTipo: ENTIDADE_TIPO,
          entidadeId: id,
          acao: 'EXCLUIR',
          valorAnterior: loteamento.auditoria,
        },
        tx,
      );
    });
  }

  private async getOrFail(
    id: string,
    tx?: PrismaTransaction,
  ): Promise<Loteamento> {
    const loteamento = await this.loteamentoRepository.findById(id, tx);
    if (!loteamento) {
      throw new NotFoundError(
        'LOTEAMENTO_NAO_ENCONTRADO',
        'Loteamento não encontrado',
      );
    }
    return loteamento;
  }

  private async ensureNomeDisponivel(
    nome: string,
    ignoreId?: string,
  ): Promise<void> {
    if (await this.loteamentoRepository.existsByNome(nome, ignoreId)) {
      throw new ConflictError(
        'LOTEAMENTO_JA_EXISTE',
        'Já existe um loteamento com esse nome',
      );
    }
  }
}
