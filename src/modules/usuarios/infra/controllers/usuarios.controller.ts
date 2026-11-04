import {
  Body,
  Controller,
  Get,
  Post,
  Patch,
  Param,
  ParseUUIDPipe,
  Query,
  HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Perfis } from '../../../../shared/infra/auth/perfis.decorator.js';
import { CurrentUser } from '../../../../shared/infra/auth/current-user.decorator.js';
import type { UsuarioAutenticado } from '../../../../shared/domain/usuario-autenticado.js';
import { ApiErrorResponses } from '../../../../shared/infra/http/swagger/api-error-responses.decorator.js';
import { ApiPaginatedResponse } from '../../../../shared/infra/http/swagger/api-paginated-response.decorator.js';
import { PaginatedDto } from '../../../../shared/application/dto/paginated.dto.js';
import { GestaoUsuarioService } from '../../application/services/gestao-usuario.service.js';
import { CreateUsuarioDto } from '../../application/dto/create-usuario.dto.js';
import { UpdateUsuarioDto } from '../../application/dto/update-usuario.dto.js';
import { ListUsuariosQueryDto } from '../../application/dto/list-usuarios-query.dto.js';
import { UsuarioDto } from '../../application/dto/usuario.dto.js';
@ApiTags('usuarios')
@ApiBearerAuth()
@Perfis('ADMINISTRADOR')
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly service: GestaoUsuarioService) {}
  /** Lista usuários com filtros por perfil e situação */
  @Get()
  @ApiPaginatedResponse(UsuarioDto)
  @ApiErrorResponses(400, 401, 403)
  list(
    @Query() query: ListUsuariosQueryDto,
  ): Promise<PaginatedDto<UsuarioDto>> {
    return this.service.list(query);
  }
  /** Consulta um usuário */
  @Get(':id')
  @ApiErrorResponses(400, 401, 403, 404)
  find(@Param('id', ParseUUIDPipe) id: string): Promise<UsuarioDto> {
    return this.service.findById(id);
  }
  /** Cria usuário ativo com senha inicial */
  @Post()
  @ApiErrorResponses(400, 401, 403, 404, 409)
  create(
    @Body() dto: CreateUsuarioDto,
    @CurrentUser() ator: UsuarioAutenticado,
  ): Promise<UsuarioDto> {
    return this.service.create(dto, ator.id);
  }
  /** Altera nome, e-mail ou perfil do usuário */
  @Patch(':id')
  @ApiErrorResponses(400, 401, 403, 404, 409)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUsuarioDto,
    @CurrentUser() ator: UsuarioAutenticado,
  ): Promise<UsuarioDto> {
    return this.service.update(id, dto, ator.id);
  }
  /** Ativa usuário existente */
  @Post(':id/ativar')
  @HttpCode(200)
  @ApiErrorResponses(400, 401, 403, 404, 409)
  ativar(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() ator: UsuarioAutenticado,
  ): Promise<UsuarioDto> {
    return this.service.definirAtivo(id, true, ator.id);
  }
  /** Desativa sem excluir o histórico do usuário */
  @Post(':id/desativar')
  @HttpCode(200)
  @ApiErrorResponses(400, 401, 403, 404, 409)
  desativar(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() ator: UsuarioAutenticado,
  ): Promise<UsuarioDto> {
    return this.service.definirAtivo(id, false, ator.id);
  }
}
