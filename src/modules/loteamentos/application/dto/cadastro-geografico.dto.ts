import { Type } from 'class-transformer';
import { IsDefined, ValidateNested } from 'class-validator';
import { SaveAreaGeograficaDto } from './area-geografica.dto.js';
import { CreateLoteamentoDto } from './create-loteamento.dto.js';
import { UpdateLoteamentoDto } from './update-loteamento.dto.js';
import { CreateLoteDto } from './create-lote.dto.js';
import { UpdateLoteDto } from './update-lote.dto.js';
import { CreateQuadraDto } from './create-quadra.dto.js';
import { UpdateQuadraDto } from './update-quadra.dto.js';
export class CreateQuadraGeograficaDto extends SaveAreaGeograficaDto {
  @IsDefined()
  @ValidateNested()
  @Type(() => CreateQuadraDto)
  cadastro: CreateQuadraDto;
}
export class UpdateQuadraGeograficaDto extends SaveAreaGeograficaDto {
  @IsDefined()
  @ValidateNested()
  @Type(() => UpdateQuadraDto)
  cadastro: UpdateQuadraDto;
}
export class CreateLoteamentoGeograficoDto extends SaveAreaGeograficaDto {
  @IsDefined()
  @ValidateNested()
  @Type(() => CreateLoteamentoDto)
  cadastro: CreateLoteamentoDto;
}
export class UpdateLoteamentoGeograficoDto extends SaveAreaGeograficaDto {
  @IsDefined()
  @ValidateNested()
  @Type(() => UpdateLoteamentoDto)
  cadastro: UpdateLoteamentoDto;
}
export class CreateLoteGeograficoDto extends SaveAreaGeograficaDto {
  @IsDefined()
  @ValidateNested()
  @Type(() => CreateLoteDto)
  cadastro: CreateLoteDto;
}
export class UpdateLoteGeograficoDto extends SaveAreaGeograficaDto {
  @IsDefined()
  @ValidateNested()
  @Type(() => UpdateLoteDto)
  cadastro: UpdateLoteDto;
}
