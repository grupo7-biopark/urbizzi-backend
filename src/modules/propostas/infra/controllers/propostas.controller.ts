import {
  Body,
  Controller,
  Get,
  Post,
  Param,
  Query,
  ParseUUIDPipe,
  Header,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
} from '@nestjs/swagger';
import { Perfis } from '../../../../shared/infra/auth/perfis.decorator.js';
import { CurrentUser } from '../../../../shared/infra/auth/current-user.decorator.js';
import type { UsuarioAutenticado } from '../../../../shared/domain/usuario-autenticado.js';
import { PaginationQueryDto } from '../../../../shared/application/dto/pagination-query.dto.js';
import { PaginatedDto } from '../../../../shared/application/dto/paginated.dto.js';
import { ApiErrorResponses } from '../../../../shared/infra/http/swagger/api-error-responses.decorator.js';
import { ApiPaginatedResponse } from '../../../../shared/infra/http/swagger/api-paginated-response.decorator.js';
import { PropostaService } from '../../application/services/proposta.service.js';
import { CreatePropostaDto } from '../../application/dto/create-proposta.dto.js';
import { PropostaDto } from '../../application/dto/proposta.dto.js';
@ApiTags('propostas')
@ApiBearerAuth()
@Perfis('ADMINISTRADOR', 'GESTOR', 'COMERCIAL')
@Controller()
export class PropostasController {
  constructor(private readonly service: PropostaService) {}
  /** Envia proposta para análise em uma reserva ativa */
  @Post('reservas/:reservaId/propostas')
  @ApiCreatedResponse({ type: PropostaDto })
  @ApiErrorResponses(400, 401, 403, 404, 409, 422)
  @Header('Cache-Control', 'no-store')
  create(
    @Param('reservaId', ParseUUIDPipe) id: string,
    @Body() dto: CreatePropostaDto,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<PropostaDto> {
    return this.service.create(id, dto, usuario);
  }
  /** Consulta uma proposta respeitando o vendedor da reserva */
  @Get('propostas/:id')
  @ApiOkResponse({ type: PropostaDto })
  @ApiErrorResponses(400, 401, 403, 404)
  @Header('Cache-Control', 'no-store')
  find(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<PropostaDto> {
    return this.service.findById(id, usuario);
  }
  /** Lista propostas da reserva da mais recente para a mais antiga */
  @Get('reservas/:reservaId/propostas')
  @ApiPaginatedResponse(PropostaDto)
  @ApiErrorResponses(400, 401, 403, 404)
  @Header('Cache-Control', 'no-store')
  list(
    @Param('reservaId', ParseUUIDPipe) id: string,
    @Query() query: PaginationQueryDto,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<PaginatedDto<PropostaDto>> {
    return this.service.list(id, query, usuario);
  }
}
