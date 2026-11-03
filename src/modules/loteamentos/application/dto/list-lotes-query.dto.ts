import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { StatusLote } from '../../../../generated/prisma/client.js';
import { PaginationQueryDto } from '../../../../shared/application/dto/pagination-query.dto.js';
import { Trim } from '../../../../shared/application/dto/trim.transform.js';

export class ListLotesQueryDto extends PaginationQueryDto {
  /** @example '0b6f3c1e-8a52-4a8e-9d3f-2c7f1e5a9b10' */
  @IsOptional()
  @IsUUID()
  loteamentoId?: string;

  /** @example '1c1b8f8e-5a52-4a8e-9d3f-2c7f1e5a9b10' */
  @IsOptional()
  @IsUUID()
  quadraId?: string;

  /** Um ou mais status separados por vírgula */
  @ApiPropertyOptional({
    enum: StatusLote,
    enumName: 'StatusLote',
    isArray: true,
    example: 'DISPONIVEL,RESERVADO',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => String(value).split(','))
  @IsEnum(StatusLote, { each: true })
  status?: StatusLote[];

  /**
   * Busca por parte do número do lote (sem diferenciar maiúsculas)
   * @example '12'
   */
  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  q?: string;
}
