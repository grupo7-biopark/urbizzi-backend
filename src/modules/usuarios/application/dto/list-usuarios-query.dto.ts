import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PerfilCodigo } from '../../../../generated/prisma/client.js';
import { PaginationQueryDto } from '../../../../shared/application/dto/pagination-query.dto.js';
export class ListUsuariosQueryDto extends PaginationQueryDto {
  /** Perfil desejado. */
  @ApiPropertyOptional({ enum: PerfilCodigo, enumName: 'PerfilCodigo' })
  @IsOptional()
  @IsEnum(PerfilCodigo)
  perfil?: PerfilCodigo;
  /** Filtra usuários ativos ou inativos. @example true */
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}
