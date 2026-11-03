import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional } from 'class-validator';
import { StatusPlanta } from '../../../../generated/prisma/client.js';
import { PaginationQueryDto } from '../../../../shared/application/dto/pagination-query.dto.js';

export class ListPlantasQueryDto extends PaginationQueryDto {
  /** Um ou mais status separados por vírgula */
  @ApiPropertyOptional({
    enum: StatusPlanta,
    enumName: 'StatusPlanta',
    isArray: true,
    example: 'PRONTA,ERRO',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => String(value).split(','))
  @IsEnum(StatusPlanta, { each: true })
  status?: StatusPlanta[];
}
