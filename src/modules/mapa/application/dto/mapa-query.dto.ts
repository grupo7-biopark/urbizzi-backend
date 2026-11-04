import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { StatusLote } from '../../../../generated/prisma/client.js';
import { PaginationQueryDto } from '../../../../shared/application/dto/pagination-query.dto.js';
export class MapaQueryDto extends PaginationQueryDto {
  /** Loteamento desejado. */
  @IsOptional() @IsUUID() loteamentoId?: string;
  /** Status separados por vírgula. @example 'DISPONIVEL,RESERVADO' */
  @ApiPropertyOptional({ enum: StatusLote, isArray: true })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.split(',') : value,
  )
  @IsEnum(StatusLote, { each: true })
  status?: StatusLote[];
}
