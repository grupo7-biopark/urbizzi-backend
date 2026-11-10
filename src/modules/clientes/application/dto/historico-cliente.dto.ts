import { ApiProperty } from '@nestjs/swagger';
import type { HistoricoClienteItem } from '../../domain/repositories/historico-cliente.repository.interface.js';

export class LoteHistoricoClienteDto {
  @ApiProperty({ format: 'uuid' })
  id: string;
  @ApiProperty()
  numero: string;
  @ApiProperty()
  quadra: string;
  @ApiProperty({ format: 'uuid' })
  loteamentoId: string;
  @ApiProperty()
  loteamento: string;
}
export class ReservaHistoricoClienteDto {
  @ApiProperty({ format: 'uuid' })
  id: string;
  @ApiProperty({ enum: ['ATIVA', 'CANCELADA', 'EXPIRADA', 'CONVERTIDA'] })
  status: 'ATIVA' | 'CANCELADA' | 'EXPIRADA' | 'CONVERTIDA';
  @ApiProperty({ type: String, format: 'date-time' }) dataInicio: string;
  @ApiProperty({ type: String, format: 'date-time' }) dataVencimento: string;
  @ApiProperty({ type: LoteHistoricoClienteDto })
  lote: LoteHistoricoClienteDto;
}
export class DecisaoHistoricoClienteDto {
  @ApiProperty({ format: 'uuid' })
  decididoPorId: string;
  @ApiProperty({ type: String, format: 'date-time' }) data: string;
  @ApiProperty()
  motivo: string;
}
export class PropostaHistoricoClienteDto {
  @ApiProperty({ format: 'uuid' })
  id: string;
  /** Valor monetário com duas casas decimais. @example '250000.00' */
  @ApiProperty({ type: String, example: '250000.00' })
  valor: string;
  @ApiProperty({ enum: ['EM_ANALISE', 'APROVADA', 'REJEITADA'] }) status:
    'EM_ANALISE' | 'APROVADA' | 'REJEITADA';
  @ApiProperty({ type: String, format: 'date-time' }) dataEnvio: string;
  @ApiProperty({ type: String, format: 'date-time' }) prazoLimite: string;
  @ApiProperty({ type: DecisaoHistoricoClienteDto, nullable: true })
  decisao: DecisaoHistoricoClienteDto | null;
}
export class HistoricoClienteDto {
  @ApiProperty({ enum: ['RESERVA', 'PROPOSTA'] }) tipo: 'RESERVA' | 'PROPOSTA';
  @ApiProperty({ format: 'uuid' })
  id: string;
  /** Início da reserva ou envio da proposta, usado na ordenação. */
  @ApiProperty({ type: String, format: 'date-time' }) data: string;
  @ApiProperty({ type: ReservaHistoricoClienteDto })
  reserva: ReservaHistoricoClienteDto;
  @ApiProperty({ type: PropostaHistoricoClienteDto, nullable: true })
  proposta: PropostaHistoricoClienteDto | null;
  static from(item: HistoricoClienteItem): HistoricoClienteDto {
    return {
      tipo: item.tipo,
      id: item.id,
      data: new Date(item.data).toISOString(),
      reserva: {
        ...item.reserva,
        dataInicio: new Date(item.reserva.dataInicio).toISOString(),
        dataVencimento: new Date(item.reserva.dataVencimento).toISOString(),
      },
      proposta: item.proposta
        ? {
            ...item.proposta,
            dataEnvio: new Date(item.proposta.dataEnvio).toISOString(),
            prazoLimite: new Date(item.proposta.prazoLimite).toISOString(),
            decisao: item.proposta.decisao
              ? {
                  ...item.proposta.decisao,
                  data: new Date(item.proposta.decisao.data).toISOString(),
                }
              : null,
          }
        : null,
    };
  }
}
