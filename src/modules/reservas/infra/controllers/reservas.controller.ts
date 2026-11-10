import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { UsuarioAutenticado } from '../../../../shared/domain/usuario-autenticado.js';
import { CurrentUser } from '../../../../shared/infra/auth/current-user.decorator.js';
import { Perfis } from '../../../../shared/infra/auth/perfis.decorator.js';
import { ApiErrorResponses } from '../../../../shared/infra/http/swagger/api-error-responses.decorator.js';
import { CreateReservaDto } from '../../application/dto/create-reserva.dto.js';
import { PrevisaoReservaDto } from '../../application/dto/previsao-reserva.dto.js';
import { ReservaDto } from '../../application/dto/reserva.dto.js';
import { ReservaService } from '../../application/services/reserva.service.js';
@ApiTags('reservas')
@ApiBearerAuth()
@Perfis('ADMINISTRADOR', 'GESTOR', 'COMERCIAL')
@Controller('reservas')
export class ReservasController {
  constructor(private readonly service: ReservaService) {}
  /** Reserva lote disponível para o cliente; vendedor é o usuário autenticado */
  @Post()
  @ApiCreatedResponse({ type: ReservaDto })
  @ApiErrorResponses(400, 401, 403, 404, 409, 422)
  create(
    @Body() dto: CreateReservaDto,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<ReservaDto> {
    return this.service.create(dto, usuario);
  }
  /** Prevê o vencimento de uma reserva iniciada agora, sem criar a reserva. */
  @Get('previsao')
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: PrevisaoReservaDto })
  @ApiErrorResponses(401, 403, 422)
  prever(
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<PrevisaoReservaDto> {
    return this.service.preverVencimento(usuario);
  }
  /** Consulta a reserva com tempo restante; Comercial só consulta as próprias */
  @Get(':id')
  @ApiOkResponse({ type: ReservaDto })
  @ApiErrorResponses(400, 401, 403, 404)
  find(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<ReservaDto> {
    return this.service.findById(id, usuario);
  }
}
