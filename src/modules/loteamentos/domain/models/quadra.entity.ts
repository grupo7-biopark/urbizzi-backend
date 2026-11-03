import { randomUUID } from 'node:crypto';

export interface QuadraProps {
  id: string;
  loteamentoId: string;
  numero: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateQuadraInput {
  loteamentoId: string;
  numero: string;
}

export interface UpdateQuadraInput {
  numero?: string;
}

export type QuadraAuditoria = Pick<QuadraProps, 'loteamentoId' | 'numero'>;

export class Quadra {
  private constructor(private props: QuadraProps) {}

  static create(input: CreateQuadraInput): Quadra {
    const now = new Date();
    return new Quadra({
      id: randomUUID(),
      loteamentoId: input.loteamentoId,
      numero: input.numero,
      createdAt: now,
      updatedAt: now,
    });
  }

  static restore(props: QuadraProps): Quadra {
    return new Quadra({ ...props });
  }

  get id() {
    return this.props.id;
  }

  get loteamentoId() {
    return this.props.loteamentoId;
  }

  get numero() {
    return this.props.numero;
  }

  get createdAt() {
    return this.props.createdAt;
  }

  get updatedAt() {
    return this.props.updatedAt;
  }

  get auditoria(): QuadraAuditoria {
    const { loteamentoId, numero } = this.props;
    return { loteamentoId, numero };
  }

  /** O número é obrigatório, então `null` nele é ignorado. */
  atualizar(input: UpdateQuadraInput): void {
    this.props = {
      ...this.props,
      ...(input.numero != null && { numero: input.numero }),
      updatedAt: new Date(),
    };
  }
}
