import { Body, Controller, Get, Patch, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Perfis } from '../../../../shared/infra/auth/perfis.decorator.js';
import { CurrentUser } from '../../../../shared/infra/auth/current-user.decorator.js';
import type { UsuarioAutenticado } from '../../../../shared/domain/usuario-autenticado.js';
import { PaginationQueryDto } from '../../../../shared/application/dto/pagination-query.dto.js';
import { PaginatedDto } from '../../../../shared/application/dto/paginated.dto.js';
import { ApiPaginatedResponse } from '../../../../shared/infra/http/swagger/api-paginated-response.decorator.js';
import { ApiErrorResponses } from '../../../../shared/infra/http/swagger/api-error-responses.decorator.js';
import { ConfiguracaoService } from '../../application/services/configuracao.service.js';
import {
  ConfiguracaoDto,
  PrazosDto,
} from '../../application/dto/configuracao.dto.js';
import { UpdateConfiguracoesDto } from '../../application/dto/update-configuracoes.dto.js';
@ApiTags('configuracoes')
@ApiBearerAuth()
@Perfis('ADMINISTRADOR')
@Controller('configuracoes')
export class ConfiguracoesController {
  constructor(private readonly service: ConfiguracaoService) {}
  /** Lista os prazos configurados */
  @Get()
  @ApiPaginatedResponse(ConfiguracaoDto)
  @ApiErrorResponses(400, 401, 403)
  list(
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedDto<ConfiguracaoDto>> {
    return this.service.list(query);
  }
  /** Atualiza os prazos para novas operações */
  @Patch()
  @ApiErrorResponses(400, 401, 403, 422)
  update(
    @Body() dto: UpdateConfiguracoesDto,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<PrazosDto> {
    return this.service.update(dto, usuario.id);
  }
}
