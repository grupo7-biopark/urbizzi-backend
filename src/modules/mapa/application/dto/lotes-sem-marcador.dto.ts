import { IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../../shared/application/dto/pagination-query.dto.js';
export class LotesSemMarcadorQueryDto extends PaginationQueryDto {
  /** Filtra os lotes pelo loteamento. */
  @IsOptional() @IsUUID() loteamentoId?: string;
}
export class LoteSemMarcadorDto {
  id: string;
  numero: string;
  quadraId: string;
  loteamentoId: string;
}
