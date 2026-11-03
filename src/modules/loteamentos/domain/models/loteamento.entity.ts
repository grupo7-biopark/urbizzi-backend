import { randomUUID } from 'node:crypto';

export interface LoteamentoProps {
  id: string;
  nome: string;
  descricao: string | null;
  localizacao: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateLoteamentoInput {
  nome: string;
  descricao?: string | null;
  localizacao?: string | null;
}

export type UpdateLoteamentoInput = Partial<CreateLoteamentoInput>;

/** Campos registrados no histórico de auditoria. */
export type LoteamentoAuditoria = Pick<
  LoteamentoProps,
  'nome' | 'descricao' | 'localizacao'
>;

export class Loteamento {
  private constructor(private props: LoteamentoProps) {}

  static create(input: CreateLoteamentoInput): Loteamento {
    const now = new Date();
    return new Loteamento({
      id: randomUUID(),
      nome: input.nome,
      descricao: input.descricao ?? null,
      localizacao: input.localizacao ?? null,
      createdAt: now,
      updatedAt: now,
    });
  }

  static restore(props: LoteamentoProps): Loteamento {
    return new Loteamento({ ...props });
  }

  get id() {
    return this.props.id;
  }

  get nome() {
    return this.props.nome;
  }

  get descricao() {
    return this.props.descricao;
  }

  get localizacao() {
    return this.props.localizacao;
  }

  get createdAt() {
    return this.props.createdAt;
  }

  get updatedAt() {
    return this.props.updatedAt;
  }

  get auditoria(): LoteamentoAuditoria {
    const { nome, descricao, localizacao } = this.props;
    return { nome, descricao, localizacao };
  }

  /**
   * Atualiza só os campos informados. `null` limpa descrição e localização;
   * o nome é obrigatório, então `null` nele é ignorado.
   */
  atualizar(input: UpdateLoteamentoInput): void {
    this.props = {
      ...this.props,
      ...(input.nome != null && { nome: input.nome }),
      ...(input.descricao !== undefined && { descricao: input.descricao }),
      ...(input.localizacao !== undefined && {
        localizacao: input.localizacao,
      }),
      updatedAt: new Date(),
    };
  }
}
