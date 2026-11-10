import type { Page, Pagination } from '../../../../shared/domain/pagination.js';
import type { PrismaTransaction } from '../../../../shared/infra/database/prisma.transaction.js';
import type { Planta, StatusPlanta } from '../models/planta.entity.js';

export const PLANTA_REPOSITORY = Symbol('PLANTA_REPOSITORY');

export interface PlantaFiltros {
  status?: StatusPlanta[];
}

export interface PlantaRepository {
  findById(id: string, tx?: PrismaTransaction): Promise<Planta | null>;
  list(filtros: PlantaFiltros, pagination: Pagination): Promise<Page<Planta>>;
  /**
   * Próximo número de versão. Bloqueia a numeração até o fim da transação,
   * para dois envios simultâneos não pegarem a mesma versão.
   */
  proximaVersao(tx: PrismaTransaction): Promise<number>;
  /** Planta exibida no mapa, se houver. */
  findAtiva(): Promise<Planta | null>;
  /**
   * Bloqueia a troca de planta ativa até o fim da transação e devolve a
   * ativa atual, para duas ativações simultâneas não se atropelarem.
   */
  travarAtiva(tx: PrismaTransaction): Promise<Planta | null>;
  create(planta: Planta, tx?: PrismaTransaction): Promise<void>;
  atualizarAtivacao(planta: Planta, tx: PrismaTransaction): Promise<void>;
  reenfileirar(planta: Planta, tx: PrismaTransaction): Promise<boolean>;
  /**
   * Retira da fila a planta ENVIADA mais antiga e a marca como PROCESSANDO
   * numa única operação atômica (`FOR UPDATE SKIP LOCKED`), para duas
   * instâncias da API nunca assumirem a mesma tentativa.
   */
  reservarProxima(): Promise<{ planta: Planta; tentativaId: string } | null>;
  /** Publica o resultado somente se a tentativa ainda possuir a planta. */
  finalizarProcessamento(planta: Planta, tentativaId: string): Promise<boolean>;
  /**
   * Marca como ERRO as plantas PROCESSANDO desde antes de `iniciadasAntesDe`
   * (processo encerrado no meio do trabalho). Devolve quantas marcou.
   */
  marcarInterrompidas(
    iniciadasAntesDe: Date,
    mensagem: string,
  ): Promise<number>;
}
