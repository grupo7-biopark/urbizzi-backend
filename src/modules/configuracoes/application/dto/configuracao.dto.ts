export class ConfiguracaoDto {
  /** @example 'prazo_reserva_dias' */
  chave: string;
  /** @example 7 */
  valor: number;
}
export class PrazosDto {
  /** @example 7 */
  prazoReservaDias: number;
  /** @example 7 */
  prazoAnaliseDiasUteis: number;
}
