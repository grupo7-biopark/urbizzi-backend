import { IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../../shared/application/dto/pagination-query.dto.js';
export class ListClientesQueryDto extends PaginationQueryDto {
  /** Nome parcial sem distinguir acentos ou documento formatado. @example 'Jose' */
  @IsOptional()
  @IsString()
  @MaxLength(254)
  q?: string;
}
