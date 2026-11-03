import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateLoteDto } from './create-lote.dto.js';

/** A quadra e o status não mudam por aqui; enviá-los retorna 400. */
export class UpdateLoteDto extends PartialType(
  OmitType(CreateLoteDto, ['quadraId'] as const),
) {}
