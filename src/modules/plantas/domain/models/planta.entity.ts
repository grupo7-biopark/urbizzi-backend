import { randomUUID } from 'node:crypto';

export type StatusPlanta = 'ENVIADA' | 'PROCESSANDO' | 'PRONTA' | 'ERRO';

export interface PlantaProps {
  id: string;
  nome: string;
  versao: number;
  status: StatusPlanta;
  larguraPx: number | null;
  alturaPx: number | null;
  tilesPath: string | null;
  maxZoom: number | null;
  gradeLinhas: number;
  gradeColunas: number;
  /** Chaves dos originais no armazenamento, linha a linha. */
  originais: string[];
  ativa: boolean;
  criadoPorId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePlantaInput {
  /** Gerado antes do envio para nomear os arquivos originais. */
  id?: string;
  nome: string;
  versao: number;
  gradeLinhas: number;
  gradeColunas: number;
  originais: string[];
  criadoPorId: string;
}

/** Campos registrados no histórico de auditoria. */
export interface PlantaAuditoria {
  nome: string;
  versao: number;
  status: StatusPlanta;
  ativa: boolean;
  grade: string;
}

export class Planta {
  private constructor(private props: PlantaProps) {}

  /** Nova planta, ENVIADA e aguardando processamento. */
  static create(input: CreatePlantaInput): Planta {
    const now = new Date();
    return new Planta({
      id: input.id ?? randomUUID(),
      nome: input.nome,
      versao: input.versao,
      status: 'ENVIADA',
      larguraPx: null,
      alturaPx: null,
      tilesPath: null,
      maxZoom: null,
      gradeLinhas: input.gradeLinhas,
      gradeColunas: input.gradeColunas,
      originais: [...input.originais],
      ativa: false,
      criadoPorId: input.criadoPorId,
      createdAt: now,
      updatedAt: now,
    });
  }

  static restore(props: PlantaProps): Planta {
    return new Planta({ ...props, originais: [...props.originais] });
  }

  get id() {
    return this.props.id;
  }

  get nome() {
    return this.props.nome;
  }

  get versao() {
    return this.props.versao;
  }

  get status() {
    return this.props.status;
  }

  get larguraPx() {
    return this.props.larguraPx;
  }

  get alturaPx() {
    return this.props.alturaPx;
  }

  get tilesPath() {
    return this.props.tilesPath;
  }

  get maxZoom() {
    return this.props.maxZoom;
  }

  get gradeLinhas() {
    return this.props.gradeLinhas;
  }

  get gradeColunas() {
    return this.props.gradeColunas;
  }

  get originais(): readonly string[] {
    return this.props.originais;
  }

  get ativa() {
    return this.props.ativa;
  }

  get criadoPorId() {
    return this.props.criadoPorId;
  }

  get createdAt() {
    return this.props.createdAt;
  }

  get updatedAt() {
    return this.props.updatedAt;
  }

  get auditoria(): PlantaAuditoria {
    const { nome, versao, status, ativa, gradeLinhas, gradeColunas } =
      this.props;
    return {
      nome,
      versao,
      status,
      ativa,
      grade: `${gradeLinhas} x ${gradeColunas}`,
    };
  }
}
