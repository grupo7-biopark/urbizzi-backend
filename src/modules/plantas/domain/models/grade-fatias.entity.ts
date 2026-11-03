import { InvalidInputError } from '../../../../shared/domain/errors/domain.error.js';

/** Imagem enviada, com as dimensões lidas do próprio arquivo. */
export interface ImagemEnviada {
  nome: string;
  largura: number;
  altura: number;
}

export interface PosicaoFatia {
  linha: number;
  coluna: number;
}

const NOME_FATIA = /^fatia_(\d{2})_(\d{2})\.[a-z0-9]+$/i;

/**
 * Lê a posição de uma fatia pelo nome `fatia_LL_CC.<ext>`, com linha e
 * coluna de dois dígitos começando em 01. Devolve null fora do padrão.
 */
export function lerNomeFatia(nome: string): PosicaoFatia | null {
  const match = NOME_FATIA.exec(nome);
  if (!match) return null;
  const linha = Number(match[1]);
  const coluna = Number(match[2]);
  if (linha < 1 || coluna < 1) return null;
  return { linha, coluna };
}

export function nomeFatia({ linha, coluna }: PosicaoFatia): string {
  const doisDigitos = (n: number) => String(n).padStart(2, '0');
  return `fatia_${doisDigitos(linha)}_${doisDigitos(coluna)}`;
}

/**
 * Grade da planta: uma imagem única (1 x 1) ou fatias completas de mesmas
 * dimensões, ordenadas linha a linha.
 */
export class GradeFatias<T extends ImagemEnviada> {
  private constructor(
    readonly linhas: number,
    readonly colunas: number,
    /** Fatias ordenadas linha a linha, da esquerda para a direita. */
    readonly fatias: (T & PosicaoFatia)[],
  ) {}

  get larguraTotal(): number {
    return this.fatias[0].largura * this.colunas;
  }

  get alturaTotal(): number {
    return this.fatias[0].altura * this.linhas;
  }

  get imagemUnica(): boolean {
    return this.fatias.length === 1;
  }

  /**
   * Monta a grade. Um arquivo fora do padrão de nome é tratado como imagem
   * única; com dois ou mais, todos precisam seguir `fatia_LL_CC`.
   */
  static montar<T extends ImagemEnviada>(imagens: T[]): GradeFatias<T> {
    if (imagens.length === 0) {
      throw new InvalidInputError(
        'ARQUIVO_OBRIGATORIO',
        'Envie a planta no campo arquivos',
      );
    }
    if (imagens.length === 1 && !lerNomeFatia(imagens[0].nome)) {
      return new GradeFatias(1, 1, [{ ...imagens[0], linha: 1, coluna: 1 }]);
    }

    const foraDoPadrao = imagens.filter((img) => !lerNomeFatia(img.nome));
    if (foraDoPadrao.length > 0) {
      throw new InvalidInputError(
        'PLANTA_NOME_FATIA_INVALIDO',
        'Ao enviar mais de um arquivo, todos devem se chamar fatia_LL_CC (ex.: fatia_01_02.png)',
        [{ field: 'arquivos', messages: foraDoPadrao.map((img) => img.nome) }],
      );
    }

    const porPosicao = new Map<string, T & PosicaoFatia>();
    const duplicadas = new Set<string>();
    for (const imagem of imagens) {
      const posicao = lerNomeFatia(imagem.nome)!;
      const nome = nomeFatia(posicao);
      if (porPosicao.has(nome)) duplicadas.add(nome);
      porPosicao.set(nome, { ...imagem, ...posicao });
    }
    if (duplicadas.size > 0) {
      throw new InvalidInputError(
        'PLANTA_FATIA_DUPLICADA',
        'Há mais de um arquivo para a mesma posição da grade',
        [{ field: 'arquivos', messages: [...duplicadas] }],
      );
    }

    const fatias = [...porPosicao.values()];
    const linhas = Math.max(...fatias.map((f) => f.linha));
    const colunas = Math.max(...fatias.map((f) => f.coluna));
    const ordenadas: (T & PosicaoFatia)[] = [];
    const faltantes: string[] = [];
    for (let linha = 1; linha <= linhas; linha++) {
      for (let coluna = 1; coluna <= colunas; coluna++) {
        const nome = nomeFatia({ linha, coluna });
        const fatia = porPosicao.get(nome);
        if (fatia) ordenadas.push(fatia);
        else faltantes.push(nome);
      }
    }
    if (faltantes.length > 0) {
      throw new InvalidInputError(
        'PLANTA_GRADE_INCOMPLETA',
        `A grade ${linhas} x ${colunas} está incompleta. Faltam: ${faltantes.join(', ')}`,
        [{ field: 'arquivos', messages: faltantes }],
      );
    }

    const [primeira] = ordenadas;
    const diferentes = ordenadas.filter(
      (f) => f.largura !== primeira.largura || f.altura !== primeira.altura,
    );
    if (diferentes.length > 0) {
      throw new InvalidInputError(
        'PLANTA_FATIAS_DIMENSOES_DIFERENTES',
        `Todas as fatias devem ter ${primeira.largura} x ${primeira.altura} px, como a ${nomeFatia(primeira)}`,
        [
          {
            field: 'arquivos',
            messages: diferentes.map(
              (f) => `${nomeFatia(f)}: ${f.largura} x ${f.altura} px`,
            ),
          },
        ],
      );
    }

    return new GradeFatias(linhas, colunas, ordenadas);
  }
}
