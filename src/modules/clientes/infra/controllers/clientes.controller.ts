import {
  Body,
  Controller,
  Get,
  Post,
  Patch,
  Param,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Perfis } from '../../../../shared/infra/auth/perfis.decorator.js';
import { CurrentUser } from '../../../../shared/infra/auth/current-user.decorator.js';
import type { UsuarioAutenticado } from '../../../../shared/domain/usuario-autenticado.js';
import { ApiErrorResponses } from '../../../../shared/infra/http/swagger/api-error-responses.decorator.js';
import { ApiPaginatedResponse } from '../../../../shared/infra/http/swagger/api-paginated-response.decorator.js';
import { PaginatedDto } from '../../../../shared/application/dto/paginated.dto.js';
import { ClienteService } from '../../application/services/cliente.service.js';
import { CreateClienteDto } from '../../application/dto/create-cliente.dto.js';
import { UpdateClienteDto } from '../../application/dto/update-cliente.dto.js';
import { ListClientesQueryDto } from '../../application/dto/list-clientes-query.dto.js';
import {
  ClienteDto,
  ClienteResumoDto,
} from '../../application/dto/cliente.dto.js';
@ApiTags('clientes')
@ApiBearerAuth()
@Perfis('ADMINISTRADOR', 'GESTOR', 'COMERCIAL')
@Controller('clientes')
export class ClientesController {
  constructor(private readonly service: ClienteService) {}
  /** Lista clientes por nome ou documento */
  @Get()
  @ApiPaginatedResponse(ClienteResumoDto)
  @ApiErrorResponses(400, 401, 403)
  list(
    @Query() dto: ListClientesQueryDto,
  ): Promise<PaginatedDto<ClienteResumoDto>> {
    return this.service.list(dto);
  }
  /** Consulta os dados de um cliente */
  @Get(':id')
  @ApiErrorResponses(400, 401, 403, 404)
  find(@Param('id', ParseUUIDPipe) id: string): Promise<ClienteDto> {
    return this.service.findById(id);
  }
  /** Cadastra um cliente */
  @Post()
  @ApiErrorResponses(400, 401, 403, 409, 422)
  create(
    @Body() dto: CreateClienteDto,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<ClienteDto> {
    return this.service.create(dto, usuario.id);
  }
  /** Atualiza os dados de um cliente */
  @Patch(':id')
  @ApiErrorResponses(400, 401, 403, 404, 409, 422)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateClienteDto,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<ClienteDto> {
    return this.service.update(id, dto, usuario.id);
  }
}
