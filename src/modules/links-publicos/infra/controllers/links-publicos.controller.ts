import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseUUIDPipe,
  Query,
  HttpCode,
  Header,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Perfis } from '../../../../shared/infra/auth/perfis.decorator.js';
import { CurrentUser } from '../../../../shared/infra/auth/current-user.decorator.js';
import type { UsuarioAutenticado } from '../../../../shared/domain/usuario-autenticado.js';
import { PaginationQueryDto } from '../../../../shared/application/dto/pagination-query.dto.js';
import { PaginatedDto } from '../../../../shared/application/dto/paginated.dto.js';
import { ApiErrorResponses } from '../../../../shared/infra/http/swagger/api-error-responses.decorator.js';
import { ApiPaginatedResponse } from '../../../../shared/infra/http/swagger/api-paginated-response.decorator.js';
import { LinkPublicoService } from '../../application/services/link-publico.service.js';
import { LinkPublicoDto } from '../../application/dto/link-publico.dto.js';
import { CreateLinkPublicoDto } from '../../application/dto/create-link-publico.dto.js';
@ApiTags('links-publicos')
@ApiBearerAuth()
@Perfis('ADMINISTRADOR', 'GESTOR', 'COMERCIAL')
@Controller('links-publicos')
export class LinksPublicosController {
  constructor(private readonly service: LinkPublicoService) {}
  /** Gera um link compartilhável com token aleatório */
  @Post()
  @Header('Cache-Control', 'no-store')
  @ApiErrorResponses(400, 401, 403, 404)
  create(
    @Body() dto: CreateLinkPublicoDto,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<LinkPublicoDto> {
    return this.service.create(dto, usuario);
  }
  /** Lista links conforme o perfil do usuário */
  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiPaginatedResponse(LinkPublicoDto)
  @ApiErrorResponses(400, 401, 403)
  list(
    @Query() query: PaginationQueryDto,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<PaginatedDto<LinkPublicoDto>> {
    return this.service.list(query, usuario);
  }
  /** Desativa um link imediatamente */
  @Post(':id/desativar')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @ApiErrorResponses(400, 401, 403, 404)
  desativar(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<LinkPublicoDto> {
    return this.service.desativar(id, usuario);
  }
}
