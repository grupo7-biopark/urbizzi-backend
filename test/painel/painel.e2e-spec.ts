import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../../src/shared/infra/database/prisma.service.js';
import { limparBanco } from '../helpers/database.js';
import { criarAppTeste, criarUsuarioTeste } from '../helpers/feature-test.js';

describe('Painel de Indicadores (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let admin: Awaited<ReturnType<typeof criarUsuarioTeste>>;
  let gestor: Awaited<ReturnType<typeof criarUsuarioTeste>>;
  let comercial1: Awaited<ReturnType<typeof criarUsuarioTeste>>;
  let comercial2: Awaited<ReturnType<typeof criarUsuarioTeste>>;
  let consulta: Awaited<ReturnType<typeof criarUsuarioTeste>>;

  let loteamentoAlpha: { id: string; nome: string };
  let loteamentoBeta: { id: string; nome: string };

  beforeAll(async () => {
    app = await criarAppTeste();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(async () => {
    await limparBanco(prisma);

    admin = await criarUsuarioTeste(app, 'ADMINISTRADOR');
    gestor = await criarUsuarioTeste(app, 'GESTOR');
    comercial1 = await criarUsuarioTeste(app, 'COMERCIAL');
    comercial2 = await criarUsuarioTeste(app, 'COMERCIAL');
    consulta = await criarUsuarioTeste(app, 'CONSULTA');

    loteamentoAlpha = await prisma.loteamento.create({
      data: { nome: 'Loteamento Alpha' },
    });
    loteamentoBeta = await prisma.loteamento.create({
      data: { nome: 'Loteamento Beta' },
    });

    const quadraA = await prisma.quadra.create({
      data: { loteamentoId: loteamentoAlpha.id, numero: 'A' },
    });
    const quadraB = await prisma.quadra.create({
      data: { loteamentoId: loteamentoBeta.id, numero: 'B' },
    });

    // Lotes Alpha
    await prisma.lote.create({
      data: {
        quadraId: quadraA.id,
        numero: '1',
        areaM2: '250.00',
        valor: '100000.00',
        status: 'DISPONIVEL',
      },
    });
    const loteA2 = await prisma.lote.create({
      data: {
        quadraId: quadraA.id,
        numero: '2',
        areaM2: '250.00',
        valor: '120000.00',
        status: 'RESERVADO',
      },
    });
    const loteA3 = await prisma.lote.create({
      data: {
        quadraId: quadraA.id,
        numero: '3',
        areaM2: '300.00',
        valor: '150000.00',
        status: 'VENDIDO',
      },
    });
    await prisma.lote.create({
      data: {
        quadraId: quadraA.id,
        numero: '4',
        areaM2: '200.00',
        valor: '80000.00',
        status: 'BLOQUEADO',
      },
    });

    // Lotes Beta
    await prisma.lote.create({
      data: {
        quadraId: quadraB.id,
        numero: '1',
        areaM2: '250.00',
        valor: '90000.00',
        status: 'DISPONIVEL',
      },
    });
    const loteB2 = await prisma.lote.create({
      data: {
        quadraId: quadraB.id,
        numero: '2',
        areaM2: '280.00',
        valor: '110000.00',
        status: 'RESERVADO',
      },
    });

    const cliente = await prisma.cliente.create({
      data: {
        nome: 'Cliente Cenário',
        documento: '12345678901',
      },
    });

    const agora = Date.now();

    // Reserva 1: comercial1 no lote A2 (vencimento distante)
    const reserva1 = await prisma.reserva.create({
      data: {
        loteId: loteA2.id,
        clienteId: cliente.id,
        vendedorId: comercial1.id,
        status: 'ATIVA',
        dataInicio: new Date(agora - 2 * 86400000),
        dataVencimento: new Date(agora + 10 * 86400000),
      },
    });

    // Reserva 2: comercial2 no lote B2 (vencendo em breve, +1 dia)
    const reserva2 = await prisma.reserva.create({
      data: {
        loteId: loteB2.id,
        clienteId: cliente.id,
        vendedorId: comercial2.id,
        status: 'ATIVA',
        dataInicio: new Date(agora - 5 * 86400000),
        dataVencimento: new Date(agora + 1 * 86400000),
      },
    });

    // Reserva 3: comercial1 no lote A3 (CONVERTIDA - Venda)
    const reserva3 = await prisma.reserva.create({
      data: {
        loteId: loteA3.id,
        clienteId: cliente.id,
        vendedorId: comercial1.id,
        status: 'CONVERTIDA',
        dataInicio: new Date(agora - 10 * 86400000),
        dataVencimento: new Date(agora + 2 * 86400000),
      },
    });

    // Proposta 1: comercial1 na Reserva 1 (em análise, dentro do prazo)
    await prisma.proposta.create({
      data: {
        reservaId: reserva1.id,
        vendedorId: comercial1.id,
        valor: '120000.00',
        condicoes: 'À vista',
        status: 'EM_ANALISE',
        prazoLimite: new Date(agora + 5 * 86400000),
      },
    });

    // Proposta 2: comercial2 na Reserva 2 (em análise, atrasada!)
    await prisma.proposta.create({
      data: {
        reservaId: reserva2.id,
        vendedorId: comercial2.id,
        valor: '110000.00',
        condicoes: 'Financiado',
        status: 'EM_ANALISE',
        prazoLimite: new Date(agora - 1 * 86400000),
      },
    });

    // Proposta 3: comercial1 na Reserva 3 (aprovada)
    await prisma.proposta.create({
      data: {
        reservaId: reserva3.id,
        vendedorId: comercial1.id,
        valor: '150000.00',
        condicoes: 'Entrada + parcelas',
        status: 'APROVADA',
        decididoPorId: gestor.id,
        dataDecisao: new Date(agora),
        motivoDecisao: 'Aprovada para venda',
        prazoLimite: new Date(agora + 2 * 86400000),
      },
    });
  });

  const get = (token: string, path: string) =>
    request(app.getHttpServer())
      .get(`/v1/painel${path}`)
      .auth(token, { type: 'bearer' });

  describe('GET /v1/painel/resumo', () => {
    it('retorna contagem de lotes por status, geral e por loteamento', async () => {
      const res = await get(gestor.token, '/resumo').expect(200);

      expect(res.header['cache-control']).toBe('no-store');
      expect(res.body.geral).toMatchObject({
        total: 6,
        disponivel: 2,
        reservado: 2,
        vendido: 1,
        bloqueado: 1,
      });

      expect(res.body.porLoteamento).toHaveLength(2);

      const alpha = res.body.porLoteamento.find(
        (l: { id: string }) => l.id === loteamentoAlpha.id,
      );
      expect(alpha).toMatchObject({
        total: 4,
        disponivel: 1,
        reservado: 1,
        vendido: 1,
        bloqueado: 1,
      });

      const beta = res.body.porLoteamento.find(
        (l: { id: string }) => l.id === loteamentoBeta.id,
      );
      expect(beta).toMatchObject({
        total: 2,
        disponivel: 1,
        reservado: 1,
        vendido: 0,
        bloqueado: 0,
      });
    });

    it('filtra por loteamentoId quando informado', async () => {
      const res = await get(
        gestor.token,
        `/resumo?loteamentoId=${loteamentoAlpha.id}`,
      ).expect(200);

      expect(res.body.geral.total).toBe(4);
      expect(res.body.porLoteamento).toHaveLength(1);
      expect(res.body.porLoteamento[0].id).toBe(loteamentoAlpha.id);
    });

    it('retorna 404 se loteamentoId não existir', async () => {
      const res = await get(
        gestor.token,
        '/resumo?loteamentoId=00000000-0000-0000-0000-000000000000',
      ).expect(404);

      expect(res.body.code).toBe('LOTEAMENTO_NAO_ENCONTRADO');
    });

    it('retorna 422 para período invertido', async () => {
      const res = await get(
        gestor.token,
        '/resumo?dataDe=2026-11-10&dataAte=2026-11-01',
      ).expect(422);

      expect(res.body.code).toBe('PERIODO_INVALIDO');
    });
  });

  describe('GET /v1/painel/vendas', () => {
    it('retorna vendas por período e por vendedor', async () => {
      const res = await get(gestor.token, '/vendas').expect(200);

      expect(res.body.total).toBe(1);
      expect(res.body.valorTotal).toBe('150000.00');
      expect(res.body.periodo).toMatchObject({
        dia: 1,
        semana: 1,
        mes: 1,
      });

      expect(res.body.porVendedor).toHaveLength(1);
      expect(res.body.porVendedor[0]).toMatchObject({
        vendedorId: comercial1.id,
        quantidade: 1,
        valorTotal: '150000.00',
      });
    });

    it('filtra vendas por loteamentoId', async () => {
      const resAlpha = await get(
        gestor.token,
        `/vendas?loteamentoId=${loteamentoAlpha.id}`,
      ).expect(200);
      expect(resAlpha.body.total).toBe(1);

      const resBeta = await get(
        gestor.token,
        `/vendas?loteamentoId=${loteamentoBeta.id}`,
      ).expect(200);
      expect(resBeta.body.total).toBe(0);
      expect(resBeta.body.valorTotal).toBe('0.00');
    });

    it('filtra vendas por vendedorId', async () => {
      const resComercial2 = await get(
        gestor.token,
        `/vendas?vendedorId=${comercial2.id}`,
      ).expect(200);

      expect(resComercial2.body.total).toBe(0);
    });

    it('agrupa vendas por semana e mês no banco e calcula semanas ISO de virada (dezembro/janeiro)', async () => {
      // Cria lote e reserva convertida na virada 2019-12-30 (semana 2020-W01)
      const quadra = await prisma.quadra.findFirstOrThrow({
        where: { loteamentoId: loteamentoAlpha.id },
      });
      const clienteVirada = await prisma.cliente.create({
        data: { nome: 'Cliente Virada', documento: '98765432109' },
      });

      const loteVirada1 = await prisma.lote.create({
        data: {
          quadraId: quadra.id,
          numero: 'V1',
          areaM2: '200.00',
          valor: '100000.00',
          status: 'VENDIDO',
        },
      });
      const resVirada1 = await prisma.reserva.create({
        data: {
          loteId: loteVirada1.id,
          clienteId: clienteVirada.id,
          vendedorId: comercial1.id,
          status: 'CONVERTIDA',
          dataInicio: new Date('2019-12-20T00:00:00Z'),
          dataVencimento: new Date('2020-01-10T00:00:00Z'),
        },
      });
      // Força updated_at para 2019-12-30T10:00:00Z (segunda-feira da semana 2020-W01)
      await prisma.$executeRaw`
        UPDATE reservas SET updated_at = '2019-12-30 10:00:00+00'::timestamptz WHERE id = ${resVirada1.id}::uuid
      `;

      // Cria lote e reserva convertida na virada 2021-01-01 (sexta-feira da semana 2020-W53)
      const loteVirada2 = await prisma.lote.create({
        data: {
          quadraId: quadra.id,
          numero: 'V2',
          areaM2: '200.00',
          valor: '200000.00',
          status: 'VENDIDO',
        },
      });
      const resVirada2 = await prisma.reserva.create({
        data: {
          loteId: loteVirada2.id,
          clienteId: clienteVirada.id,
          vendedorId: comercial2.id,
          status: 'CONVERTIDA',
          dataInicio: new Date('2020-12-20T00:00:00Z'),
          dataVencimento: new Date('2021-01-10T00:00:00Z'),
        },
      });
      // Força updated_at para 2021-01-01T10:00:00Z (sexta-feira da semana 2020-W53)
      await prisma.$executeRaw`
        UPDATE reservas SET updated_at = '2021-01-01 10:00:00+00'::timestamptz WHERE id = ${resVirada2.id}::uuid
      `;

      // Consulta vendas agrupadas por semana
      const resSemana = await get(
        gestor.token,
        '/vendas?agrupamento=semana',
      ).expect(200);

      // Verifica que porSemana contém as semanas ISO corretas calculadas no Postgres
      const semana2020W01 = resSemana.body.porSemana.find(
        (s: { semana: string }) => s.semana === '2020-W01',
      );
      expect(semana2020W01).toBeDefined();
      expect(semana2020W01.quantidade).toBe(1);
      expect(semana2020W01.valorTotal).toBe('100000.00');

      const semana2020W53 = resSemana.body.porSemana.find(
        (s: { semana: string }) => s.semana === '2020-W53',
      );
      expect(semana2020W53).toBeDefined();
      expect(semana2020W53.quantidade).toBe(1);
      expect(semana2020W53.valorTotal).toBe('200000.00');

      // Verifica que porPeriodo com agrupamento=semana também reflete exatamente as mesmas semanas ISO
      const periodo2020W01 = resSemana.body.porPeriodo.find(
        (p: { periodo: string }) => p.periodo === '2020-W01',
      );
      expect(periodo2020W01).toBeDefined();
      expect(periodo2020W01.quantidade).toBe(1);
      expect(periodo2020W01.valorTotal).toBe('100000.00');

      const periodo2020W53 = resSemana.body.porPeriodo.find(
        (p: { periodo: string }) => p.periodo === '2020-W53',
      );
      expect(periodo2020W53).toBeDefined();
      expect(periodo2020W53.quantidade).toBe(1);
      expect(periodo2020W53.valorTotal).toBe('200000.00');

      // Consulta vendas agrupadas por mês
      const resMes = await get(gestor.token, '/vendas?agrupamento=mes').expect(
        200,
      );
      const mes201912 = resMes.body.porPeriodo.find(
        (p: { periodo: string }) => p.periodo === '2019-12',
      );
      expect(mes201912).toBeDefined();
      expect(mes201912.quantidade).toBe(1);
      expect(mes201912.valorTotal).toBe('100000.00');

      const mes202101 = resMes.body.porPeriodo.find(
        (p: { periodo: string }) => p.periodo === '2021-01',
      );
      expect(mes202101).toBeDefined();
      expect(mes202101.quantidade).toBe(1);
      expect(mes202101.valorTotal).toBe('200000.00');
    });
  });

  describe('GET /v1/painel/pendencias', () => {
    it('gestor e admin visualizam todas as pendências', async () => {
      const resGestor = await get(gestor.token, '/pendencias').expect(200);

      expect(resGestor.body).toMatchObject({
        reservasAtivas: 2,
        reservasVencendoEmBreve: 1,
        propostasPendentes: 2,
        propostasAtrasadas: 1,
        total: 4,
        reservas: {
          ativas: 2,
          vencendoEmBreve: 1,
        },
        propostas: {
          pendentes: 2,
          atrasadas: 1,
          emDia: 1,
        },
      });

      const resAdmin = await get(admin.token, '/pendencias').expect(200);
      expect(resAdmin.body.total).toBe(4);
    });

    it('comercial visualiza apenas suas próprias pendências', async () => {
      // Comercial 1 tem Reserva 1 (ativa, não vencendo em breve) e Proposta 1 (em dia)
      const res1 = await get(comercial1.token, '/pendencias').expect(200);

      expect(res1.body).toMatchObject({
        reservasAtivas: 1,
        reservasVencendoEmBreve: 0,
        propostasPendentes: 1,
        propostasAtrasadas: 0,
        total: 2,
      });

      // Comercial 2 tem Reserva 2 (ativa, vencendo em breve) e Proposta 2 (atrasada)
      const res2 = await get(comercial2.token, '/pendencias').expect(200);

      expect(res2.body).toMatchObject({
        reservasAtivas: 1,
        reservasVencendoEmBreve: 1,
        propostasPendentes: 1,
        propostasAtrasadas: 1,
        total: 2,
      });

      // Comercial tentando passar vendedorId de outro continua vendo apenas as suas
      const resForced = await get(
        comercial1.token,
        `/pendencias?vendedorId=${comercial2.id}`,
      ).expect(200);
      expect(resForced.body.reservasAtivas).toBe(1);
      expect(resForced.body.propostasPendentes).toBe(1);
    });

    it('filtra pendências por loteamentoId', async () => {
      const resAlpha = await get(
        gestor.token,
        `/pendencias?loteamentoId=${loteamentoAlpha.id}`,
      ).expect(200);

      expect(resAlpha.body.reservasAtivas).toBe(1);
      expect(resAlpha.body.reservasVencendoEmBreve).toBe(0);
      expect(resAlpha.body.propostasPendentes).toBe(1);
      expect(resAlpha.body.propostasAtrasadas).toBe(0);

      const resBeta = await get(
        gestor.token,
        `/pendencias?loteamentoId=${loteamentoBeta.id}`,
      ).expect(200);

      expect(resBeta.body.reservasAtivas).toBe(1);
      expect(resBeta.body.reservasVencendoEmBreve).toBe(1);
      expect(resBeta.body.propostasPendentes).toBe(1);
      expect(resBeta.body.propostasAtrasadas).toBe(1);
    });
  });

  describe('Segurança e Acesso por Perfil', () => {
    it('nega acesso não autenticado com 401', async () => {
      await request(app.getHttpServer()).get('/v1/painel/resumo').expect(401);
      await request(app.getHttpServer()).get('/v1/painel/vendas').expect(401);
      await request(app.getHttpServer())
        .get('/v1/painel/pendencias')
        .expect(401);
    });

    it('todos os perfis internos autenticados têm acesso (200)', async () => {
      for (const token of [
        admin.token,
        gestor.token,
        comercial1.token,
        consulta.token,
      ]) {
        await get(token, '/resumo').expect(200);
        await get(token, '/vendas').expect(200);
        await get(token, '/pendencias').expect(200);
      }
    });
  });
});
