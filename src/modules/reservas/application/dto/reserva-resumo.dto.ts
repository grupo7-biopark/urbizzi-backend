import { ApiProperty } from '@nestjs/swagger';
import type { ReservaResumo } from '../../domain/repositories/reserva-consulta.repository.interface.js';
export class LoteReservaResumoDto {
  id: string;
  numero: string;
  quadra: string;
  loteamentoId: string;
  loteamento: string;
}
export class ClienteReservaResumoDto {
  id: string;
  @ApiProperty({ type: String, nullable: true }) nome: string | null;
}
export class PropostaReservaResumoDto {
  id: string;
  @ApiProperty({ enum: ['EM_ANALISE', 'APROVADA', 'REJEITADA'] }) status:
    'EM_ANALISE' | 'APROVADA' | 'REJEITADA';
  valor: string;
}
export class ReservaResumoDto implements ReservaResumo {
  id: string;
  vendedorId: string;
  @ApiProperty({ enum: ['ATIVA', 'CANCELADA', 'EXPIRADA', 'CONVERTIDA'] })
  status: ReservaResumo['status'];
  @ApiProperty({ format: 'date-time' }) dataInicio: string;
  @ApiProperty({ format: 'date-time' }) dataVencimento: string;
  @ApiProperty({ type: LoteReservaResumoDto }) lote: LoteReservaResumoDto;
  @ApiProperty({ type: ClienteReservaResumoDto })
  cliente: ClienteReservaResumoDto;
  @ApiProperty({ type: PropostaReservaResumoDto, nullable: true })
  propostaAtual: PropostaReservaResumoDto | null;
}
