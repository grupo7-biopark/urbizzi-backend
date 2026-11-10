import { Inject, Injectable } from '@nestjs/common';
import {
  ConflictError,
  NotFoundError,
} from '../../../../shared/domain/errors/domain.error.js';
import { TransactionManager } from '../../../../shared/infra/database/transaction.manager.js';
import { PaginatedDto } from '../../../../shared/application/dto/paginated.dto.js';
import type { Pagination } from '../../../../shared/domain/pagination.js';
import { PlantaService } from '../../../plantas/application/services/planta.service.js';
import { LoteService } from '../../../loteamentos/application/services/lote.service.js';
import { AuditoriaService } from '../../../auditoria/application/services/auditoria.service.js';
import { Marcador } from '../../domain/models/marcador.entity.js';
import {
  MARCADOR_REPOSITORY,
  type MarcadorRepository,
} from '../../domain/repositories/marcador.repository.interface.js';
import { MarcadorDto } from '../dto/marcador.dto.js';
import type {
  CreateMarcadorDto,
  CoordenadasMarcadorDto,
} from '../dto/create-marcador.dto.js';
import type {
  LotesSemMarcadorQueryDto,
  LoteSemMarcadorDto,
} from '../dto/lotes-sem-marcador.dto.js';
@Injectable()
export class MarcadorService {
  constructor(
    @Inject(MARCADOR_REPOSITORY)
    private readonly repository: MarcadorRepository,
    private readonly plantas: PlantaService,
    private readonly lotes: LoteService,
    private readonly transactions: TransactionManager,
    private readonly auditoria: AuditoriaService,
  ) {}
  async list(
    plantaId: string,
    query: Pagination,
  ): Promise<PaginatedDto<MarcadorDto>> {
    await this.plantas.findById(plantaId);
    const result = await this.repository.list(plantaId, query);
    return PaginatedDto.of(
      { items: result.items.map(MarcadorDto.from), total: result.total },
      query,
    );
  }
  async semMarcador(
    plantaId: string,
    query: LotesSemMarcadorQueryDto,
  ): Promise<PaginatedDto<LoteSemMarcadorDto>> {
    await this.plantas.findById(plantaId);
    const result = await this.lotes.listExcluindo(
      await this.repository.loteIds(plantaId),
      query,
    );
    return {
      ...result,
      data: result.data.map(({ id, numero, quadraId, loteamentoId }) => ({
        id,
        numero,
        quadraId,
        loteamentoId,
      })),
    };
  }
  async create(
    plantaId: string,
    dto: CreateMarcadorDto,
    ator: string,
  ): Promise<MarcadorDto> {
    return (await this.createMany(plantaId, [dto], ator))[0];
  }
  async createMany(
    plantaId: string,
    inputs: CreateMarcadorDto[],
    ator: string,
  ): Promise<MarcadorDto[]> {
    await this.plantas.findById(plantaId);
    if (new Set(inputs.map((input) => input.loteId)).size !== inputs.length)
      throw new ConflictError(
        'MARCADOR_DUPLICADO',
        'Lote repetido na mesma requisição',
      );
    for (const input of inputs) await this.lotes.findById(input.loteId);
    const marcadores = inputs.map((input) =>
      Marcador.create({ ...input, plantaId }),
    );
    await this.transactions.run(async (tx) => {
      await this.repository.createMany(marcadores, tx);
      await this.auditoria.registrarVarios(
        marcadores.map((marcador) => ({
          usuarioId: ator,
          entidadeTipo: 'Marcador',
          entidadeId: marcador.dados.id,
          acao: 'CRIAR',
          valorNovo: { ...marcador.dados },
        })),
        tx,
      );
    });
    return marcadores.map(MarcadorDto.from);
  }
  async mover(
    plantaId: string,
    id: string,
    dto: CoordenadasMarcadorDto,
    ator: string,
  ): Promise<MarcadorDto> {
    await this.plantas.findById(plantaId);
    return this.transactions.run(async (tx) => {
      const marcador = await this.repository.find(plantaId, id, tx);
      if (!marcador)
        throw new NotFoundError(
          'MARCADOR_NAO_ENCONTRADO',
          'Marcador não encontrado nesta planta',
        );
      const anterior = marcador.dados;
      marcador.mover(dto);
      await this.repository.update(marcador, tx);
      await this.auditoria.registrar(
        {
          usuarioId: ator,
          entidadeTipo: 'Marcador',
          entidadeId: id,
          acao: 'MOVER',
          valorAnterior: { ...anterior },
          valorNovo: { ...marcador.dados },
        },
        tx,
      );
      return MarcadorDto.from(marcador);
    });
  }
  async revisar(
    plantaId: string,
    id: string,
    ator: string,
  ): Promise<MarcadorDto> {
    return this.transactions.run(async (tx) => {
      const marcador = await this.repository.find(plantaId, id, tx);
      if (!marcador)
        throw new NotFoundError(
          'MARCADOR_NAO_ENCONTRADO',
          'Marcador não encontrado nesta planta',
        );
      if (marcador.dados.revisar) {
        marcador.confirmarRevisao();
        await this.repository.update(marcador, tx);
        await this.auditoria.registrar(
          {
            usuarioId: ator,
            entidadeTipo: 'Marcador',
            entidadeId: id,
            acao: 'REVISAR',
            valorAnterior: { revisar: true },
            valorNovo: { revisar: false },
          },
          tx,
        );
      }
      return MarcadorDto.from(marcador);
    });
  }
  async delete(plantaId: string, id: string, ator: string): Promise<void> {
    await this.plantas.findById(plantaId);
    await this.transactions.run(async (tx) => {
      const marcador = await this.repository.find(plantaId, id, tx);
      if (!marcador)
        throw new NotFoundError(
          'MARCADOR_NAO_ENCONTRADO',
          'Marcador não encontrado nesta planta',
        );
      await this.repository.delete(id, tx);
      await this.auditoria.registrar(
        {
          usuarioId: ator,
          entidadeTipo: 'Marcador',
          entidadeId: id,
          acao: 'EXCLUIR',
          valorAnterior: { ...marcador.dados },
        },
        tx,
      );
    });
  }
}
