import { ApiProperty } from '@nestjs/swagger';
import type {
  Reserva,
  StatusReserva,
} from '../../domain/models/reserva.entity.js';
export class ReservaDto {
  id: string;
  loteId: string;
  clienteId: string;
  vendedorId: string;
  dataInicio: Date;
  dataVencimento: Date;
  @ApiProperty({ enum: ['ATIVA', 'CANCELADA', 'EXPIRADA', 'CONVERTIDA'] })
  status: StatusReserva;
  /** Segundos até o vencimento, nunca negativo; zero para reserva encerrada. */ tempoRestanteSegundos: number;
  static from(reserva: Reserva): ReservaDto {
    return {
      ...reserva.dados,
      tempoRestanteSegundos: reserva.tempoRestanteSegundos(),
    };
  }
}
