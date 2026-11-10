import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { criarAppTeste, criarUsuarioTeste } from '../helpers/feature-test.js';
import { criarCenarioMapa } from '../helpers/mapa.js';
import { limparBanco } from '../helpers/database.js';
import { PrismaService } from '../../src/shared/infra/database/prisma.service.js';
import { AuditoriaService } from '../../src/modules/auditoria/application/services/auditoria.service.js';
import { ExpiracaoReservaService } from '../../src/modules/reservas/application/services/expiracao-reserva.service.js';
import { adicionarDiasUteis } from '../../src/shared/domain/dias-uteis.js';

describe('Propostas (e2e)', () => {
  let app: INestApplication,
    prisma: PrismaService,
    c: Awaited<ReturnType<typeof criarCenarioMapa>>,
    reservaId: string;
  const dto = {
    valor: '123456.78',
    condicoes: 'Pagamento confidencial',
    observacoes: 'Observação privada',
  };

  beforeAll(async () => {
    app = await criarAppTeste();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await limparBanco(prisma);
    c = await criarCenarioMapa(app);
    const r = await request(app.getHttpServer())
      .post('/v1/reservas')
      .auth(c.usuarios.COMERCIAL.token, { type: 'bearer' })
      .send({ loteId: c.lotes[0].id, clienteId: c.cliente.id })
      .expect(201);
    reservaId = r.body.id;
  });

  afterEach(() => vi.restoreAllMocks());
  afterAll(async () => {
    await app?.close();
  });

  const url = () => '/v1/reservas/' + reservaId + '/propostas';
  const criar = (perfil: keyof typeof c.usuarios = 'COMERCIAL') =>
    request(app.getHttpServer())
      .post(url())
      .auth(c.usuarios[perfil].token, { type: 'bearer' })
      .send(dto);
  const decidir = (id: string, acao: 'aprovar' | 'rejeitar') =>
    request(app.getHttpServer())
      .post(`/v1/propostas/${id}/${acao}`)
      .auth(c.usuarios.GESTOR.token, { type: 'bearer' })
      .send({ motivo: 'Decisão da gestão' });

  const vencerReserva = () =>
    prisma.reserva.update({
      where: { id: reservaId },
      data: {
        dataInicio: new Date(Date.now() - 86400000),
        dataVencimento: new Date(Date.now() - 1000),
      },
    });

  async function verificarSemDecisao(id: string) {
    expect(
      await prisma.proposta.findUniqueOrThrow({ where: { id } }),
    ).toMatchObject({
      status: 'EM_ANALISE',
      decididoPorId: null,
      dataDecisao: null,
      motivoDecisao: null,
    });
    const auditoria = await prisma.historicoAuditoria.findMany({
      where: { entidadeTipo: 'Proposta', entidadeId: id },
    });
    expect(auditoria.map(({ acao }) => acao)).toEqual(['CRIAR']);
  }

  it('cria com prazo configurado, consulta, lista e audita sem alterar lote', async () => {
    await prisma.configuracao.create({
      data: { chave: 'prazo_analise_dias_uteis', valor: '3' },
    });
    const p = (await criar().expect(201)).body;
    expect(p).toMatchObject({
      status: 'EM_ANALISE',
      vendedorId: c.usuarios.COMERCIAL.id,
      valor: dto.valor,
      atrasada: false,
    });
    expect(p.prazoLimite).toBe(
      adicionarDiasUteis(new Date(p.dataEnvio), 3).toISOString(),
    );
    await request(app.getHttpServer())
      .get('/v1/propostas/' + p.id)
      .auth(c.usuarios.COMERCIAL.token, { type: 'bearer' })
      .expect(200);
    const list = await request(app.getHttpServer())
      .get(url() + '?pageSize=1')
      .auth(c.usuarios.GESTOR.token, { type: 'bearer' })
      .expect(200);
    expect(list.body.meta.total).toBe(1);
    expect(
      (await prisma.lote.findUniqueOrThrow({ where: { id: c.lotes[0].id } }))
        .status,
    ).toBe('RESERVADO');
    const audit = await prisma.historicoAuditoria.findMany({
      where: { entidadeId: p.id },
    });
    expect(audit).toHaveLength(1);
    expect(JSON.stringify(audit)).not.toContain(dto.condicoes);
    expect(JSON.stringify(audit)).not.toContain(dto.observacoes);
  });

  it('permite só uma proposta concorrente e rejeita a segunda', async () => {
    const r = await Promise.all([criar(), criar()]);
    expect(r.map((v) => v.status).sort()).toEqual([201, 409]);
    expect(await prisma.proposta.count({ where: { reservaId } })).toBe(1);
  });

  it('preserva rejeitada e permite novo envio sem aceitar proposta após aprovação', async () => {
    const antiga = (await criar().expect(201)).body;
    await prisma.proposta.update({
      where: { id: antiga.id },
      data: {
        status: 'REJEITADA',
        decididoPorId: c.usuarios.GESTOR.id,
        dataDecisao: new Date(),
        motivoDecisao: 'Rejeitada no cenário de teste',
      },
    });
    const nova = (await criar('GESTOR').expect(201)).body;
    expect(nova.vendedorId).toBe(c.usuarios.COMERCIAL.id);
    expect(await prisma.proposta.count({ where: { reservaId } })).toBe(2);
    await prisma.proposta.update({
      where: { id: nova.id },
      data: {
        status: 'APROVADA',
        decididoPorId: c.usuarios.GESTOR.id,
        dataDecisao: new Date(),
        motivoDecisao: 'Aprovada no cenário de teste',
      },
    });
    expect((await criar().expect(409)).body.code).toBe('PROPOSTA_JA_APROVADA');
  });

  it.each(['EXPIRADA', 'CANCELADA', 'CONVERTIDA', 'VENCIDA'] as const)(
    'nega reserva %s',
    async (status) => {
      await prisma.reserva.update({
        where: { id: reservaId },
        data:
          status === 'VENCIDA'
            ? {
                dataInicio: new Date(Date.now() - 86400000),
                dataVencimento: new Date(Date.now() - 1000),
              }
            : { status },
      });
      expect((await criar().expect(409)).body.code).toBe(
        'RESERVA_INVALIDA_PARA_PROPOSTA',
      );
    },
  );

  it('nega Consulta e outro vendedor na criação e leitura', async () => {
    const p = (await criar().expect(201)).body;
    const outro = await criarUsuarioTeste(app, 'COMERCIAL');
    for (const token of [outro.token, c.usuarios.CONSULTA.token]) {
      await request(app.getHttpServer())
        .post(url())
        .auth(token, { type: 'bearer' })
        .send(dto)
        .expect(403);
      await request(app.getHttpServer())
        .get(url())
        .auth(token, { type: 'bearer' })
        .expect(403);
      await request(app.getHttpServer())
        .get('/v1/propostas/' + p.id)
        .auth(token, { type: 'bearer' })
        .expect(403);
    }
  });

  it('aceita Admin, exige login e valida corpo, paginação e recursos', async () => {
    await request(app.getHttpServer()).post(url()).send(dto).expect(401);
    for (const invalid of [
      { ...dto, valor: '0' },
      { ...dto, valor: '1.001' },
      { ...dto, condicoes: ' ' },
      { ...dto, vendedorId: randomUUID() },
    ])
      await request(app.getHttpServer())
        .post(url())
        .auth(c.usuarios.ADMINISTRADOR.token, { type: 'bearer' })
        .send(invalid)
        .expect(400);
    await criar('ADMINISTRADOR').expect(201);
    await request(app.getHttpServer())
      .get(url() + '?page=0')
      .auth(c.usuarios.ADMINISTRADOR.token, { type: 'bearer' })
      .expect(400);
    await request(app.getHttpServer())
      .get('/v1/propostas/' + randomUUID())
      .auth(c.usuarios.ADMINISTRADOR.token, { type: 'bearer' })
      .expect(404);
    await request(app.getHttpServer())
      .post('/v1/reservas/' + randomUUID() + '/propostas')
      .auth(c.usuarios.ADMINISTRADOR.token, { type: 'bearer' })
      .send(dto)
      .expect(404);
    const doc = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().addBearerAuth().build(),
    );
    expect(
      doc.paths['/v1/reservas/{reservaId}/propostas'].post?.responses,
    ).toHaveProperty('409');
    expect(
      doc.paths['/v1/propostas/{id}/aprovar'].post?.responses,
    ).toHaveProperty('200');
    expect(
      doc.paths['/v1/propostas/{id}/rejeitar'].post?.responses,
    ).toHaveProperty('200');
    expect(doc.paths['/v1/propostas/pendentes'].get?.responses).toHaveProperty(
      '200',
    );
    expect(doc.paths['/v1/propostas/minhas'].get?.responses).toHaveProperty(
      '200',
    );
  });

  it('reverte escrita se auditoria falhar', async () => {
    vi.spyOn(app.get(AuditoriaService), 'registrar').mockRejectedValue(
      new Error('Falha simulada'),
    );
    await criar().expect(500);
    expect(await prisma.proposta.count({ where: { reservaId } })).toBe(0);
  });

  it('revalida a reserva depois de aguardar uma alteração concorrente', async () => {
    let liberar!: () => void;
    let sinalizar!: () => void;
    const pausa = new Promise<void>((resolve) => {
      liberar = resolve;
    });
    const entrou = new Promise<void>((resolve) => {
      sinalizar = resolve;
    });
    const alteracao = prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM reservas WHERE id = ${reservaId}::uuid FOR UPDATE`;
        sinalizar();
        await pausa;
        await tx.reserva.update({
          where: { id: reservaId },
          data: { status: 'EXPIRADA' },
        });
      },
      { timeout: 10000 },
    );
    await entrou;
    const envio = criar().then((response) => response);
    try {
      let aguardando = false;
      const limite = Date.now() + 3000;
      while (Date.now() < limite && !aguardando) {
        const rows = await prisma.$queryRaw<
          { bloqueadas: number }[]
        >`SELECT count(*)::int AS bloqueadas FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock' AND query ILIKE '%reservas%'`;
        aguardando = rows[0].bloqueadas > 0;
        if (!aguardando)
          await new Promise((resolve) => setTimeout(resolve, 20));
      }
      expect(aguardando).toBe(true);
    } finally {
      liberar();
    }
    await alteracao;
    expect((await envio).status).toBe(409);
    expect(await prisma.proposta.count({ where: { reservaId } })).toBe(0);
  });

  it('aprova proposta com motivo, registra decisor e data, audita e mantém lote reservado', async () => {
    const p = (await criar().expect(201)).body;

    const res = await request(app.getHttpServer())
      .post('/v1/propostas/' + p.id + '/aprovar')
      .auth(c.usuarios.GESTOR.token, { type: 'bearer' })
      .send({ motivo: ' Proposta dentro da política comercial ' })
      .expect(200);

    expect(res.body).toMatchObject({
      id: p.id,
      status: 'APROVADA',
      decididoPorId: c.usuarios.GESTOR.id,
      motivoDecisao: 'Proposta dentro da política comercial',
      atrasada: false,
    });
    expect(res.body.dataDecisao).toBeTruthy();

    const noBanco = await prisma.proposta.findUniqueOrThrow({
      where: { id: p.id },
    });
    expect(noBanco.status).toBe('APROVADA');
    expect(noBanco.decididoPorId).toBe(c.usuarios.GESTOR.id);
    expect(noBanco.motivoDecisao).toBe('Proposta dentro da política comercial');

    // Lote continua RESERVADO (RN17)
    const lote = await prisma.lote.findUniqueOrThrow({
      where: { id: c.lotes[0].id },
    });
    expect(lote.status).toBe('RESERVADO');

    // Auditoria
    const audit = await prisma.historicoAuditoria.findFirstOrThrow({
      where: { entidadeId: p.id, acao: 'APROVAR' },
    });
    expect(audit).toMatchObject({
      usuarioId: c.usuarios.GESTOR.id,
      entidadeTipo: 'Proposta',
      acao: 'APROVAR',
      motivo: 'Proposta dentro da política comercial',
      valorAnterior: { status: 'EM_ANALISE' },
      valorNovo: { status: 'APROVADA' },
    });
  });

  it('rejeita proposta com motivo, registra decisor e data, audita e mantém lote reservado', async () => {
    const p = (await criar().expect(201)).body;

    const res = await request(app.getHttpServer())
      .post('/v1/propostas/' + p.id + '/rejeitar')
      .auth(c.usuarios.ADMINISTRADOR.token, { type: 'bearer' })
      .send({ motivo: ' Valor abaixo do mínimo ' })
      .expect(200);

    expect(res.body).toMatchObject({
      id: p.id,
      status: 'REJEITADA',
      decididoPorId: c.usuarios.ADMINISTRADOR.id,
      motivoDecisao: 'Valor abaixo do mínimo',
      atrasada: false,
    });
    expect(res.body.dataDecisao).toBeTruthy();

    const noBanco = await prisma.proposta.findUniqueOrThrow({
      where: { id: p.id },
    });
    expect(noBanco.status).toBe('REJEITADA');
    expect(noBanco.decididoPorId).toBe(c.usuarios.ADMINISTRADOR.id);
    expect(noBanco.motivoDecisao).toBe('Valor abaixo do mínimo');

    // Lote continua RESERVADO
    const lote = await prisma.lote.findUniqueOrThrow({
      where: { id: c.lotes[0].id },
    });
    expect(lote.status).toBe('RESERVADO');

    // Auditoria
    const audit = await prisma.historicoAuditoria.findFirstOrThrow({
      where: { entidadeId: p.id, acao: 'REJEITAR' },
    });
    expect(audit).toMatchObject({
      usuarioId: c.usuarios.ADMINISTRADOR.id,
      entidadeTipo: 'Proposta',
      acao: 'REJEITAR',
      motivo: 'Valor abaixo do mínimo',
      valorAnterior: { status: 'EM_ANALISE' },
      valorNovo: { status: 'REJEITADA' },
    });
  });

  it('impede decidir duas vezes uma proposta já decidida (409)', async () => {
    const p = (await criar().expect(201)).body;

    await request(app.getHttpServer())
      .post('/v1/propostas/' + p.id + '/aprovar')
      .auth(c.usuarios.GESTOR.token, { type: 'bearer' })
      .send({ motivo: 'Primeira aprovação' })
      .expect(200);

    // Tenta aprovar novamente
    const repAprovar = await request(app.getHttpServer())
      .post('/v1/propostas/' + p.id + '/aprovar')
      .auth(c.usuarios.GESTOR.token, { type: 'bearer' })
      .send({ motivo: 'Segunda aprovação' })
      .expect(409);
    expect(repAprovar.body.code).toBe('PROPOSTA_JA_DECIDIDA');

    // Tenta rejeitar proposta já aprovada
    const repRejeitar = await request(app.getHttpServer())
      .post('/v1/propostas/' + p.id + '/rejeitar')
      .auth(c.usuarios.GESTOR.token, { type: 'bearer' })
      .send({ motivo: 'Tentando rejeitar' })
      .expect(409);
    expect(repRejeitar.body.code).toBe('PROPOSTA_JA_DECIDIDA');
  });

  it('grava só uma decisão quando aprovação e rejeição concorrem', async () => {
    const { id } = (await criar().expect(201)).body;
    const respostas = await Promise.all([
      decidir(id, 'aprovar'),
      decidir(id, 'rejeitar'),
    ]);
    expect(respostas.map(({ status }) => status).sort()).toEqual([200, 409]);
    const vencedora = respostas.find(({ status }) => status === 200)!.body;
    expect(respostas.find(({ status }) => status === 409)!.body.code).toBe(
      'PROPOSTA_JA_DECIDIDA',
    );
    expect(
      await prisma.proposta.findUniqueOrThrow({ where: { id } }),
    ).toMatchObject({
      status: vencedora.status,
      decididoPorId: vencedora.decididoPorId,
      dataDecisao: new Date(vencedora.dataDecisao),
      motivoDecisao: vencedora.motivoDecisao,
    });
    const auditoria = await prisma.historicoAuditoria.findMany({
      where: { entidadeId: id, acao: { in: ['APROVAR', 'REJEITAR'] } },
    });
    expect(auditoria).toHaveLength(1);
    expect(auditoria[0].valorNovo).toEqual({ status: vencedora.status });
  });

  it.each(['aprovar', 'rejeitar'] as const)(
    'desfaz %s se a auditoria falhar',
    async (acao) => {
      const { id } = (await criar().expect(201)).body;
      const auditoria = app.get(AuditoriaService);
      const registrar = auditoria.registrar.bind(auditoria);
      vi.spyOn(auditoria, 'registrar').mockImplementation(async (dados, tx) => {
        const registro = await registrar(dados, tx);
        if (dados.entidadeId === id) throw new Error('Falha simulada');
        return registro;
      });
      await decidir(id, acao).expect(500);
      await verificarSemDecisao(id);
    },
  );

  it.each(['CANCELADA', 'CONVERTIDA'] as const)(
    'nega aprovação de proposta com reserva %s',
    async (status) => {
      const { id } = (await criar().expect(201)).body;
      await prisma.reserva.update({
        where: { id: reservaId },
        data: { status },
      });
      expect((await decidir(id, 'aprovar').expect(409)).body.code).toBe(
        'RESERVA_INVALIDA_PARA_PROPOSTA',
      );
      await verificarSemDecisao(id);
    },
  );

  it('nega aprovação antes e depois da expiração e permite registrar rejeição', async () => {
    const { id } = (await criar().expect(201)).body;
    await vencerReserva();
    expect((await decidir(id, 'aprovar').expect(409)).body.code).toBe(
      'RESERVA_INVALIDA_PARA_PROPOSTA',
    );
    await verificarSemDecisao(id);
    expect(await app.get(ExpiracaoReservaService).executar()).toEqual({
      expiradas: 1,
      falhas: 0,
    });
    expect((await decidir(id, 'aprovar').expect(409)).body.code).toBe(
      'RESERVA_INVALIDA_PARA_PROPOSTA',
    );
    await verificarSemDecisao(id);
    expect((await decidir(id, 'rejeitar').expect(200)).body.status).toBe(
      'REJEITADA',
    );
    expect(
      await prisma.lote.findUniqueOrThrow({ where: { id: c.lotes[0].id } }),
    ).toMatchObject({ status: 'DISPONIVEL' });
  });

  it('nega aprovação concorrente com a expiração da reserva', async () => {
    const { id } = (await criar().expect(201)).body;
    await vencerReserva();
    const expiracao = app.get(ExpiracaoReservaService);
    const [aprovacao, primeira] = await Promise.all([
      decidir(id, 'aprovar').expect(409),
      expiracao.executar(),
    ]);
    expect(aprovacao.body.code).toBe('RESERVA_INVALIDA_PARA_PROPOSTA');
    // O job pode pular a linha enquanto a requisição de aprovação a bloqueia.
    const segunda = await expiracao.executar();
    expect(primeira.expiradas + segunda.expiradas).toBe(1);
    expect(primeira.falhas + segunda.falhas).toBe(0);
    expect(
      await prisma.reserva.findUniqueOrThrow({ where: { id: reservaId } }),
    ).toMatchObject({ status: 'EXPIRADA' });
    await verificarSemDecisao(id);
  });

  it('exige motivo obrigatório na aprovação e rejeição (400)', async () => {
    const p = (await criar().expect(201)).body;

    for (const invalid of [
      {},
      { motivo: '' },
      { motivo: '   ' },
      { motivo: null },
      { motivo: 'Válido', campoExtra: 'Inválido' },
    ]) {
      await request(app.getHttpServer())
        .post('/v1/propostas/' + p.id + '/aprovar')
        .auth(c.usuarios.GESTOR.token, { type: 'bearer' })
        .send(invalid)
        .expect(400);

      await request(app.getHttpServer())
        .post('/v1/propostas/' + p.id + '/rejeitar')
        .auth(c.usuarios.GESTOR.token, { type: 'bearer' })
        .send(invalid)
        .expect(400);
    }
  });

  it('valida permissões: Comercial e Consulta não decidem nem veem pendentes; Comercial vê minhas', async () => {
    const p = (await criar().expect(201)).body;

    // Decisão requer Gestor ou Admin
    await request(app.getHttpServer())
      .post('/v1/propostas/' + p.id + '/aprovar')
      .send({ motivo: 'Sem token' })
      .expect(401);

    await request(app.getHttpServer())
      .post('/v1/propostas/' + p.id + '/aprovar')
      .auth(c.usuarios.COMERCIAL.token, { type: 'bearer' })
      .send({ motivo: 'Comercial decidindo' })
      .expect(403);

    await request(app.getHttpServer())
      .post('/v1/propostas/' + p.id + '/rejeitar')
      .auth(c.usuarios.COMERCIAL.token, { type: 'bearer' })
      .send({ motivo: 'Comercial decidindo' })
      .expect(403);

    await request(app.getHttpServer())
      .post('/v1/propostas/' + p.id + '/aprovar')
      .auth(c.usuarios.CONSULTA.token, { type: 'bearer' })
      .send({ motivo: 'Consulta decidindo' })
      .expect(403);

    // GET /propostas/pendentes só para Gestor e Admin
    await request(app.getHttpServer())
      .get('/v1/propostas/pendentes')
      .auth(c.usuarios.COMERCIAL.token, { type: 'bearer' })
      .expect(403);

    await request(app.getHttpServer())
      .get('/v1/propostas/pendentes')
      .auth(c.usuarios.CONSULTA.token, { type: 'bearer' })
      .expect(403);

    const pendentes = await request(app.getHttpServer())
      .get('/v1/propostas/pendentes')
      .auth(c.usuarios.GESTOR.token, { type: 'bearer' })
      .expect(200);
    expect(pendentes.body.meta.total).toBe(1);

    // GET /propostas/minhas disponível para Comercial, bloqueado para Consulta
    await request(app.getHttpServer())
      .get('/v1/propostas/minhas')
      .auth(c.usuarios.CONSULTA.token, { type: 'bearer' })
      .expect(403);

    const minhas = await request(app.getHttpServer())
      .get('/v1/propostas/minhas')
      .auth(c.usuarios.COMERCIAL.token, { type: 'bearer' })
      .expect(200);
    expect(minhas.body.meta.total).toBe(2);
    expect(minhas.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: p.id, status: 'EM_ANALISE' }),
        expect.objectContaining({
          reservaId: c.reserva.id,
          status: 'APROVADA',
        }),
      ]),
    );
    const outro = await criarUsuarioTeste(app, 'COMERCIAL');
    const minhasDoOutro = await request(app.getHttpServer())
      .get('/v1/propostas/minhas')
      .auth(outro.token, { type: 'bearer' })
      .expect(200);
    expect(minhasDoOutro.body.data).toEqual([]);
  });

  it('exibe flag atrasada em propostas vencidas sem mudar status no banco e ordena pendentes', async () => {
    // Proposta 1: no prazo normal
    const p1 = (await criar().expect(201)).body;

    // Cria outro lote e reserva para o Comercial
    const lote2 = await prisma.lote.create({
      data: { quadraId: c.quadras[0].id, numero: '999', areaM2: '150' },
    });
    const r2 = await request(app.getHttpServer())
      .post('/v1/reservas')
      .auth(c.usuarios.COMERCIAL.token, { type: 'bearer' })
      .send({ loteId: lote2.id, clienteId: c.cliente.id })
      .expect(201);

    // Proposta 2: na segunda reserva
    const p2 = (
      await request(app.getHttpServer())
        .post('/v1/reservas/' + r2.body.id + '/propostas')
        .auth(c.usuarios.COMERCIAL.token, { type: 'bearer' })
        .send(dto)
        .expect(201)
    ).body;

    // Força prazoLimite de p2 para o passado no banco (vencida)
    const prazoPassado = new Date(Date.now() - 86400000);
    await prisma.proposta.update({
      where: { id: p2.id },
      data: { prazoLimite: prazoPassado },
    });

    // Gestor consulta pendentes: p2 (atrasada) deve vir primeiro pela ordenação prazoLimite asc
    const pendentes = await request(app.getHttpServer())
      .get('/v1/propostas/pendentes')
      .auth(c.usuarios.GESTOR.token, { type: 'bearer' })
      .expect(200);

    expect(pendentes.body.meta.total).toBe(2);
    expect(pendentes.body.data[0].id).toBe(p2.id);
    expect(pendentes.body.data[0].atrasada).toBe(true);
    expect(pendentes.body.data[0].status).toBe('EM_ANALISE');

    expect(pendentes.body.data[1].id).toBe(p1.id);
    expect(pendentes.body.data[1].atrasada).toBe(false);
    expect(pendentes.body.data[1].status).toBe('EM_ANALISE');

    // Verifica que o status no banco permanece estritamente EM_ANALISE
    const p2Db = await prisma.proposta.findUniqueOrThrow({
      where: { id: p2.id },
    });
    expect(p2Db.status).toBe('EM_ANALISE');

    // Vendedor consulta /propostas/minhas e vê a flag atrasada
    const minhas = await request(app.getHttpServer())
      .get('/v1/propostas/minhas')
      .auth(c.usuarios.COMERCIAL.token, { type: 'bearer' })
      .expect(200);

    expect(minhas.body.meta.total).toBe(3);
    const itemAtrasado = minhas.body.data.find(
      (item: { id: string }) => item.id === p2.id,
    );
    expect(itemAtrasado.atrasada).toBe(true);
    expect(itemAtrasado.status).toBe('EM_ANALISE');

    expect((await decidir(p2.id, 'aprovar').expect(200)).body).toMatchObject({
      status: 'APROVADA',
      atrasada: false,
    });
  });
});
