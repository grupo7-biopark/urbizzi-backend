import { PartialType } from '@nestjs/swagger';
import { CreateQuadraDto } from './create-quadra.dto.js';

export class UpdateQuadraDto extends PartialType(CreateQuadraDto) {}
