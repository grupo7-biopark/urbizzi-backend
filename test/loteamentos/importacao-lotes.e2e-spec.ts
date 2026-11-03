import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module.js';
import { setupApp } from '../../src/app.setup.js';
import { ExcelPlanilha } from '../../src/modules/loteamentos/infra/repositories/excel-planilha.js';
import { PrismaService } from '../../src/shared/infra/database/prisma.service.js';
import { limparBanco } from '../helpers/database.js';
import {
  criarUsuarios,
  PERFIS,
  type UsuariosTeste,
} from '../helpers/usuarios.js';

const CABECALHO = 'loteamento;quadra;numero;area_m2;valor;exibir_valor';

function csv(...linhas: string[]): Buffer {
  return Buffer.from([CABECALHO, ...linhas].join('\r\n'), 'utf8');
}

describe('Importação de lotes (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let usuarios: UsuariosTeste;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    setupApp(app);
    await app.init();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await limparBanco(prisma);
    usuarios = await criarUsuarios(app);
  });

  afterAll(async () => {
    await app?.close();
  });

  function importar(
    arquivo: Buffer,
    campos: Record<string, string> = {},
    nome = 'lotes.csv',
    token = usuarios.GESTOR.token,
  ) {
    const req = request(app.getHttpServer())
      .post('/v1/lotes/importacao')
      .auth(token, { type: 'bearer' })
      .attach('arquivo', arquivo, nome);
    for (const [campo, valor] of Object.entries(campos)) {
      req.field(campo, valor);
    }
    return req;
  }

  async function cadastrarBelaVista() {
    const loteamento = await prisma.loteamento.create({
      data: { nome: 'Bela Vista' },
    });
    const quadra = await prisma.quadra.create({
      data: { loteamentoId: loteamento.id, numero: 'A' },
    });
    return { loteamento, quadra };
  }

  it('pré-visualiza sem gravar nada', async () => {
    const res = await importar(
      csv('Bela Vista;A;1;360,50;250000;sim', 'Bela Vista;A;2;300;;não'),
      { criarCadastros: 'true' },
    ).expect(200);

    expect(res.body).toEqual({
      importado: false,
      totalLinhas: 2,
      lotes: 2,
      loteamentosNovos: 1,
      quadrasNovas: 1,
      erros: [],
    });
    expect(await prisma.lote.count()).toBe(0);
    expect(await prisma.loteamento.count()).toBe(0);
  });

  it('importa planilha CSV válida criando loteamentos e quadras, com auditoria', async () => {
    const res = await importar(
      csv(
        'Bela Vista;A;1;360,50;250000;sim',
        'Bela Vista;A;2;300;;não',
        'Vista Alegre;1;10;1.200,00;99000,9;',
      ),
      { confirmar: 'true', criarCadastros: 'true' },
    ).expect(200);

    expect(res.body).toMatchObject({
      importado: true,
      lotes: 3,
      loteamentosNovos: 2,
      quadrasNovas: 2,
      erros: [],
    });
    const lotes = await prisma.lote.findMany({ orderBy: { numero: 'asc' } });
    expect(
      lotes.map((l) => [
        l.numero,
        l.areaM2.toFixed(2),
        l.valor?.toFixed(2) ?? null,
        l.exibirValorPublico,
        l.status,
      ]),
    ).toEqual([
      ['1', '360.50', '250000.00', true, 'DISPONIVEL'],
      ['10', '1200.00', '99000.90', false, 'DISPONIVEL'],
      ['2', '300.00', null, false, 'DISPONIVEL'],
    ]);
    expect(
      await prisma.historicoAuditoria.count({
        where: {
          usuarioId: usuarios.GESTOR.id,
          acao: 'CRIAR',
          motivo: 'Importação de planilha',
        },
      }),
    ).toBe(7);

    const listagem = await request(app.getHttpServer())
      .get('/v1/lotes?status=DISPONIVEL')
      .auth(usuarios.CONSULTA.token, { type: 'bearer' })
      .expect(200);
    expect(listagem.body.meta.total).toBe(3);
  });

  it('importa planilha XLSX em loteamento e quadra existentes', async () => {
    const { quadra } = await cadastrarBelaVista();
    const xlsx = await new ExcelPlanilha().gerar(
      [
        [
          'Loteamento',
          'Quadra',
          'Número',
          'Área (m²)',
          'Valor',
          'Exibir valor',
        ],
        ['bela vista', 'a', 7, 360.25, 150000, true],
      ],
      'xlsx',
    );

    const res = await importar(
      xlsx,
      { confirmar: 'true' },
      'Lotes.xlsx',
    ).expect(200);

    expect(res.body).toMatchObject({
      importado: true,
      lotes: 1,
      loteamentosNovos: 0,
      quadrasNovas: 0,
    });
    const lote = await prisma.lote.findFirstOrThrow();
    expect(lote).toMatchObject({ quadraId: quadra.id, numero: '7' });
    expect(lote.areaM2.toFixed(2)).toBe('360.25');
  });

  it('não grava nada quando há erros e relata linhas e motivos', async () => {
    await cadastrarBelaVista();

    const res = await importar(
      csv(
        'Bela Vista;A;1;360;;',
        'Bela Vista;A;2;0;;talvez',
        'Outro;A;1;360;;',
        'Bela Vista;Z;1;360;;',
      ),
      { confirmar: 'true' },
    ).expect(200);

    expect(res.body).toMatchObject({ importado: false, lotes: 1 });
    expect(res.body.erros).toEqual([
      {
        linha: 3,
        mensagens: [
          'area_m2 deve ser um número positivo com até 10 dígitos inteiros e 2 casas decimais',
          'exibir_valor deve ser sim ou não',
        ],
      },
      { linha: 4, mensagens: ['Loteamento "Outro" não cadastrado'] },
      {
        linha: 5,
        mensagens: ['Quadra "Z" não cadastrada no loteamento "Bela Vista"'],
      },
    ]);
    expect(await prisma.lote.count()).toBe(0);
    expect(await prisma.historicoAuditoria.count()).toBe(0);
  });

  it('relata duplicados na planilha e com lotes existentes', async () => {
    const { quadra } = await cadastrarBelaVista();
    await prisma.lote.create({
      data: { quadraId: quadra.id, numero: '5', areaM2: '300' },
    });

    const res = await importar(
      csv(
        'Bela Vista;A;1;360;;',
        'Bela Vista;A;1;300;;',
        'Bela Vista;A;5;300;;',
      ),
      { confirmar: 'true' },
    ).expect(200);

    expect(res.body.importado).toBe(false);
    expect(res.body.erros).toEqual([
      { linha: 3, mensagens: ['Lote repetido na planilha (mesmo da linha 2)'] },
      { linha: 4, mensagens: ['Lote já cadastrado no sistema'] },
    ]);
    expect(await prisma.lote.count()).toBe(1);
  });

  describe('arquivo inválido', () => {
    it('retorna 400 ARQUIVO_OBRIGATORIO sem arquivo', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/lotes/importacao')
        .auth(usuarios.GESTOR.token, { type: 'bearer' })
        .field('confirmar', 'true')
        .expect(400);

      expect(res.body.code).toBe('ARQUIVO_OBRIGATORIO');
    });

    it('retorna 400 com opção inválida', async () => {
      const res = await importar(csv('Bela Vista;A;1;360;;'), {
        confirmar: 'talvez',
      }).expect(400);

      expect(res.body.code).toBe('DADOS_INVALIDOS');
    });

    it.each([
      ['lotes.pdf', csv('x'), 'IMPORTACAO_FORMATO_INVALIDO'],
      ['lotes.xlsx', Buffer.from('não é xlsx'), 'IMPORTACAO_ARQUIVO_INVALIDO'],
      [
        'lotes.csv',
        Buffer.from('loteamento;valor\nA;1'),
        'IMPORTACAO_COLUNAS_AUSENTES',
      ],
      ['lotes.csv', csv(';;;;;'), 'IMPORTACAO_SEM_LINHAS'],
    ])('retorna 422 para %s com %s', async (nome, arquivo, code) => {
      const res = await importar(arquivo, {}, nome).expect(422);

      expect(res.body.code).toBe(code);
    });

    it('retorna 413 ARQUIVO_MUITO_GRANDE acima de 5 MB', async () => {
      const res = await importar(Buffer.alloc(5 * 1024 * 1024 + 1)).expect(413);

      expect(res.body.code).toBe('ARQUIVO_MUITO_GRANDE');
    });
  });

  describe('GET /v1/lotes/importacao/modelo', () => {
    it('baixa o modelo XLSX que pode ser reimportado', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/lotes/importacao/modelo')
        .auth(usuarios.GESTOR.token, { type: 'bearer' })
        .buffer(true)
        .parse((resposta, callback) => {
          const partes: Buffer[] = [];
          resposta.on('data', (parte: Buffer) => partes.push(parte));
          resposta.on('end', () => callback(null, Buffer.concat(partes)));
        })
        .expect(200);

      expect(res.headers['content-type']).toContain('spreadsheetml');
      expect(res.headers['content-disposition']).toBe(
        'attachment; filename="modelo-importacao-lotes.xlsx"',
      );
      const previa = await importar(
        res.body as Buffer,
        { criarCadastros: 'true' },
        'modelo.xlsx',
      ).expect(200);
      expect(previa.body).toMatchObject({ lotes: 1, erros: [] });
    });

    it('baixa o modelo CSV', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/lotes/importacao/modelo?formato=csv')
        .auth(usuarios.GESTOR.token, { type: 'bearer' })
        .expect(200);

      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.text).toContain(CABECALHO);
      expect(res.text).toContain(
        'Residencial Exemplo;A;1;360,00;250000,00;sim',
      );
    });

    it('retorna 400 com formato desconhecido', async () => {
      await request(app.getHttpServer())
        .get('/v1/lotes/importacao/modelo?formato=pdf')
        .auth(usuarios.GESTOR.token, { type: 'bearer' })
        .expect(400);
    });
  });

  it.each(PERFIS)('aplica a matriz de cadastros para %s', async (perfil) => {
    const permitido = perfil === 'ADMINISTRADOR' || perfil === 'GESTOR';
    const token = usuarios[perfil].token;

    await importar(
      csv('Bela Vista;A;1;360;;'),
      { criarCadastros: 'true' },
      'lotes.csv',
      token,
    ).expect(permitido ? 200 : 403);
    await request(app.getHttpServer())
      .get('/v1/lotes/importacao/modelo')
      .auth(token, { type: 'bearer' })
      .expect(permitido ? 200 : 403);
  });
});
