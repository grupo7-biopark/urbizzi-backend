import { randomUUID } from 'node:crypto';
import {
  ConflictError,
  BusinessRuleError,
} from '../../../../shared/domain/errors/domain.error.js';

export type StatusLote = 'DISPONIVEL' | 'RESERVADO' | 'VENDIDO' | 'BLOQUEADO';

/**
 * Decimais (área e valor) circulam como texto com 2 casas (`"360.00"`), sem
 * passar por `number`, para não perder precisão (docs/api-standards.md).
 */
export interface LoteProps {
  id: string;
  quadraId: string;
  /** Loteamento da quadra; só leitura, derivado de `quadraId`. */
  loteamentoId: string;
  numero: string;
  areaM2: string;
  valor: string | null;
  exibirValorPublico: boolean;
  status: StatusLote;
  observacoes: string | null;
  teveReserva: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateLoteInput {
  quadraId: string;
  loteamentoId: string;
  numero: string;
  areaM2: string;
  valor?: string | null;
  exibirValorPublico?: boolean;
  observacoes?: string | null;
}

export type UpdateLoteInput = Partial<
  Pick<
    CreateLoteInput,
    'numero' | 'areaM2' | 'valor' | 'exibirValorPublico' | 'observacoes'
  >
>;

export type LoteAuditoria = Pick<
  LoteProps,
  | 'quadraId'
  | 'numero'
  | 'areaM2'
  | 'valor'
  | 'exibirValorPublico'
  | 'observacoes'
>;

export class Lote {
  private constructor(private props: LoteProps) {}

  static create(input: CreateLoteInput): Lote {
    const now = new Date();
    return new Lote({
      id: randomUUID(),
      quadraId: input.quadraId,
      loteamentoId: input.loteamentoId,
      numero: input.numero,
      areaM2: Lote.decimal(input.areaM2),
      valor: input.valor == null ? null : Lote.decimal(input.valor),
      exibirValorPublico: input.exibirValorPublico ?? false,
      status: 'DISPONIVEL',
      observacoes: input.observacoes ?? null,
      teveReserva: false,
      createdAt: now,
      updatedAt: now,
    });
  }

  static restore(props: LoteProps): Lote {
    return new Lote({ ...props });
  }

  get id() {
    return this.props.id;
  }

  get quadraId() {
    return this.props.quadraId;
  }

  get loteamentoId() {
    return this.props.loteamentoId;
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

  get status() {
    return this.props.status;
  }

  get observacoes() {
    return this.props.observacoes;
  }

  get teveReserva() {
    return this.props.teveReserva;
  }

  get createdAt() {
    return this.props.createdAt;
  }

  get updatedAt() {
    return this.props.updatedAt;
  }

  get auditoria(): LoteAuditoria {
    const { quadraId, numero, areaM2, valor, exibirValorPublico, observacoes } =
      this.props;
    return { quadraId, numero, areaM2, valor, exibirValorPublico, observacoes };
  }

  /**
   * Atualiza só os campos informados. O status nunca muda por aqui: só pelos
   * fluxos de reserva, venda e bloqueio. `null` limpa valor e observações; nos
   * campos obrigatórios, é ignorado.
   */
  atualizar(input: UpdateLoteInput): void {
    this.props = {
      ...this.props,
      ...(input.numero != null && { numero: input.numero }),
      ...(input.areaM2 != null && { areaM2: Lote.decimal(input.areaM2) }),
      ...(input.valor !== undefined && {
        valor: input.valor === null ? null : Lote.decimal(input.valor),
      }),
      ...(input.exibirValorPublico != null && {
        exibirValorPublico: input.exibirValorPublico,
      }),
      ...(input.observacoes !== undefined && {
        observacoes: input.observacoes,
      }),
      updatedAt: new Date(),
    };
  }

  bloquear(motivo: string): void {
    if (!motivo.trim())
      throw new BusinessRuleError(
        'MOTIVO_OBRIGATORIO',
        'Informe o motivo do bloqueio',
      );
    if (this.props.status !== 'DISPONIVEL')
      throw new ConflictError(
        'LOTE_NAO_DISPONIVEL',
        'Só é possível bloquear um lote disponível',
      );
    this.props = { ...this.props, status: 'BLOQUEADO', updatedAt: new Date() };
  }

  desbloquear(): void {
    if (this.props.status !== 'BLOQUEADO')
      throw new ConflictError(
        'LOTE_NAO_BLOQUEADO',
        'Só é possível desbloquear um lote bloqueado',
      );
    this.props = { ...this.props, status: 'DISPONIVEL', updatedAt: new Date() };
  }

  liberarReserva(): void {
    if (this.props.status !== 'RESERVADO')
      throw new ConflictError(
        'LOTE_NAO_RESERVADO',
        'O lote não está reservado',
      );
    this.props = { ...this.props, status: 'DISPONIVEL', updatedAt: new Date() };
  }
  reservar(): void {
    if (this.props.status !== 'DISPONIVEL')
      throw new ConflictError(
        'LOTE_NAO_DISPONIVEL',
        'Só é possível reservar um lote disponível',
      );
    this.props = {
      ...this.props,
      status: 'RESERVADO',
      teveReserva: true,
      updatedAt: new Date(),
    };
  }
  /** Só lote DISPONIVEL e que nunca foi reservado pode ser excluído. */
  assertPodeExcluir(): void {
    if (this.props.status !== 'DISPONIVEL') {
      throw new ConflictError(
        'LOTE_NAO_DISPONIVEL',
        'Só é possível excluir um lote disponível',
      );
    }
    if (this.props.teveReserva) {
      throw new ConflictError(
        'LOTE_COM_RESERVAS',
        'Não é possível excluir um lote com histórico de reservas',
      );
    }
  }

  /** Normaliza um decimal já validado para 2 casas: `"360.5"` → `"360.50"`. */
  private static decimal(valor: string): string {
    const [inteiros, casas = ''] = valor.split('.');
    return `${inteiros.replace(/^0+(?=\d)/, '')}.${casas.padEnd(2, '0')}`;
  }
}
