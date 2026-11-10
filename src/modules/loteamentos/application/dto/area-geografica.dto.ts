import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsUUID,
  ValidateIf,
} from 'class-validator';
import { PaginationQueryDto } from '../../../../shared/application/dto/pagination-query.dto.js';
import { MAX_VERTICES_GEOGRAFICOS } from '../../domain/models/area-geografica.js';

export class SaveAreaGeograficaDto {
  /** Pares [latitude, longitude], de 3 a 500 pontos. null remove a demarcação. */
  @ApiProperty({
    type: 'array',
    minItems: 3,
    maxItems: MAX_VERTICES_GEOGRAFICOS,
    items: {
      type: 'array',
      items: { type: 'number' },
      minItems: 2,
      maxItems: 2,
    },
    nullable: true,
  })
  @ValidateIf((_o, v) => v !== null)
  @IsArray()
  @ArrayMinSize(3)
  @ArrayMaxSize(MAX_VERTICES_GEOGRAFICOS)
  vertices: number[][] | null;
}
export class ListAreasGeograficasDto extends PaginationQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  loteamentoId?: string;
}
export class AreaGeograficaDto {
  id: string;
  @ApiProperty({ enum: ['LOTEAMENTO', 'QUADRA', 'LOTE'] })
  tipo: 'LOTEAMENTO' | 'QUADRA' | 'LOTE';
  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  quadraId: string | null;
  loteamentoId: string;
  nome: string;
  @ApiProperty({ type: String, nullable: true })
  status: string | null;
  @ApiProperty({
    type: 'array',
    items: { type: 'array', items: { type: 'number' } },
  })
  vertices: number[][];
}
export class AreaGeograficaDetalheDto {
  @ApiProperty({ type: AreaGeograficaDto, nullable: true })
  area: AreaGeograficaDto | null;
}
