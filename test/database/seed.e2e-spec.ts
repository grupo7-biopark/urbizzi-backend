import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { runSeed } from '../../src/seed/run-seed.js';
import { parseSeedEnv } from '../../src/seed/seed-env.js';
import {
  seedId,
  PLANTA_DEV_ID,
  ORIGINAL_DEV,
  TILE_DEV,
} from '../../src/seed/development-map.js';
import { USUARIOS_DEV } from '../../src/seed/seed.repository.js';
import type { Storage } from '../../src/shared/application/storage/storage.interface.js';
import { StorageService } from '../../src/shared/infra/storage/storage.service.js';
import { PrismaService } from '../../src/shared/infra/database/prisma.service.js';
import { AuthService } from '../../src/modules/auth/application/services/auth.service.js';
import { criarAppTeste } from '../helpers/feature-test.js';
import { limparBanco } from '../helpers/database.js';

describe('Seed inicial e desenvolvimento (BE-05)', () => {
  let app: INestApplication, prisma: PrismaService, storage: StorageService;
  const base = {
    DATABASE_URL: 'postgresql://teste:teste@localhost/teste',
    SEED_ADMIN_NOME: 'Administrador fictício',
    SEED_ADMIN_EMAIL: 'admin.seed@exemplo.com',
    SEED_ADMIN_SENHA: 'SenhaFicticiaSeed123!',
  };
  const config = parseSeedEnv(base),
    dev = parseSeedEnv(
      {
        ...base,
        NODE_ENV: 'development',
        SEED_DEV_SENHA: 'SenhaFicticiaDev123!',
      },
      true,
    );
  beforeAll(async () => {
    app = await criarAppTeste();
    prisma = app.get(PrismaService);
    storage = app.get(StorageService);
  });
  beforeEach(async () => limparBanco(prisma));
  afterEach(() => vi.restoreAllMocks());
  afterAll(async () => {
    if (storage) {
      await storage.delete('originais', ORIGINAL_DEV);
      await storage.delete('tiles', TILE_DEV);
    }
    await app?.close();
  });
  it('roda duas vezes sem duplicar perfis, configurações ou administrador e permite login', async () => {
    await runSeed(prisma, config);
    await runSeed(prisma, config);
    expect(await prisma.perfil.count()).toBe(4);
    expect(await prisma.configuracao.count()).toBe(2);
    expect(await prisma.usuario.count()).toBe(1);
    expect((await prisma.configuracao.findMany()).map((c) => c.valor)).toEqual([
      '7',
      '7',
    ]);
    const login = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: config.SEED_ADMIN_EMAIL, senha: config.SEED_ADMIN_SENHA })
      .expect(200);
    expect(login.body.accessToken).toEqual(expect.any(String));
    const usuario = await prisma.usuario.findUniqueOrThrow({
      where: { email: config.SEED_ADMIN_EMAIL },
      include: { perfil: true },
    });
    expect(usuario.perfil.codigo).toBe('ADMINISTRADOR');
    expect(usuario.senhaHash).toMatch(/^\$argon2id\$/);
    expect(JSON.stringify(login.body)).not.toContain(usuario.senhaHash);
  });
  it('preserva senhas, nomes, situação e prazos alterados', async () => {
    await runSeed(prisma, config);
    const usuario = await prisma.usuario.update({
      where: { email: config.SEED_ADMIN_EMAIL },
      data: { nome: 'Nome editado', ativo: false },
    });
    await prisma.configuracao.update({
      where: { chave: 'prazo_reserva_dias' },
      data: { valor: '3' },
    });
    await runSeed(prisma, {
      ...config,
      SEED_ADMIN_NOME: 'Outro nome',
      SEED_ADMIN_SENHA: 'OutraSenhaFicticia123!',
    });
    expect(
      await prisma.usuario.findUniqueOrThrow({ where: { id: usuario.id } }),
    ).toMatchObject({
      nome: 'Nome editado',
      ativo: false,
      senhaHash: usuario.senhaHash,
      updatedAt: usuario.updatedAt,
    });
    expect(
      await prisma.configuracao.findUniqueOrThrow({
        where: { chave: 'prazo_reserva_dias' },
      }),
    ).toMatchObject({ valor: '3' });
  });
  it('não promove conta existente e desfaz todas as inserções em conflito', async () => {
    const perfil = await prisma.perfil.create({
      data: { codigo: 'COMERCIAL', nome: 'Comercial' },
    });
    const usuario = await prisma.usuario.create({
      data: {
        nome: 'Conta existente',
        email: config.SEED_ADMIN_EMAIL,
        senhaHash: 'hash-preservado',
        perfilId: perfil.id,
      },
    });
    await expect(runSeed(prisma, config)).rejects.toThrow(
      'Nenhuma conta foi promovida',
    );
    expect(await prisma.perfil.count()).toBe(1);
    expect(await prisma.configuracao.count()).toBe(0);
    expect(
      await prisma.usuario.findUniqueOrThrow({ where: { id: usuario.id } }),
    ).toMatchObject({ perfilId: perfil.id, senhaHash: 'hash-preservado' });
  });
  it('serializa execuções concorrentes sem duplicar o bootstrap', async () => {
    await Promise.all([runSeed(prisma, config), runSeed(prisma, config)]);
    expect(await prisma.usuario.count()).toBe(1);
    expect(await prisma.perfil.count()).toBe(4);
    expect(await prisma.configuracao.count()).toBe(2);
  });
  it('cria exemplos, arquivos reais e mapa navegável, sem sobrescrever na repetição', async () => {
    const upload = vi.spyOn(storage, 'upload');
    await runSeed(prisma, dev, storage);
    const lote = await prisma.lote.update({
      where: { id: seedId(103) },
      data: { observacoes: 'Alteração preservada', status: 'BLOQUEADO' },
    });
    await runSeed(prisma, dev, storage);
    expect(upload).toHaveBeenCalledTimes(2);
    expect(await prisma.usuario.count()).toBe(4);
    expect(await prisma.loteamento.count()).toBe(2);
    expect(await prisma.quadra.count()).toBe(4);
    expect(await prisma.lote.count()).toBe(12);
    expect(await prisma.cliente.count()).toBe(2);
    expect(await prisma.reserva.count()).toBe(2);
    expect(await prisma.proposta.count()).toBe(2);
    expect(await prisma.planta.count()).toBe(1);
    expect(await prisma.marcador.count()).toBe(12);
    expect(
      await prisma.lote.findUniqueOrThrow({ where: { id: lote.id } }),
    ).toMatchObject({
      observacoes: 'Alteração preservada',
      status: 'BLOQUEADO',
      updatedAt: lote.updatedAt,
    });
    const login = await app.get(AuthService).login({
      email: config.SEED_ADMIN_EMAIL,
      senha: config.SEED_ADMIN_SENHA,
    });
    const mapa = await request(app.getHttpServer())
      .get('/v1/mapa')
      .auth(login.accessToken, { type: 'bearer' })
      .expect(200);
    expect(mapa.body.marcadores.meta.total).toBe(12);
    expect(mapa.body.planta.id).toBe(PLANTA_DEV_ID);
    await request(app.getHttpServer())
      .get(`/v1/plantas/${PLANTA_DEV_ID}/tiles/0/0/0.webp`)
      .expect('Content-Type', /image\/webp/)
      .expect(200);
    for (const usuario of USUARIOS_DEV) {
      const tokens = await app
        .get(AuthService)
        .login({ email: usuario.email, senha: dev.SEED_DEV_SENHA! });
      expect(tokens.accessToken).toEqual(expect.any(String));
    }
  });
  it('falha no armazenamento não deixa planta pronta nem dados incompletos no banco', async () => {
    const upload = vi
      .fn()
      .mockRejectedValue(new Error('Falha simulada no armazenamento'));
    await expect(
      runSeed(prisma, dev, { upload } as unknown as Storage),
    ).rejects.toThrow('Falha simulada');
    expect(await prisma.usuario.count()).toBe(0);
    expect(await prisma.planta.count()).toBe(0);
    expect(await prisma.lote.count()).toBe(0);
  });
});
