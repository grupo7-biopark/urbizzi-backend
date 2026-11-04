import { ApiProperty } from '@nestjs/swagger';
import {
  PaginatedDto,
  PaginationMetaDto,
} from '../../../../shared/application/dto/paginated.dto.js';
import type {
  ItemMapa,
  StatusLoteMapa,
} from '../../domain/repositories/mapa-consulta.repository.interface.js';
import type { AcaoMapa } from '../../domain/policies/acoes-mapa.policy.js';
export class PlantaMapaDto {
  id: string;
  nome: string;
  versao: number;
  larguraPx: number | null;
  alturaPx: number | null;
  maxZoom: number | null;
  tamanhoTile: number | null;
  tilesUrl: string;
}
export class MarcadorMapaDto {
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
  valor: string | null;
  @ApiProperty({ enum: ['DISPONIVEL', 'RESERVADO', 'VENDIDO', 'BLOQUEADO'] })
  status: StatusLoteMapa;
  @ApiProperty({
    type: [String],
    enum: ['reservar', 'verReserva', 'vender', 'bloquear', 'desbloquear'],
  })
  acoes: AcaoMapa[];
  static from(item: ItemMapa, acoes: AcaoMapa[]): MarcadorMapaDto {
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
      valor,
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
      valor,
      status,
      acoes,
    };
  }
}
export class PaginaMarcadoresMapaDto extends PaginatedDto<MarcadorMapaDto> {
  @ApiProperty({ type: [MarcadorMapaDto] }) declare data: MarcadorMapaDto[];
  @ApiProperty({ type: PaginationMetaDto }) declare meta: PaginationMetaDto;
}
export class MapaDto {
  @ApiProperty({ type: PlantaMapaDto }) planta: PlantaMapaDto;
  @ApiProperty({ type: PaginaMarcadoresMapaDto })
  marcadores: PaginaMarcadoresMapaDto;
}
