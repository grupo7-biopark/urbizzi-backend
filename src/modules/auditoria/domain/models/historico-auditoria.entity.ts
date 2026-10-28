import { randomUUID } from 'node:crypto';

export type ValorAuditoria =
  | string
  | number
  | boolean
  | null
  | ValorAuditoria[]
  | { [chave: string]: ValorAuditoria };
export interface RegistrarAuditoriaInput {
  usuarioId?: string | null;
  entidadeTipo: string;
  entidadeId: string;
  acao: string;
  valorAnterior?: ValorAuditoria;
  valorNovo?: ValorAuditoria;
  motivo?: string | null;
}
export interface HistoricoAuditoriaProps extends RegistrarAuditoriaInput {
  id: string;
  createdAt: Date;
}

function mascarar(valor: ValorAuditoria): ValorAuditoria {
  if (Array.isArray(valor)) return valor.map(mascarar);
  if (valor === null || typeof valor !== 'object') return valor;
  return Object.fromEntries(
    Object.entries(valor).map(([chave, conteudo]) => [
      chave,
      /senha|password|token|secret|authorization|cookie|cpf|cnpj|documento|email|telefone/i.test(
        chave.replace(/[_-]/g, ''),
      )
        ? '[MASCARADO]'
        : mascarar(conteudo),
    ]),
  );
}

export class HistoricoAuditoria {
  private constructor(private readonly props: HistoricoAuditoriaProps) {}
  static create(input: RegistrarAuditoriaInput): HistoricoAuditoria {
    return new HistoricoAuditoria({
      ...input,
      id: randomUUID(),
      createdAt: new Date(),
      valorAnterior: mascarar(input.valorAnterior ?? null),
      valorNovo: mascarar(input.valorNovo ?? null),
    });
  }
  static restore(props: HistoricoAuditoriaProps): HistoricoAuditoria {
    return new HistoricoAuditoria(structuredClone(props));
  }
  get id() {
    return this.props.id;
  }
  get usuarioId() {
    return this.props.usuarioId ?? null;
  }
  get entidadeTipo() {
    return this.props.entidadeTipo;
  }
  get entidadeId() {
    return this.props.entidadeId;
  }
  get acao() {
    return this.props.acao;
  }
  get valorAnterior() {
    return structuredClone(this.props.valorAnterior ?? null);
  }
  get valorNovo() {
    return structuredClone(this.props.valorNovo ?? null);
  }
  get motivo() {
    return this.props.motivo ?? null;
  }
  get createdAt() {
    return new Date(this.props.createdAt);
  }
}
