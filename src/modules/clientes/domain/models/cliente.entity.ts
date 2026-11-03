import { randomUUID } from 'node:crypto';
import { BusinessRuleError } from '../../../../shared/domain/errors/domain.error.js';
import { documentoValido, normalizarDocumento } from './documento.js';
export interface ClienteInput {
  nome: string;
  documento: string;
  telefone?: string | null;
  email?: string | null;
  observacoes?: string | null;
}
export interface ClienteProps {
  id: string;
  nome: string;
  documento: string;
  telefone: string | null;
  email: string | null;
  observacoes: string | null;
  createdAt: Date;
  updatedAt: Date;
}
export class Cliente {
  private constructor(private props: ClienteProps) {}
  static create(input: ClienteInput): Cliente {
    const now = new Date();
    return new Cliente({
      id: randomUUID(),
      ...Cliente.normalizar(input),
      createdAt: now,
      updatedAt: now,
    });
  }
  static restore(props: ClienteProps): Cliente {
    return new Cliente({ ...props });
  }
  private static normalizar(input: ClienteInput) {
    if (!input.nome.trim())
      throw new BusinessRuleError(
        'NOME_CLIENTE_INVALIDO',
        'Informe o nome do cliente',
      );
    if (!documentoValido(input.documento))
      throw new BusinessRuleError('DOCUMENTO_INVALIDO', 'Documento inválido');
    return {
      nome: input.nome.trim(),
      documento: normalizarDocumento(input.documento),
      telefone: input.telefone?.trim() || null,
      email: input.email?.trim().toLowerCase() || null,
      observacoes: input.observacoes?.trim() || null,
    };
  }
  atualizar(input: Partial<ClienteInput>): void {
    this.props = {
      ...this.props,
      ...Cliente.normalizar({
        ...this.props,
        ...Object.fromEntries(
          Object.entries(input).filter(([, value]) => value !== undefined),
        ),
      }),
      updatedAt: new Date(),
    };
  }
  get dados(): ClienteProps {
    return { ...this.props };
  }
  get id() {
    return this.props.id;
  }
  get documento() {
    return this.props.documento;
  }
  get auditoria() {
    return {
      nome: '[MASCARADO]',
      documento: '[MASCARADO]',
      telefone: this.props.telefone === null ? null : '[MASCARADO]',
      email: this.props.email === null ? null : '[MASCARADO]',
      observacoes: this.props.observacoes === null ? null : '[MASCARADO]',
    };
  }
}
