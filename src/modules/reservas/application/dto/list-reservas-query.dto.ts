import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsISO8601,
  IsOptional,
  IsUUID,
  Matches,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { StatusReserva } from '../../../../generated/prisma/client.js';
import { PaginationQueryDto } from '../../../../shared/application/dto/pagination-query.dto.js';
export class ListReservasQueryDto extends PaginationQueryDto {
  /** Status separados por vírgula. */
  @ApiPropertyOptional({ enum: StatusReserva, isArray: true })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.split(',') : value,
  )
  @IsEnum(StatusReserva, { each: true })
  status?: StatusReserva[];
  /** Vendedor desejado; Comercial é sempre limitado ao próprio usuário. */ @IsOptional()
  @IsUUID()
  vendedorId?: string;
  /** Loteamento desejado. */ @IsOptional() @IsUUID() loteamentoId?: string;
  /** Início inclusivo do intervalo de vencimento, com fuso. @example '2026-11-01T00:00:00Z' */
  @IsOptional()
  @IsISO8601({ strict: true })
  @Matches(/(?:Z|[+-]\d{2}:\d{2})$/)
  vencimentoDe?: string;
  /** Fim inclusivo do intervalo de vencimento, com fuso. @example '2026-11-30T23:59:59Z' */
  @IsOptional()
  @IsISO8601({ strict: true })
  @Matches(/(?:Z|[+-]\d{2}:\d{2})$/)
  vencimentoAte?: string;
}
