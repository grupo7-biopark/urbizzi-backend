import { randomUUID } from 'node:crypto';
import {
  BusinessRuleError,
  ConflictError,
} from '../../../../shared/domain/errors/domain.error.js';
export type StatusReserva = 'ATIVA' | 'CANCELADA' | 'EXPIRADA' | 'CONVERTIDA';
export interface ReservaProps {
  id: string;
  loteId: string;
  clienteId: string;
  vendedorId: string;
  dataInicio: Date;
  dataVencimento: Date;
  status: StatusReserva;
}
export class Reserva {
  private constructor(private props: ReservaProps) {}
  static create(
    input: Pick<ReservaProps, 'loteId' | 'clienteId' | 'vendedorId'>,
    dias: number,
    agora = new Date(),
  ): Reserva {
    return new Reserva({
      ...input,
      id: randomUUID(),
      dataInicio: agora,
      dataVencimento: Reserva.calcularVencimento(dias, agora),
      status: 'ATIVA',
    });
  }
  static calcularVencimento(dias: number, agora: Date): Date {
    const vencimento = new Date(agora.getTime() + dias * 86400000);
    if (
      !Number.isSafeInteger(dias) ||
      dias < 1 ||
      !Number.isFinite(vencimento.getTime())
    )
      throw new BusinessRuleError(
        'CONFIGURACAO_INVALIDA',
        'Prazo de reserva inválido',
      );
    return vencimento;
  }
  static restore(props: ReservaProps): Reserva {
    return new Reserva({ ...props });
  }
  expirar(agora: Date): void {
    if (this.props.status !== 'ATIVA' || this.props.dataVencimento > agora)
      throw new ConflictError(
        'RESERVA_NAO_VENCIDA',
        'A reserva não está ativa e vencida',
      );
    this.props = { ...this.props, status: 'EXPIRADA' };
  }
  get dados(): ReservaProps {
    return { ...this.props };
  }
  tempoRestanteSegundos(agora = new Date()): number {
    return this.props.status === 'ATIVA'
      ? Math.max(
          0,
          Math.ceil(
            (this.props.dataVencimento.getTime() - agora.getTime()) / 1000,
          ),
        )
      : 0;
  }
}
