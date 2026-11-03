import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Perfis } from '../../../../shared/infra/auth/perfis.decorator.js';
import { CurrentUser } from '../../../../shared/infra/auth/current-user.decorator.js';
import type { UsuarioAutenticado } from '../../../../shared/domain/usuario-autenticado.js';
import { ApiErrorResponses } from '../../../../shared/infra/http/swagger/api-error-responses.decorator.js';
import { ApiPaginatedResponse } from '../../../../shared/infra/http/swagger/api-paginated-response.decorator.js';
import { PaginatedDto } from '../../../../shared/application/dto/paginated.dto.js';
import { HistoricoService } from '../../application/services/historico.service.js';
import { HistoricoDto } from '../../application/dto/historico.dto.js';
import { ListHistoricoQueryDto } from '../../application/dto/list-historico-query.dto.js';
@ApiTags('auditoria')
@ApiBearerAuth()
@Perfis('ADMINISTRADOR', 'GESTOR', 'COMERCIAL')
@Controller('historico')
export class HistoricoController {
  constructor(private readonly service: HistoricoService) {}
  /** Consulta alterações respeitando propriedade e filtros */
  @Get()
  @ApiPaginatedResponse(HistoricoDto)
  @ApiErrorResponses(400, 401, 403, 422)
  list(
    @Query() query: ListHistoricoQueryDto,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<PaginatedDto<HistoricoDto>> {
    return this.service.list(query, usuario);
  }
}
