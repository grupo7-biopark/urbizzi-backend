/** Valor de uma célula lida da planilha; números chegam como texto. */
export type CelulaPlanilha = string | boolean | null;

export const COLUNAS_IMPORTACAO = [
  'loteamento',
  'quadra',
  'numero',
  'area_m2',
  'valor',
  'exibir_valor',
] as const;

export type ColunaImportacao = (typeof COLUNAS_IMPORTACAO)[number];

const COLUNAS_OBRIGATORIAS: ColunaImportacao[] = [
  'loteamento',
  'quadra',
  'numero',
  'area_m2',
];

// Nomes aceitos no cabeçalho, já normalizados (sem acento, espaço ou símbolo)
const ALIASES: Record<ColunaImportacao, string[]> = {
  loteamento: ['loteamento'],
  quadra: ['quadra'],
  numero: ['numero', 'lote', 'numerolote'],
  area_m2: ['aream2', 'area'],
  valor: ['valor', 'preco'],
  exibir_valor: ['exibirvalor', 'exibirvalorpublico'],
};

const VERDADEIRO = ['sim', 's', 'true', 'verdadeiro', '1', 'x'];
const FALSO = ['nao', 'n', 'false', 'falso', '0', ''];

export type IndicesColunas = Partial<Record<ColunaImportacao, number>>;

export interface ErroLinhaImportacao {
  linha: number;
  mensagens: string[];
}

export interface LinhaImportacaoProps {
  linha: number;
  loteamento: string;
  quadra: string;
  numero: string;
  areaM2: string;
  valor: string | null;
  exibirValorPublico: boolean;
}

export type ResultadoValidacaoLinha =
  | { linha: LinhaImportacao; erro?: undefined }
  | { linha?: undefined; erro: ErroLinhaImportacao };

/**
 * Uma linha válida da planilha de importação de lotes (BE-17). A validação
 * fica aqui, sem depender do formato do arquivo (CSV ou XLSX).
 */
export class LinhaImportacao {
  private constructor(private readonly props: LinhaImportacaoProps) {}

  /**
   * Localiza as colunas no cabeçalho, sem diferenciar maiúsculas, acentos e
   * separadores (`Área (m²)` vale como `area_m2`). Devolve as obrigatórias
   * que faltam.
   */
  static mapearCabecalho(cabecalho: CelulaPlanilha[]): {
    indices: IndicesColunas;
    faltando: ColunaImportacao[];
  } {
    const indices: IndicesColunas = {};
    cabecalho.forEach((celula, indice) => {
      const nome = normalizarNome(texto(celula));
      const coluna = COLUNAS_IMPORTACAO.find((c) => ALIASES[c].includes(nome));
      if (coluna && indices[coluna] === undefined) indices[coluna] = indice;
    });
    const faltando = COLUNAS_OBRIGATORIAS.filter(
      (c) => indices[c] === undefined,
    );
    return { indices, faltando };
  }

  static linhaVazia(celulas: CelulaPlanilha[]): boolean {
    return celulas.every((celula) => texto(celula) === '');
  }

  static validar(
    linha: number,
    celulas: CelulaPlanilha[],
    indices: IndicesColunas,
  ): ResultadoValidacaoLinha {
    const valor = (coluna: ColunaImportacao): CelulaPlanilha => {
      const indice = indices[coluna];
      return indice === undefined ? null : (celulas[indice] ?? null);
    };
    const mensagens: string[] = [];
    const obrigatorio = (coluna: ColunaImportacao, max: number): string => {
      const conteudo = texto(valor(coluna));
      if (conteudo === '') mensagens.push(`${coluna} é obrigatório`);
      else if (conteudo.length > max) {
        mensagens.push(`${coluna} deve ter no máximo ${max} caracteres`);
      }
      return conteudo;
    };
    const decimalPositivo = (
      coluna: ColunaImportacao,
      digitosInteiros: number,
    ): string | null => {
      const conteudo = texto(valor(coluna));
      if (conteudo === '') return null;
      const decimal = paraDecimal(conteudo, digitosInteiros);
      if (decimal === null) {
        mensagens.push(
          `${coluna} deve ser um número positivo com até ${digitosInteiros} dígitos inteiros e 2 casas decimais`,
        );
      }
      return decimal;
    };

    const loteamento = obrigatorio('loteamento', 150);
    const quadra = obrigatorio('quadra', 20);
    const numero = obrigatorio('numero', 20);
    const areaM2 = decimalPositivo('area_m2', 10);
    if (texto(valor('area_m2')) === '') mensagens.push('area_m2 é obrigatório');
    const preco = decimalPositivo('valor', 12);
    const exibir = paraBooleano(valor('exibir_valor'));
    if (exibir === null) mensagens.push('exibir_valor deve ser sim ou não');

    if (mensagens.length > 0) return { erro: { linha, mensagens } };
    return {
      linha: new LinhaImportacao({
        linha,
        loteamento,
        quadra,
        numero,
        areaM2: areaM2 as string,
        valor: preco,
        exibirValorPublico: exibir as boolean,
      }),
    };
  }

  get linha() {
    return this.props.linha;
  }

  get loteamento() {
    return this.props.loteamento;
  }

  get quadra() {
    return this.props.quadra;
  }

  get numero() {
    return this.props.numero;
  }

  get areaM2() {
    return this.props.areaM2;
  }

  get valor() {
    return this.props.valor;
  }

  get exibirValorPublico() {
    return this.props.exibirValorPublico;
  }

  /** Identifica o lote sem diferenciar maiúsculas (RN21). */
  get chave(): string {
    return [this.loteamento, this.quadra, this.numero]
      .map((parte) => parte.toLowerCase())
      .join('\u0000');
  }
}

function texto(celula: CelulaPlanilha): string {
  return celula === null ? '' : String(celula).trim();
}

function normalizarNome(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/²/g, '2')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Aceita ponto ou vírgula decimal (`360.5`, `360,50`, `1.234,56`). Com
 * vírgula, os pontos são separadores de milhar. Devolve o decimal com ponto,
 * ou `null` se não for positivo ou exceder os dígitos.
 */
function paraDecimal(conteudo: string, digitosInteiros: number): string | null {
  const normalizado = conteudo.includes(',')
    ? conteudo.replace(/\./g, '').replace(',', '.')
    : conteudo;
  const formato = new RegExp(
    `^(?!0+(?:\\.0+)?$)\\d{1,${digitosInteiros}}(?:\\.\\d{1,2})?$`,
  );
  return formato.test(normalizado) ? normalizado : null;
}

function paraBooleano(celula: CelulaPlanilha): boolean | null {
  if (typeof celula === 'boolean') return celula;
  const nome = normalizarNome(texto(celula));
  if (VERDADEIRO.includes(nome)) return true;
  if (FALSO.includes(nome)) return false;
  return null;
}
