import { PartialType } from '@nestjs/swagger';
import { CreateLoteamentoDto } from './create-loteamento.dto.js';

export class UpdateLoteamentoDto extends PartialType(CreateLoteamentoDto) {}
