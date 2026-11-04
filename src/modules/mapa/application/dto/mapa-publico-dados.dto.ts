import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  PaginatedDto,
  PaginationMetaDto,
} from '../../../../shared/application/dto/paginated.dto.js';
import type {
  ItemMapa,
  StatusLoteMapa,
} from '../../domain/repositories/mapa-consulta.repository.interface.js';
import { PlantaMapaDto } from './mapa.dto.js';
/** Lista permitida de campos públicos; não deriva do DTO interno. */
export class MarcadorPublicoDto {
  id: string;
  loteId: string;
  x: number;
  y: number;
  numero: string;
  quadraId: string;
  quadra: string;
  loteamentoId: string;
  loteamento: string;
  areaM2: string;
  @ApiProperty({ enum: ['DISPONIVEL', 'RESERVADO', 'VENDIDO', 'BLOQUEADO'] })
  status: StatusLoteMapa;
  /** Só existe quando exibirValorPublico autoriza a publicação. */
  @ApiPropertyOptional({ type: String, nullable: true }) valor?: string | null;
  static from(item: ItemMapa): MarcadorPublicoDto {
    const {
      id,
      loteId,
      x,
      y,
      numero,
      quadraId,
      quadra,
      loteamentoId,
      loteamento,
      areaM2,
      status,
    } = item;
    return {
      id,
      loteId,
      x,
      y,
      numero,
      quadraId,
      quadra,
      loteamentoId,
      loteamento,
      areaM2,
      status,
      ...(item.exibirValorPublico ? { valor: item.valor } : {}),
    };
  }
}
export class PaginaMarcadoresPublicosDto extends PaginatedDto<MarcadorPublicoDto> {
  @ApiProperty({ type: [MarcadorPublicoDto] })
  declare data: MarcadorPublicoDto[];
  @ApiProperty({ type: PaginationMetaDto }) declare meta: PaginationMetaDto;
}
export class MapaPublicoDadosDto {
  @ApiProperty({ type: PlantaMapaDto }) planta: PlantaMapaDto;
  @ApiProperty({ type: PaginaMarcadoresPublicosDto })
  marcadores: PaginaMarcadoresPublicosDto;
}
