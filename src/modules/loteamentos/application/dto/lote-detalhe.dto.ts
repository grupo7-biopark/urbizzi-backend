import { ApiProperty } from '@nestjs/swagger';
import type {
  EventoNoLote,
  LoteDetalhe,
  PropostaNoLote,
  ReservaNoLote,
} from '../../domain/repositories/lote-detalhe.repository.interface.js';
import { LoteDto } from './lote.dto.js';

class ReferenciaDto {
  id: string;
  nome: string;
}

class ClienteNoLoteDto {
  id: string;
  @ApiProperty({ type: String, nullable: true })
  nome: string | null;
}

class QuadraNoLoteDto {
  id: string;
  numero: string;
}

class ReservaNoLoteDto implements ReservaNoLote {
  id: string;
  @ApiProperty({ enum: ['ATIVA', 'CONVERTIDA'] })
  status: ReservaNoLote['status'];
  @ApiProperty({ format: 'date-time' })
  dataInicio: string;
  @ApiProperty({ format: 'date-time' })
  dataVencimento: string;
  cliente: ClienteNoLoteDto;
  vendedor: ReferenciaDto;
}

class PropostaNoLoteDto implements PropostaNoLote {
  id: string;
  @ApiProperty({ enum: ['EM_ANALISE', 'APROVADA', 'REJEITADA'] })
  status: PropostaNoLote['status'];
  valor: string;
  @ApiProperty({ format: 'date-time' })
  dataEnvio: string;
  @ApiProperty({ format: 'date-time' })
  prazoLimite: string;
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  dataDecisao: string | null;
}

class EventoNoLoteDto implements EventoNoLote {
  id: string;
  @ApiProperty({ enum: ['Lote', 'Reserva', 'Proposta'] })
  entidadeTipo: EventoNoLote['entidadeTipo'];
  entidadeId: string;
  acao: string;
  @ApiProperty({ format: 'date-time' })
  createdAt: string;
}

export class LoteDetalheDto implements LoteDetalhe {
  @ApiProperty({ type: LoteDto })
  lote: LoteDto;
  @ApiProperty({ type: QuadraNoLoteDto })
  quadra: QuadraNoLoteDto;
  @ApiProperty({ type: ReferenciaDto })
  loteamento: ReferenciaDto;
  @ApiProperty({ type: ReservaNoLoteDto, nullable: true })
  reserva: ReservaNoLoteDto | null;
  @ApiProperty({ type: [PropostaNoLoteDto] })
  propostas: PropostaNoLoteDto[];
  @ApiProperty({ type: [EventoNoLoteDto] })
  historico: EventoNoLoteDto[];
}
