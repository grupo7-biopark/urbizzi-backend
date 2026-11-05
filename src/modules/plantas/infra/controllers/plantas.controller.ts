import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import type { PaginatedDto } from '../../../../shared/application/dto/paginated.dto.js';
import type { UsuarioAutenticado } from '../../../../shared/domain/usuario-autenticado.js';
import { CurrentUser } from '../../../../shared/infra/auth/current-user.decorator.js';
import { Perfis } from '../../../../shared/infra/auth/perfis.decorator.js';
import { Public } from '../../../../shared/infra/auth/public.decorator.js';
import { RemoverUploadsInterceptor } from '../../../../shared/infra/http/interceptors/remover-uploads.interceptor.js';
import { ApiErrorResponses } from '../../../../shared/infra/http/swagger/api-error-responses.decorator.js';
import { ApiPaginatedResponse } from '../../../../shared/infra/http/swagger/api-paginated-response.decorator.js';
import { EnviarPlantaDto } from '../../application/dto/enviar-planta.dto.js';
import { ListPlantasQueryDto } from '../../application/dto/list-plantas-query.dto.js';
import { PlantaAtivaDto } from '../../application/dto/planta-ativa.dto.js';
import { PlantaDto } from '../../application/dto/planta.dto.js';
import { TileParamsDto } from '../../application/dto/tile-params.dto.js';
import { PlantaService } from '../../application/services/planta.service.js';

/** Cada arquivo (imagem única ou fatia) pode ter até 300 MB. */
const TAMANHO_MAXIMO_ARQUIVO = 300 * 1024 * 1024;
/** Grade de até 10 x 10 fatias. */
const MAXIMO_ARQUIVOS = 100;

/**
 * Os tiles de uma planta PRONTA nunca mudam (o reprocessamento só vale para
 * plantas com erro), então o navegador e proxies podem guardá-los por um ano.
 */
const CACHE_TILE = 'public, max-age=31536000, immutable';

/** Arquivo gravado em disco pelo multer. */
interface ArquivoEnviado {
  originalname: string;
  path: string;
}

@ApiTags('plantas')
@ApiBearerAuth()
@Controller('plantas')
export class PlantasController {
  constructor(private readonly plantaService: PlantaService) {}

  /** Envia a planta como imagem única ou como fatias fatia_LL_CC; ela fica ENVIADA aguardando o processamento */
  @Post()
  @Perfis('ADMINISTRADOR', 'GESTOR')
  @UseInterceptors(
    RemoverUploadsInterceptor,
    // Grava em disco temporário: o upload não é carregado na memória.
    FilesInterceptor('arquivos', MAXIMO_ARQUIVOS, {
      dest: join(tmpdir(), 'urbizzi-uploads'),
      limits: { fileSize: TAMANHO_MAXIMO_ARQUIVO, fields: 10 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['nome', 'arquivos'],
      properties: {
        nome: { type: 'string', maxLength: 150 },
        copiarMarcadores: { type: 'boolean', default: false },
        arquivos: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
          description:
            'Uma imagem PNG/JPEG ou as fatias fatia_LL_CC.png (linha e coluna a partir de 01), todas com as mesmas dimensões. Até 300 MB por arquivo e 100 arquivos.',
        },
      },
    },
  })
  @ApiErrorResponses(400, 401, 403, 404, 413, 422)
  enviar(
    @UploadedFiles() arquivos: ArquivoEnviado[] | undefined,
    @Body() dto: EnviarPlantaDto,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<PlantaDto> {
    return this.plantaService.enviar(
      dto.nome,
      (arquivos ?? []).map((arquivo) => ({
        nome: arquivo.originalname,
        caminho: arquivo.path,
      })),
      usuario,
      dto.copiarMarcadores,
    );
  }

  /** Lista as versões da planta, da mais recente para a mais antiga */
  @Get()
  @ApiPaginatedResponse(PlantaDto)
  @ApiErrorResponses(400, 401)
  list(@Query() query: ListPlantasQueryDto): Promise<PaginatedDto<PlantaDto>> {
    return this.plantaService.list(query);
  }

  /** Planta exibida no mapa, com dimensões, zoom máximo e o modelo de URL dos tiles */
  @Get('ativa')
  @ApiErrorResponses(401, 404)
  ativa(): Promise<PlantaAtivaDto> {
    return this.plantaService.ativa();
  }

  /**
   * Tile WebP de uma planta PRONTA. Rota pública (o `<img>` do Leaflet não
   * envia token e o link público usa os mesmos tiles), com cache HTTP longo
   */
  @Get(':id/tiles/:z/:x/:y.webp')
  @Public()
  @ApiProduces('image/webp')
  @ApiOkResponse({ schema: { type: 'string', format: 'binary' } })
  @ApiErrorResponses(400, 404)
  async tile(
    @Param() params: TileParamsDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const conteudo = await this.plantaService.tile(
      params.id,
      params.z,
      params.x,
      params.y,
    );
    // Só depois de achar o tile: respostas de erro não podem ir para o cache.
    res.setHeader('Cache-Control', CACHE_TILE);
    return new StreamableFile(conteudo, { type: 'image/webp' });
  }

  /** Torna uma planta PRONTA a exibida no mapa; a anterior é desativada */
  @Post(':id/ativar')
  @HttpCode(HttpStatus.OK)
  @Perfis('ADMINISTRADOR', 'GESTOR')
  @ApiErrorResponses(400, 401, 403, 404, 409)
  ativar(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<PlantaDto> {
    return this.plantaService.ativar(id, usuario);
  }

  /** Devolve uma planta com ERRO para a fila de processamento */
  @Post(':id/reprocessar')
  @HttpCode(HttpStatus.OK)
  @Perfis('ADMINISTRADOR', 'GESTOR')
  @ApiErrorResponses(400, 401, 403, 404, 409)
  reprocessar(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<PlantaDto> {
    return this.plantaService.reprocessar(id, usuario);
  }

  /** Detalha uma planta, com o status do processamento */
  @Get(':id')
  @ApiErrorResponses(400, 401, 404)
  findById(@Param('id', ParseUUIDPipe) id: string): Promise<PlantaDto> {
    return this.plantaService.findById(id);
  }
}
