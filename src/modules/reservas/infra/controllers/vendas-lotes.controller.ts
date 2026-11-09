import {
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiNoContentResponse, ApiTags } from '@nestjs/swagger';
import type { UsuarioAutenticado } from '../../../../shared/domain/usuario-autenticado.js';
import { CurrentUser } from '../../../../shared/infra/auth/current-user.decorator.js';
import { Perfis } from '../../../../shared/infra/auth/perfis.decorator.js';
import { ApiErrorResponses } from '../../../../shared/infra/http/swagger/api-error-responses.decorator.js';
import { ReservaService } from '../../application/services/reserva.service.js';

@ApiTags('lotes')
@ApiBearerAuth()
@Perfis('ADMINISTRADOR', 'GESTOR')
@Controller('lotes')
export class VendasLotesController {
  constructor(private readonly reservas: ReservaService) {}

  /** Marca como vendido o lote reservado com proposta aprovada */
  @Post(':id/vender')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Venda registrada' })
  @ApiErrorResponses(400, 401, 403, 404, 409)
  vender(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<void> {
    return this.reservas.venderLote(id, usuario);
  }
}
