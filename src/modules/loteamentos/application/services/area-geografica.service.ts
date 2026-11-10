import { Inject, Injectable } from '@nestjs/common';
import { PaginatedDto } from '../../../../shared/application/dto/paginated.dto.js';
import {
  BusinessRuleError,
  NotFoundError,
} from '../../../../shared/domain/errors/domain.error.js';
import { TransactionManager } from '../../../../shared/infra/database/transaction.manager.js';
import type { PrismaTransaction } from '../../../../shared/infra/database/prisma.transaction.js';
import { AuditoriaService } from '../../../auditoria/application/services/auditoria.service.js';
import {
  validarVertices,
  exigirDentro,
  exigirSemSobreposicao,
} from '../../domain/models/area-geografica.js';
import {
  AREA_GEOGRAFICA_REPOSITORY,
  type AreaGeograficaRepository,
} from '../../domain/repositories/area-geografica.repository.interface.js';
import type {
  ListAreasGeograficasDto,
  SaveAreaGeograficaDto,
} from '../dto/area-geografica.dto.js';

@Injectable()
export class AreaGeograficaService {
  constructor(
    @Inject(AREA_GEOGRAFICA_REPOSITORY)
    private readonly repository: AreaGeograficaRepository,
    private readonly transactions: TransactionManager,
    private readonly auditoria: AuditoriaService,
  ) {}
  async list(query: ListAreasGeograficasDto) {
    return PaginatedDto.of(
      await this.repository.list(query.loteamentoId, query),
      query,
    );
  }
  async findById(id: string) {
    return { area: await this.repository.findById(id) };
  }
  /** Sempre antes do bloqueio cadastral, para manter a ordem entre PUT e cadastro composto. */
  async bloquear(
    tipo: 'LOTEAMENTO' | 'LOTE' | 'QUADRA',
    id: string,
    tx: PrismaTransaction,
  ) {
    const scope = await this.repository.scope(tipo, id, tx);
    if (!scope)
      throw new NotFoundError(
        'CADASTRO_GEOGRAFICO_NAO_ENCONTRADO',
        'Cadastro não encontrado.',
      );
    await this.repository.lock(scope, tx);
    return scope;
  }
  async save(
    tipo: 'LOTEAMENTO' | 'QUADRA' | 'LOTE',
    id: string,
    dto: SaveAreaGeograficaDto,
    usuarioId: string,
    transaction?: PrismaTransaction,
  ) {
    const vertices =
      dto.vertices === null ? null : validarVertices(dto.vertices);
    const execute = async (tx: PrismaTransaction) => {
      const scope = await this.bloquear(tipo, id, tx);
      // Revalida após o lock para não alterar um cadastro removido enquanto aguardava.
      if (!(await this.repository.scope(tipo, id, tx)))
        throw new NotFoundError(
          'CADASTRO_GEOGRAFICO_NAO_ENCONTRADO',
          'Cadastro não encontrado.',
        );
      const children = await this.repository.children(scope, tx);
      if (tipo === 'LOTE') {
        if (vertices) {
          const parent = await this.repository.findById(scope, tx);
          if (!parent)
            throw new BusinessRuleError(
              'LOTEAMENTO_SEM_DEMARCACAO',
              'Demarque primeiro a área do loteamento.',
            );
          exigirDentro(vertices, parent.vertices);
          const quadraId = await this.repository.quadraDoLote(id, tx);
          const quadra = quadraId
            ? await this.repository.findById(quadraId, tx)
            : null;
          if (!quadra)
            throw new BusinessRuleError(
              'QUADRA_SEM_DEMARCACAO',
              'Demarque primeiro a área da quadra escolhida.',
            );
          exigirDentro(
            vertices,
            quadra.vertices,
            'LOTE_FORA_DA_QUADRA',
            'A demarcação do lote deve ficar totalmente dentro da quadra escolhida.',
          );
          exigirSemSobreposicao(
            vertices,
            children
              .filter((a) => a.tipo === 'LOTE' && a.id !== id)
              .map((a) => a.vertices),
          );
        }
      } else if (tipo === 'QUADRA') {
        const lotes = children.filter(
          (a) => a.tipo === 'LOTE' && a.quadraId === id,
        );
        if (!vertices && lotes.length)
          throw new BusinessRuleError(
            'QUADRA_COM_DEMARCACOES',
            'Remova as demarcações dos lotes antes de remover o limite da quadra.',
          );
        if (vertices) {
          const parent = await this.repository.findById(scope, tx);
          if (!parent)
            throw new BusinessRuleError(
              'LOTEAMENTO_SEM_DEMARCACAO',
              'Demarque primeiro a área do loteamento.',
            );
          exigirDentro(
            vertices,
            parent.vertices,
            'QUADRA_FORA_DO_LOTEAMENTO',
            'A quadra deve ficar totalmente dentro do loteamento.',
          );
          exigirSemSobreposicao(
            vertices,
            children
              .filter((a) => a.tipo === 'QUADRA' && a.id !== id)
              .map((a) => a.vertices),
            'QUADRAS_SOBREPOSTAS',
            'A demarcação ocupa a área de outra quadra. Divisas compartilhadas são permitidas.',
          );
          exigirSemSobreposicao(
            vertices,
            children
              .filter((a) => a.tipo === 'LOTE' && a.quadraId !== id)
              .map((a) => a.vertices),
            'QUADRAS_SOBREPOSTAS',
            'A área contém um lote de outra quadra. Ajuste os limites antes de salvar.',
          );
          for (const lote of lotes)
            exigirDentro(
              lote.vertices,
              vertices,
              'LOTE_FORA_DA_QUADRA',
              'O novo limite da quadra deixaria um lote fora dela.',
            );
        }
      } else {
        if (!vertices && children.length)
          throw new BusinessRuleError(
            'LOTEAMENTO_COM_DEMARCACOES',
            'Remova as demarcações dos lotes antes de remover o limite do loteamento.',
          );
        if (vertices)
          for (const child of children) exigirDentro(child.vertices, vertices);
      }
      const before = await this.repository.findById(id, tx);
      if (vertices)
        await this.repository.save(
          { id, tipo, loteamentoId: scope, vertices },
          tx,
        );
      else await this.repository.remove(id, tx);
      await this.auditoria.registrar(
        {
          usuarioId,
          entidadeTipo: 'AreaGeografica',
          entidadeId: id,
          acao: 'DEMARCAR',
          valorAnterior: { quantidadeVertices: before?.vertices.length ?? 0 },
          valorNovo: { quantidadeVertices: vertices?.length ?? 0 },
        },
        tx,
      );
      return { area: await this.repository.findById(id, tx) };
    };
    return transaction ? execute(transaction) : this.transactions.run(execute);
  }
}
