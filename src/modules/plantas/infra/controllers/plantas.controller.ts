import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { PaginatedDto } from '../../../../shared/application/dto/paginated.dto.js';
import type { UsuarioAutenticado } from '../../../../shared/domain/usuario-autenticado.js';
import { CurrentUser } from '../../../../shared/infra/auth/current-user.decorator.js';
import { Perfis } from '../../../../shared/infra/auth/perfis.decorator.js';
import { RemoverUploadsInterceptor } from '../../../../shared/infra/http/interceptors/remover-uploads.interceptor.js';
import { ApiErrorResponses } from '../../../../shared/infra/http/swagger/api-error-responses.decorator.js';
import { ApiPaginatedResponse } from '../../../../shared/infra/http/swagger/api-paginated-response.decorator.js';
import { EnviarPlantaDto } from '../../application/dto/enviar-planta.dto.js';
import { ListPlantasQueryDto } from '../../application/dto/list-plantas-query.dto.js';
import { PlantaDto } from '../../application/dto/planta.dto.js';
import { PlantaService } from '../../application/services/planta.service.js';

/** Cada arquivo (imagem única ou fatia) pode ter até 300 MB. */
const TAMANHO_MAXIMO_ARQUIVO = 300 * 1024 * 1024;
/** Grade de até 10 x 10 fatias. */
const MAXIMO_ARQUIVOS = 100;

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
        arquivos: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
          description:
            'Uma imagem PNG/JPEG ou as fatias fatia_LL_CC.png (linha e coluna a partir de 01), todas com as mesmas dimensões. Até 300 MB por arquivo e 100 arquivos.',
        },
      },
    },
  })
  @ApiErrorResponses(400, 401, 403, 413, 422)
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
    );
  }

  /** Lista as versões da planta, da mais recente para a mais antiga */
  @Get()
  @ApiPaginatedResponse(PlantaDto)
  @ApiErrorResponses(400, 401)
  list(@Query() query: ListPlantasQueryDto): Promise<PaginatedDto<PlantaDto>> {
    return this.plantaService.list(query);
  }

  /** Detalha uma planta, com o status do processamento */
  @Get(':id')
  @ApiErrorResponses(400, 401, 404)
  findById(@Param('id', ParseUUIDPipe) id: string): Promise<PlantaDto> {
    return this.plantaService.findById(id);
  }
}
