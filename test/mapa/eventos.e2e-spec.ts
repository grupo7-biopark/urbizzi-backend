import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { finalize } from 'rxjs';
import { PrismaService } from '../../src/shared/infra/database/prisma.service.js';
import { AuditoriaService } from '../../src/modules/auditoria/application/services/auditoria.service.js';
import { MapaEventosService } from '../../src/modules/mapa/application/services/mapa-eventos.service.js';
import { criarAppTeste } from '../helpers/feature-test.js';
import { criarCenarioMapa } from '../helpers/mapa.js';
import { limparBanco } from '../helpers/database.js';

describe('Eventos reais do mapa (BE-36)', () => {
  let app: INestApplication,
    prisma: PrismaService,
    base: string,
    c: Awaited<ReturnType<typeof criarCenarioMapa>>;
  const conexoes: AbortController[] = [];
  beforeAll(async () => {
    app = await criarAppTeste();
    prisma = app.get(PrismaService);
    await app.listen(0, '127.0.0.1');
    base = await app.getUrl();
  });
  afterEach(() => {
    conexoes.splice(0).forEach((c) => c.abort());
    vi.restoreAllMocks();
  });
  afterAll(async () => app?.close());
  beforeEach(async () => {
    await limparBanco(prisma);
    c = await criarCenarioMapa(app);
  });
  async function conectar(path = '/v1/mapa/eventos', token?: string) {
    const controller = new AbortController();
    conexoes.push(controller);
    const response = await fetch(base + path, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal: controller.signal,
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/event-stream');
    const eventos: { tipo: string; data: unknown }[] = [],
      estado = { fechado: false };
    const reader = response.body!.getReader(),
      decoder = new TextDecoder();
    void (async () => {
      let buffer = '';
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const blocos = buffer.split(/\r?\n\r?\n/);
          buffer = blocos.pop()!;
          for (const bloco of blocos) {
            const linhas = bloco.split(/\r?\n/);
            const tipo = linhas
              .find((l) => l.startsWith('event:'))
              ?.slice(6)
              .trim();
            const data = linhas
              .find((l) => l.startsWith('data:'))
              ?.slice(5)
              .trim();
            if (tipo && data) eventos.push({ tipo, data: JSON.parse(data) });
          }
        }
      } catch {
        /* O abort encerra o leitor da conexão de teste. */
      } finally {
        estado.fechado = true;
        reader.releaseLock();
      }
    })();
    await vi.waitFor(
      () =>
        expect(eventos).toContainEqual({ tipo: 'ressincronizar', data: {} }),
      { timeout: 5000 },
    );
    return { eventos, estado, close: () => controller.abort() };
  }
  const esperarStatus = (
    eventos: { tipo: string; data: unknown }[],
    loteId: string,
    status: string,
  ) =>
    vi.waitFor(
      () =>
        expect(eventos).toContainEqual({
          tipo: 'status-lote',
          data: { loteId, status },
        }),
      { timeout: 5000 },
    );
  const reservar = () =>
    request(app.getHttpServer())
      .post('/v1/reservas')
      .auth(c.usuarios.COMERCIAL.token, { type: 'bearer' })
      .send({ loteId: c.lotes[0].id, clienteId: c.cliente.id });
  async function link(loteamentoId?: string) {
    return (
      await request(app.getHttpServer())
        .post('/v1/links-publicos')
        .auth(c.usuarios.COMERCIAL.token, { type: 'bearer' })
        .send({ loteamentoId })
        .expect(201)
    ).body as { id: string; token: string };
  }
  it('exige autenticação interna e rejeita token público inválido/desativado sem expor o token', async () => {
    await request(app.getHttpServer()).get('/v1/mapa/eventos').expect(401);
    const invalido = await request(app.getHttpServer())
      .get('/v1/publico/token-invalido/eventos')
      .expect(404);
    expect(invalido.body.path).toBe('/v1/publico/:token');
    const l = await link();
    await prisma.linkPublico.update({
      where: { id: l.id },
      data: { ativo: false },
    });
    await request(app.getHttpServer())
      .get(`/v1/publico/${l.token}/eventos`)
      .expect(404);
  });
  it('reserva e cancelamento confirmados chegam às duas sessões, isolando o escopo público e os dados', async () => {
    const l = await link(c.loteamentos[0].id),
      interno = await conectar(undefined, c.usuarios.GESTOR.token),
      publico = await conectar(`/v1/publico/${l.token}/eventos`);
    const reserva = await reservar().expect(201);
    await esperarStatus(interno.eventos, c.lotes[0].id, 'RESERVADO');
    await esperarStatus(publico.eventos, c.lotes[0].id, 'RESERVADO');
    await prisma.lote.update({
      where: { id: c.lotes[3].id },
      data: { status: 'DISPONIVEL' },
    });
    await esperarStatus(interno.eventos, c.lotes[3].id, 'DISPONIVEL');
    expect(publico.eventos).not.toContainEqual({
      tipo: 'status-lote',
      data: { loteId: c.lotes[3].id, status: 'DISPONIVEL' },
    });
    await request(app.getHttpServer())
      .post(`/v1/reservas/${reserva.body.id}/cancelar`)
      .auth(c.usuarios.COMERCIAL.token, { type: 'bearer' })
      .send({ motivo: 'Desistência do teste' })
      .expect(200);
    await esperarStatus(publico.eventos, c.lotes[0].id, 'DISPONIVEL');
    for (const evento of publico.eventos)
      expect(Object.keys(evento.data as object).sort()).toEqual(
        evento.tipo === 'status-lote' ? ['loteId', 'status'] : [],
      );
    expect(JSON.stringify(publico.eventos)).not.toContain(c.cliente.nome);
    expect(JSON.stringify(publico.eventos)).not.toContain(c.cliente.documento);
  });
  it('rollback da reserva não publica evento de status', async () => {
    const stream = await conectar(undefined, c.usuarios.GESTOR.token);
    const audit = app.get(AuditoriaService);
    vi.spyOn(audit, 'registrar').mockRejectedValueOnce(
      new Error('Falha simulada'),
    );
    await reservar().expect(500);
    // O evento confirmado posterior funciona como barreira, sem espera arbitrária.
    await prisma.lote.update({
      where: { id: c.lotes[3].id },
      data: { status: 'DISPONIVEL' },
    });
    await esperarStatus(stream.eventos, c.lotes[3].id, 'DISPONIVEL');
    expect(stream.eventos).not.toContainEqual({
      tipo: 'status-lote',
      data: { loteId: c.lotes[0].id, status: 'RESERVADO' },
    });
    expect(
      await prisma.lote.findUniqueOrThrow({ where: { id: c.lotes[0].id } }),
    ).toMatchObject({ status: 'DISPONIVEL' });
  });
  it('libera subscription ao desconectar o cliente HTTP', async () => {
    const service = app.get(MapaEventosService),
      original = service.observar.bind(service),
      finalizado = vi.fn();
    vi.spyOn(service, 'observar').mockImplementation((id) =>
      original(id).pipe(finalize(finalizado)),
    );
    const stream = await conectar(undefined, c.usuarios.GESTOR.token);
    stream.close();
    await vi.waitFor(() => expect(finalizado).toHaveBeenCalledOnce(), {
      timeout: 5000,
    });
  });
  it('heartbeat mantém o canal e desativar o link encerra uma conexão existente', async () => {
    const l = await link(),
      stream = await conectar(`/v1/publico/${l.token}/eventos`);
    await vi.waitFor(
      () =>
        expect(stream.eventos).toContainEqual({ tipo: 'heartbeat', data: {} }),
      { timeout: 18000 },
    );
    await request(app.getHttpServer())
      .post(`/v1/links-publicos/${l.id}/desativar`)
      .auth(c.usuarios.COMERCIAL.token, { type: 'bearer' })
      .expect(200);
    await vi.waitFor(() => expect(stream.estado.fechado).toBe(true), {
      timeout: 18000,
    });
  }, 40000);
  it('ressincroniza os clientes depois de perder o LISTEN e recupera as notificações', async () => {
    const l = await link(c.loteamentos[0].id);
    const publico = await conectar(`/v1/publico/${l.token}/eventos`);
    const antesPublico = publico.eventos.filter(
      (e) => e.tipo === 'ressincronizar',
    ).length;
    const stream = await conectar(undefined, c.usuarios.GESTOR.token);
    const antes = stream.eventos.filter(
      (e) => e.tipo === 'ressincronizar',
    ).length;
    const [listener] = await prisma.$queryRaw<
      { pid: number }[]
    >`SELECT pid FROM pg_stat_activity WHERE application_name='urbizzi-mapa-eventos' AND datname=current_database()`;
    expect(listener).toBeDefined();
    await prisma.$queryRaw`SELECT pg_terminate_backend(${listener.pid})`;
    // Este commit ocorre enquanto o LISTEN está desconectado: não existe replay.
    await prisma.lote.update({
      where: { id: c.lotes[0].id },
      data: { status: 'RESERVADO' },
    });
    await vi.waitFor(
      () =>
        expect(
          stream.eventos.filter((e) => e.tipo === 'ressincronizar').length,
        ).toBeGreaterThan(antes),
      { timeout: 10000 },
    );
    await vi.waitFor(
      () =>
        expect(
          publico.eventos.filter((e) => e.tipo === 'ressincronizar').length,
        ).toBeGreaterThan(antesPublico),
      { timeout: 5000 },
    );
    const mapa = await request(app.getHttpServer())
      .get('/v1/mapa')
      .auth(c.usuarios.GESTOR.token, { type: 'bearer' })
      .expect(200);
    expect(
      mapa.body.marcadores.data.find(
        (m: { loteId: string }) => m.loteId === c.lotes[0].id,
      ),
    ).toMatchObject({ status: 'RESERVADO' });
    expect(
      await prisma.lote.findUniqueOrThrow({ where: { id: c.lotes[0].id } }),
    ).toMatchObject({ status: 'RESERVADO' });
    await prisma.lote.update({
      where: { id: c.lotes[3].id },
      data: { status: 'DISPONIVEL' },
    });
    await esperarStatus(stream.eventos, c.lotes[3].id, 'DISPONIVEL');
  }, 20000);
});
