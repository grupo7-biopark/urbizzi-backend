import { CopiaMarcadoresService } from '../../../mapa/application/services/copia-marcadores.service.js';
import { createReadStream } from 'node:fs';
import { randomUUID } from 'node:crypto';
import type { Readable } from 'node:stream';
import { Inject, Injectable } from '@nestjs/common';
import { PaginatedDto } from '../../../../shared/application/dto/paginated.dto.js';
import {
  STORAGE,
  type Storage,
} from '../../../../shared/application/storage/storage.interface.js';
import {
  BusinessRuleError,
  ConflictError,
  InvalidInputError,
  NotFoundError,
} from '../../../../shared/domain/errors/domain.error.js';
import type { UsuarioAutenticado } from '../../../../shared/domain/usuario-autenticado.js';
import type { PrismaTransaction } from '../../../../shared/infra/database/prisma.transaction.js';
import { TransactionManager } from '../../../../shared/infra/database/transaction.manager.js';
import { AuditoriaService } from '../../../auditoria/application/services/auditoria.service.js';
import {
  GradeFatias,
  nomeFatia,
  type PosicaoFatia,
} from '../../domain/models/grade-fatias.entity.js';
import { calcularPiramide } from '../../domain/models/piramide-tiles.entity.js';
import { Planta } from '../../domain/models/planta.entity.js';
import {
  PLANTA_REPOSITORY,
  type PlantaRepository,
} from '../../domain/repositories/planta.repository.interface.js';
import {
  PROCESSADOR_IMAGEM,
  type FormatoImagem,
  type ProcessadorImagem,
} from '../../domain/repositories/processador-imagem.interface.js';
import type { ListPlantasQueryDto } from '../dto/list-plantas-query.dto.js';
import { PlantaAtivaDto } from '../dto/planta-ativa.dto.js';
import { PlantaDto } from '../dto/planta.dto.js';

const ENTIDADE_TIPO = 'Planta';

/**
 * Limite de pixels da imagem completa (o mesmo padrão do libvips). A planta
 * real tem cerca de 138 megapixels.
 */
export const PIXELS_MAXIMOS = 268_402_689;

const EXTENSAO: Record<FormatoImagem, string> = { png: 'png', jpeg: 'jpg' };
const CONTENT_TYPE: Record<FormatoImagem, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
};

/** Arquivo recebido no upload, já gravado em disco temporário. */
export interface ArquivoPlanta {
  nome: string;
  caminho: string;
}

@Injectable()
export class PlantaService {
  constructor(
    @Inject(PLANTA_REPOSITORY)
    private readonly plantaRepository: PlantaRepository,
    @Inject(PROCESSADOR_IMAGEM)
    private readonly processadorImagem: ProcessadorImagem,
    @Inject(STORAGE) private readonly storage: Storage,
    private readonly transactionManager: TransactionManager,
    private readonly auditoriaService: AuditoriaService,
    private readonly marcadores: CopiaMarcadoresService,
  ) {}

  /**
   * Valida a imagem única ou a grade de fatias, envia os originais ao
   * armazenamento em streaming e registra a planta como ENVIADA.
   */
  async enviar(
    nome: string,
    arquivos: ArquivoPlanta[],
    usuario: UsuarioAutenticado,
    copiarMarcadores = false,
  ): Promise<PlantaDto> {
    const grade = GradeFatias.montar(await this.lerImagens(arquivos));
    if (grade.larguraTotal * grade.alturaTotal > PIXELS_MAXIMOS) {
      throw new BusinessRuleError(
        'PLANTA_MUITO_GRANDE',
        `A planta completa tem ${grade.larguraTotal} x ${grade.alturaTotal} px e excede o limite de ${PIXELS_MAXIMOS} pixels`,
      );
    }

    const id = randomUUID();
    const originais = grade.fatias.map((fatia) =>
      this.chaveOriginal(id, fatia, grade.imagemUnica),
    );
    try {
      for (const [i, fatia] of grade.fatias.entries()) {
        await this.storage.upload({
          bucket: 'originais',
          key: originais[i],
          body: createReadStream(fatia.caminho),
          contentType: CONTENT_TYPE[fatia.formato],
        });
      }
      const planta = await this.transactionManager.run(async (tx) => {
        const nova = Planta.create({
          id,
          nome,
          versao: await this.plantaRepository.proximaVersao(tx),
          gradeLinhas: grade.linhas,
          gradeColunas: grade.colunas,
          originais,
          criadoPorId: usuario.id,
        });
        await this.plantaRepository.create(nova, tx);
        let copia;
        if (copiarMarcadores) {
          const origem = await this.plantaRepository.travarAtiva(tx);
          if (!origem)
            throw new NotFoundError(
              'PLANTA_ATIVA_NAO_ENCONTRADA',
              'Nenhuma planta ativa para copiar os marcadores',
            );
          const mudouProporcao =
            !origem.larguraPx ||
            !origem.alturaPx ||
            origem.larguraPx * grade.alturaTotal !==
              origem.alturaPx * grade.larguraTotal;
          const quantidade = await this.marcadores.copiar(
            origem.id,
            nova.id,
            mudouProporcao,
            tx,
          );
          copia = { plantaOrigemId: origem.id, quantidade, mudouProporcao };
        }
        await this.auditoriaService.registrar(
          {
            usuarioId: usuario.id,
            entidadeTipo: ENTIDADE_TIPO,
            entidadeId: nova.id,
            acao: 'CRIAR',
            valorNovo: { ...nova.auditoria, ...(copia && { copia }) },
          },
          tx,
        );
        return nova;
      });
      return PlantaDto.from(planta);
    } catch (error) {
      await this.removerOriginais(originais);
      throw error;
    }
  }

  /** Devolve uma planta com ERRO para a fila de processamento. */
  async reprocessar(
    id: string,
    usuario: UsuarioAutenticado,
  ): Promise<PlantaDto> {
    const planta = await this.transactionManager.run(async (tx) => {
      const atual = await this.getOrFail(id, tx);
      const anterior = { ...atual.auditoria };
      atual.reprocessar();
      if (!(await this.plantaRepository.reenfileirar(atual, tx))) {
        throw new ConflictError(
          'PLANTA_NAO_REPROCESSAVEL',
          'Só é possível reprocessar uma planta com erro',
        );
      }
      await this.auditoriaService.registrar(
        {
          usuarioId: usuario.id,
          entidadeTipo: ENTIDADE_TIPO,
          entidadeId: atual.id,
          acao: 'REPROCESSAR',
          valorAnterior: anterior,
          valorNovo: { ...atual.auditoria },
        },
        tx,
      );
      return atual;
    });
    return PlantaDto.from(planta);
  }

  /** Torna a planta PRONTA a exibida no mapa, desativando a anterior. */
  async ativar(id: string, usuario: UsuarioAutenticado): Promise<PlantaDto> {
    const planta = await this.transactionManager.run(async (tx) => {
      const anterior = await this.plantaRepository.travarAtiva(tx);
      const nova = await this.getOrFail(id, tx);
      if (anterior?.id === nova.id) return nova;
      nova.ativar();
      if (anterior) {
        anterior.desativar();
        await this.plantaRepository.atualizarAtivacao(anterior, tx);
        await this.auditoriaService.registrar(
          {
            usuarioId: usuario.id,
            entidadeTipo: ENTIDADE_TIPO,
            entidadeId: anterior.id,
            acao: 'DESATIVAR',
            valorAnterior: { ...anterior.auditoria, ativa: true },
            valorNovo: { ...anterior.auditoria },
          },
          tx,
        );
      }
      await this.plantaRepository.atualizarAtivacao(nova, tx);
      await this.auditoriaService.registrar(
        {
          usuarioId: usuario.id,
          entidadeTipo: ENTIDADE_TIPO,
          entidadeId: nova.id,
          acao: 'ATIVAR',
          valorAnterior: { ...nova.auditoria, ativa: false },
          valorNovo: { ...nova.auditoria },
        },
        tx,
      );
      return nova;
    });
    return PlantaDto.from(planta);
  }

  /** Planta exibida no mapa, com o modelo de URL dos tiles. */
  async ativa(): Promise<PlantaAtivaDto> {
    const planta = await this.plantaRepository.findAtiva();
    if (!planta) {
      throw new NotFoundError(
        'PLANTA_ATIVA_NAO_ENCONTRADA',
        'Nenhuma planta ativa no momento',
      );
    }
    return PlantaAtivaDto.from(planta);
  }

  /**
   * Conteúdo de um tile de planta PRONTA. Coordenadas fora da pirâmide
   * retornam 404 sem consultar o armazenamento.
   */
  async tile(id: string, z: number, x: number, y: number): Promise<Readable> {
    const planta = await this.plantaRepository.findById(id);
    const nivel =
      planta?.status === 'PRONTA' &&
      planta.larguraPx &&
      planta.alturaPx &&
      planta.tamanhoTile
        ? calcularPiramide(
            planta.larguraPx,
            planta.alturaPx,
            planta.tamanhoTile,
          ).niveis[z]
        : undefined;
    if (!planta || !nivel || x >= nivel.colunas || y >= nivel.linhas) {
      throw new NotFoundError('TILE_NAO_ENCONTRADO', 'Tile não encontrado');
    }
    return this.storage.download(
      'tiles',
      `${planta.tilesPath}/${z}/${x}/${y}.webp`,
    );
  }

  async findById(id: string): Promise<PlantaDto> {
    return PlantaDto.from(await this.getOrFail(id));
  }

  async list(query: ListPlantasQueryDto): Promise<PaginatedDto<PlantaDto>> {
    const { page, pageSize, ...filtros } = query;
    const result = await this.plantaRepository.list(filtros, {
      page,
      pageSize,
    });
    return PaginatedDto.of(
      { items: result.items.map(PlantaDto.from), total: result.total },
      { page, pageSize },
    );
  }

  private async getOrFail(id: string, tx?: PrismaTransaction): Promise<Planta> {
    const planta = await this.plantaRepository.findById(id, tx);
    if (!planta) {
      throw new NotFoundError('PLANTA_NAO_ENCONTRADA', 'Planta não encontrada');
    }
    return planta;
  }

  /** Lê formato e dimensões pelo conteúdo, sem confiar na extensão. */
  private async lerImagens(arquivos: ArquivoPlanta[]) {
    const imagens = [];
    const invalidas: string[] = [];
    for (const arquivo of arquivos) {
      const metadados = await this.processadorImagem.lerMetadados(
        arquivo.caminho,
      );
      if (metadados) imagens.push({ ...arquivo, ...metadados });
      else invalidas.push(arquivo.nome);
    }
    if (invalidas.length > 0) {
      throw new InvalidInputError(
        'PLANTA_FORMATO_INVALIDO',
        'A planta deve ser enviada em imagens PNG ou JPEG',
        [{ field: 'arquivos', messages: invalidas }],
      );
    }
    return imagens;
  }

  /** A chave é gerada pelo servidor; o nome enviado não entra no caminho. */
  private chaveOriginal(
    id: string,
    fatia: PosicaoFatia & { formato: FormatoImagem },
    imagemUnica: boolean,
  ): string {
    const nome = imagemUnica ? 'imagem' : nomeFatia(fatia);
    return `plantas/${id}/${nome}.${EXTENSAO[fatia.formato]}`;
  }

  private async removerOriginais(chaves: string[]): Promise<void> {
    await Promise.allSettled(
      chaves.map((chave) => this.storage.delete('originais', chave)),
    );
  }
}
