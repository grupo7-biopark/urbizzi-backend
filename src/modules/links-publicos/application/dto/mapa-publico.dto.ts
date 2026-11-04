import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  PaginatedDto,
  PaginationMetaDto,
} from '../../../../shared/application/dto/paginated.dto.js';
export class PlantaPublicaDto {
  id: string;
  nome: string;
  versao: number;
  larguraPx: number | null;
  alturaPx: number | null;
  maxZoom: number | null;
  tamanhoTile: number | null;
  tilesUrl: string;
}
export class LotePublicoDto {
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
  status: 'DISPONIVEL' | 'RESERVADO' | 'VENDIDO' | 'BLOQUEADO';
  @ApiPropertyOptional({ type: String, nullable: true }) valor?: string | null;
}
export class PaginaLotesPublicosDto extends PaginatedDto<LotePublicoDto> {
  @ApiProperty({ type: [LotePublicoDto] }) declare data: LotePublicoDto[];
  @ApiProperty({ type: PaginationMetaDto }) declare meta: PaginationMetaDto;
}
/** Contrato público explícito, sem herdar DTOs internos de outro módulo. */
export class MapaPublicoDto {
  @ApiProperty({ type: PlantaPublicaDto }) planta: PlantaPublicaDto;
  @ApiProperty({ type: PaginaLotesPublicosDto })
  marcadores: PaginaLotesPublicosDto;
  /** Canal geral de atendimento ou orientação para falar com quem compartilhou o link. */
  @ApiProperty({ example: 'https://exemplo.com/atendimento' })
  contatoComercial: string;
}
