import { createReadStream } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { PaginatedDto } from '../../../../shared/application/dto/paginated.dto.js';
import {
  STORAGE,
  type Storage,
} from '../../../../shared/application/storage/storage.interface.js';
import {
  BusinessRuleError,
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
  ) {}

  /**
   * Valida a imagem única ou a grade de fatias, envia os originais ao
   * armazenamento em streaming e registra a planta como ENVIADA.
   */
  async enviar(
    nome: string,
    arquivos: ArquivoPlanta[],
    usuario: UsuarioAutenticado,
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
        await this.auditoriaService.registrar(
          {
            usuarioId: usuario.id,
            entidadeTipo: ENTIDADE_TIPO,
            entidadeId: nova.id,
            acao: 'CRIAR',
            valorNovo: { ...nova.auditoria },
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
