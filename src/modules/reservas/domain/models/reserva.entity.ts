import { randomUUID } from 'node:crypto';
import { BusinessRuleError } from '../../../../shared/domain/errors/domain.error.js';
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
    return new Reserva({
      ...input,
      id: randomUUID(),
      dataInicio: agora,
      dataVencimento: vencimento,
      status: 'ATIVA',
    });
  }
  static restore(props: ReservaProps): Reserva {
    return new Reserva({ ...props });
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
