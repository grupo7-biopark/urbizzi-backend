import { ApiProperty } from '@nestjs/swagger';

export class PrevisaoReservaDto {
  @ApiProperty({ type: Number, example: 7 })
  prazoDias: number;

  @ApiProperty({ type: String, format: 'date-time' })
  dataVencimento: string;
}
