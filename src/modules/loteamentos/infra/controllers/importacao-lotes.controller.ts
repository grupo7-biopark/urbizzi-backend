import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  ParseFilePipe,
  Post,
  Query,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import type { UsuarioAutenticado } from '../../../../shared/domain/usuario-autenticado.js';
import { CurrentUser } from '../../../../shared/infra/auth/current-user.decorator.js';
import { Perfis } from '../../../../shared/infra/auth/perfis.decorator.js';
import { ApiErrorResponses } from '../../../../shared/infra/http/swagger/api-error-responses.decorator.js';
import { ImportarLotesDto } from '../../application/dto/importar-lotes.dto.js';
import { ModeloImportacaoQueryDto } from '../../application/dto/modelo-importacao-query.dto.js';
import { ResultadoImportacaoDto } from '../../application/dto/resultado-importacao.dto.js';
import { ImportacaoLotesService } from '../../application/services/importacao-lotes.service.js';

const TAMANHO_MAXIMO = 5 * 1024 * 1024;

/** Arquivo recebido pelo multer em memória. */
interface ArquivoEnviado {
  originalname: string;
  buffer: Buffer;
}

@ApiTags('lotes')
@ApiBearerAuth()
@Perfis('ADMINISTRADOR', 'GESTOR')
@Controller('lotes/importacao')
export class ImportacaoLotesController {
  constructor(private readonly importacaoService: ImportacaoLotesService) {}

  /** Valida uma planilha CSV ou XLSX de lotes e, se confirmado e sem erros, importa tudo */
  @Post()
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('arquivo', {
      limits: { fileSize: TAMANHO_MAXIMO, files: 1 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['arquivo'],
      properties: {
        arquivo: {
          type: 'string',
          format: 'binary',
          description: 'Planilha .csv ou .xlsx (até 5 MB e 5000 lotes)',
        },
        confirmar: { type: 'boolean', default: false },
        criarCadastros: { type: 'boolean', default: false },
      },
    },
  })
  @ApiErrorResponses(400, 401, 403, 409, 413, 422)
  importar(
    @UploadedFile(
      new ParseFilePipe({
        exceptionFactory: () =>
          new BadRequestException({
            code: 'ARQUIVO_OBRIGATORIO',
            message: 'Envie a planilha no campo arquivo',
          }),
      }),
    )
    arquivo: ArquivoEnviado,
    @Body() dto: ImportarLotesDto,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<ResultadoImportacaoDto> {
    return this.importacaoService.importar(
      { nome: arquivo.originalname, conteudo: arquivo.buffer },
      dto,
      usuario,
    );
  }

  /** Baixa o modelo de planilha para importação de lotes */
  @Get('modelo')
  @ApiProduces(
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
  )
  @ApiOkResponse({ schema: { type: 'string', format: 'binary' } })
  @ApiErrorResponses(400, 401, 403)
  async modelo(
    @Query() query: ModeloImportacaoQueryDto,
  ): Promise<StreamableFile> {
    const modelo = await this.importacaoService.modelo(query.formato);
    return new StreamableFile(modelo.conteudo, {
      type: modelo.tipo,
      disposition: `attachment; filename="${modelo.nome}"`,
    });
  }
}
