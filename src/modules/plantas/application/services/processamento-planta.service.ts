import { createReadStream, createWriteStream } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Inject, Injectable } from '@nestjs/common';
import {
  STORAGE,
  type Storage,
} from '../../../../shared/application/storage/storage.interface.js';
import { DomainError } from '../../../../shared/domain/errors/domain.error.js';
import {
  calcularPiramide,
  type PiramideTiles,
} from '../../domain/models/piramide-tiles.entity.js';
import type {
  Planta,
  StatusPlanta,
} from '../../domain/models/planta.entity.js';
import {
  PLANTA_REPOSITORY,
  type PlantaRepository,
} from '../../domain/repositories/planta.repository.interface.js';
import {
  PROCESSADOR_IMAGEM,
  type ProcessadorImagem,
} from '../../domain/repositories/processador-imagem.interface.js';

export const TAMANHO_TILE = 256;
/** Processamento parado há mais tempo que isso é considerado interrompido. */
export const TEMPO_MAXIMO_PROCESSAMENTO_MS = 30 * 60 * 1000;
/** Tiles enviados ao armazenamento ao mesmo tempo. */
const ENVIOS_SIMULTANEOS = 8;

const MENSAGEM_INTERROMPIDO =
  'O processamento foi interrompido antes de terminar. Reprocesse a planta.';
const MENSAGEM_FALHA =
  'Não foi possível gerar os tiles da planta. Verifique as imagens enviadas e reprocesse.';

export interface ResultadoProcessamento {
  plantaId: string;
  status: Extract<StatusPlanta, 'PRONTA' | 'ERRO'>;
  /** Erro original, para o worker registrar no log (não vai para a API). */
  erro?: unknown;
}

/**
 * Consome a fila de plantas ENVIADA: baixa os originais, gera a pirâmide de
 * tiles e publica somente o prefixo da tentativa que ainda possui a planta.
 */
@Injectable()
export class ProcessamentoPlantaService {
  constructor(
    @Inject(PLANTA_REPOSITORY)
    private readonly plantaRepository: PlantaRepository,
    @Inject(PROCESSADOR_IMAGEM)
    private readonly processadorImagem: ProcessadorImagem,
    @Inject(STORAGE) private readonly storage: Storage,
  ) {}

  /**
   * Devolve null se a fila estiver vazia ou a tentativa perder a reserva.
   * Uma falha de processamento só marca ERRO enquanto a tentativa for dona.
   */
  async processarProxima(): Promise<ResultadoProcessamento | null> {
    await this.plantaRepository.marcarInterrompidas(
      new Date(Date.now() - TEMPO_MAXIMO_PROCESSAMENTO_MS),
      MENSAGEM_INTERROMPIDO,
    );
    const tentativa = await this.plantaRepository.reservarProxima();
    if (!tentativa) return null;
    const { planta, tentativaId } = tentativa;

    let pasta: string | undefined;
    let resultado: ResultadoProcessamento;
    try {
      try {
        pasta = await mkdtemp(join(tmpdir(), 'urbizzi-planta-'));
        await this.processar(
          planta,
          pasta,
          `plantas/${planta.id}/${tentativaId}`,
        );
        resultado = { plantaId: planta.id, status: 'PRONTA' };
      } catch (erro) {
        planta.falharProcessamento(
          erro instanceof DomainError ? erro.message : MENSAGEM_FALHA,
        );
        resultado = { plantaId: planta.id, status: 'ERRO', erro };
      }
      const publicado = await this.plantaRepository.finalizarProcessamento(
        planta,
        tentativaId,
      );
      return publicado ? resultado : null;
    } finally {
      if (pasta) await rm(pasta, { recursive: true, force: true });
    }
  }

  private async processar(
    planta: Planta,
    pasta: string,
    tilesPath: string,
  ): Promise<void> {
    const arquivos: string[] = [];
    for (const [i, chave] of planta.originais.entries()) {
      const arquivo = join(pasta, `original-${i}`);
      await pipeline(
        await this.storage.download('originais', chave),
        createWriteStream(arquivo),
      );
      arquivos.push(arquivo);
    }

    const destino = join(pasta, 'tiles');
    const { largura, altura } = await this.processadorImagem.gerarTiles(
      arquivos,
      planta.gradeColunas,
      destino,
      TAMANHO_TILE,
    );
    const piramide = calcularPiramide(largura, altura, TAMANHO_TILE);
    await this.enviarTiles(piramide, destino, tilesPath);

    planta.concluirProcessamento({
      larguraPx: largura,
      alturaPx: altura,
      maxZoom: piramide.maxZoom,
      tamanhoTile: TAMANHO_TILE,
      tilesPath,
    });
  }

  /** Envia todos os tiles esperados pela pirâmide; falta de algum é erro. */
  private async enviarTiles(
    piramide: PiramideTiles,
    destino: string,
    tilesPath: string,
  ): Promise<void> {
    const tiles: { arquivo: string; chave: string }[] = [];
    for (const { zoom, colunas, linhas } of piramide.niveis) {
      for (let y = 0; y < linhas; y++) {
        for (let x = 0; x < colunas; x++) {
          tiles.push({
            arquivo: join(destino, `${zoom}`, `${y}`, `${x}.webp`),
            chave: `${tilesPath}/${zoom}/${x}/${y}.webp`,
          });
        }
      }
    }
    let proximo = 0;
    let falhou = false;
    const enviar = async () => {
      while (!falhou && proximo < tiles.length) {
        const { arquivo, chave } = tiles[proximo++];
        try {
          await this.storage.upload({
            bucket: 'tiles',
            key: chave,
            body: createReadStream(arquivo),
            contentType: 'image/webp',
          });
        } catch (erro) {
          falhou = true;
          throw erro;
        }
      }
    };
    // Os uploads em andamento ainda leem os temporários após uma falha.
    // Aguarde todos antes de propagar o erro e permitir a limpeza da pasta.
    const resultados = await Promise.allSettled(
      Array.from({ length: ENVIOS_SIMULTANEOS }, enviar),
    );
    const falha = resultados.find(
      (resultado) => resultado.status === 'rejected',
    );
    if (falha?.status === 'rejected') throw falha.reason;
  }
}
