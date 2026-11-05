import {
  Controller,
  Get,
  Header,
  Param,
  Query,
  Sse,
  type MessageEvent,
  UseGuards,
} from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Public } from '../../../../shared/infra/auth/public.decorator.js';
import { PaginationQueryDto } from '../../../../shared/application/dto/pagination-query.dto.js';
import { ApiErrorResponses } from '../../../../shared/infra/http/swagger/api-error-responses.decorator.js';
import { MapaPublicoDto } from '../../application/dto/mapa-publico.dto.js';
import { MapaPublicoService } from '../../application/services/mapa-publico.service.js';
import { concatMap, from, takeWhile, map, type Observable } from 'rxjs';
import { MapaEventosService } from '../../../mapa/application/services/mapa-eventos.service.js';
import { LinkPublicoService } from '../../application/services/link-publico.service.js';
@ApiTags('mapa público')
@Public()
@Controller('publico')
@UseGuards(ThrottlerGuard)
@Throttle({ default: { limit: 60, ttl: 60000 } })
export class MapaPublicoController {
  constructor(
    private readonly service: MapaPublicoService,
    private readonly eventos: MapaEventosService,
    private readonly links: LinkPublicoService,
  ) {}

  /** Fluxo SSE limitado ao loteamento do link público. */
  @Sse(':token/eventos')
  @Header('Referrer-Policy', 'no-referrer')
  @ApiOkResponse({
    content: { 'text/event-stream': { schema: { type: 'string' } } },
  })
  @ApiErrorResponses(404, 429)
  async observar(
    @Param('token') token: string,
  ): Promise<Observable<MessageEvent>> {
    const link = await this.links.registrarAcesso(token);
    return this.eventos.observar(link.loteamentoId ?? undefined).pipe(
      concatMap((evento) =>
        from(this.links.estaAtivo(link.id)).pipe(
          map((ativo) => ({ ativo, evento })),
        ),
      ),
      takeWhile(({ ativo }) => ativo),
      map(({ evento }) => evento),
    );
  }
  /** Consulta somente leitura por token ativo, sem dados internos; até 60 acessos por IP por minuto */
  @Get(':token')
  @Header('Cache-Control', 'no-store')
  @Header('Referrer-Policy', 'no-referrer')
  @ApiOkResponse({ type: MapaPublicoDto })
  @ApiErrorResponses(400, 404, 429)
  consultar(
    @Param('token') token: string,
    @Query() query: PaginationQueryDto,
  ): Promise<MapaPublicoDto> {
    return this.service.consultar(token, query);
  }
}
