import {
  Controller,
  Get,
  Header,
  Query,
  Req,
  Sse,
  type MessageEvent,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { UsuarioAutenticado } from '../../../../shared/domain/usuario-autenticado.js';
import { CurrentUser } from '../../../../shared/infra/auth/current-user.decorator.js';
import { ApiErrorResponses } from '../../../../shared/infra/http/swagger/api-error-responses.decorator.js';
import { MapaDto } from '../../application/dto/mapa.dto.js';
import { MapaQueryDto } from '../../application/dto/mapa-query.dto.js';
import { MapaService } from '../../application/services/mapa.service.js';
import { MapaEventosService } from '../../application/services/mapa-eventos.service.js';
import type { Observable } from 'rxjs';
@ApiTags('mapa')
@ApiBearerAuth()
@Controller('mapa')
export class MapaController {
  constructor(
    private readonly service: MapaService,
    private readonly eventos: MapaEventosService,
  ) {}

  /** Fluxo SSE com mudanças confirmadas de status dos lotes */
  @Sse('eventos')
  @Header('Cache-Control', 'no-store')
  @Header('X-Accel-Buffering', 'no')
  @ApiOkResponse({
    content: { 'text/event-stream': { schema: { type: 'string' } } },
  })
  @ApiErrorResponses(401)
  observar(
    @Req() req: { user: UsuarioAutenticado; jwtExpiraEmMs: number },
  ): Observable<MessageEvent> {
    return this.eventos.observarInterno(req.user.id, req.jwtExpiraEmMs);
  }

  /** Planta ativa e marcadores paginados com status atual e ações do usuário */
  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: MapaDto })
  @ApiErrorResponses(400, 401, 404)
  consultar(
    @Query() query: MapaQueryDto,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<MapaDto> {
    return this.service.consultar(query, usuario);
  }
}
