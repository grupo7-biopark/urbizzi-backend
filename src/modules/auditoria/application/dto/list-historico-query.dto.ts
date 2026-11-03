import {
  IsOptional,
  IsString,
  IsUUID,
  IsDateString,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../../../shared/application/dto/pagination-query.dto.js';
export class ListHistoricoQueryDto extends PaginationQueryDto {
  /** @example 'Reserva' */
  @IsOptional()
  @IsString()
  @MaxLength(50)
  entidadeTipo?: string;
  /** @example '2872822b-14be-41ea-881f-a8c0c11c1ffd' */
  @IsOptional()
  @IsUUID()
  entidadeId?: string;
  /** Autor da alteração. @example '2872822b-14be-41ea-881f-a8c0c11c1ffd' */
  @IsOptional()
  @IsUUID()
  usuarioId?: string;
  /** Data UTC ou instante ISO 8601 inclusivo. @example '2026-11-01' */
  @IsOptional()
  @IsDateString({ strict: true })
  dataDe?: string;
  /** Data UTC inteira incluída, ou instante ISO 8601 inclusivo. @example '2026-11-03' */
  @IsOptional()
  @IsDateString({ strict: true })
  dataAte?: string;
}
