import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import request from 'supertest';
import { PrismaService } from '../../src/shared/infra/database/prisma.service.js';
import { criarAppTeste, criarUsuarioTeste } from '../helpers/feature-test.js';
import { criarUsuarios, type UsuariosTeste } from '../helpers/usuarios.js';
import { limparBanco } from '../helpers/database.js';
import type { HistoricoClienteDto } from '../../src/modules/clientes/application/dto/historico-cliente.dto.js';

describe('Histórico do cliente (e2e)', () => {
  let app: INestApplication, prisma: PrismaService, usuarios: UsuariosTeste;
  let clienteId: string,
    outroClienteId: string,
    loteamentoId: string,
    quadraId: string;
  let reservas: { id: string; loteId: string }[];
  let propostas: { id: string }[];
  beforeAll(async () => {
    app = await criarAppTeste();
    prisma = app.get(PrismaService);
  });
  beforeEach(async () => {
    await limparBanco(prisma);
    usuarios = await criarUsuarios(app);
    const cliente = await prisma.cliente.create({
      data: {
        nome: 'Cliente privado',
        documento: '52998224725',
        email: 'privado@exemplo.com',
        telefone: '45999999999',
      },
    });
    clienteId = cliente.id;
    outroClienteId = (
      await prisma.cliente.create({
        data: { nome: 'Outro cliente', documento: '11144477735' },
      })
    ).id;
    loteamentoId = (
      await prisma.loteamento.create({ data: { nome: 'Residencial Norte' } })
    ).id;
    quadraId = (
      await prisma.quadra.create({ data: { numero: 'A', loteamentoId } })
    ).id;
    reservas = [];
    for (const [i, status] of (
      ['ATIVA', 'CANCELADA', 'EXPIRADA', 'CONVERTIDA'] as const
    ).entries()) {
      const lote = await prisma.lote.create({
        data: { quadraId, numero: String(i + 1), areaM2: '100.00' },
      });
      reservas.push(
        await prisma.reserva.create({
          data: {
            loteId: lote.id,
            clienteId,
            vendedorId: usuarios.COMERCIAL.id,
            status,
            dataInicio: new Date(`2026-01-0${i + 1}T12:00:00Z`),
            dataVencimento: new Date('2026-01-20T12:00:00Z'),
          },
        }),
      );
    }
    propostas = [];
    // Rejeitada e novo envio na mesma reserva, além da proposta aprovada da convertida.
    for (const [i, status] of (
      ['REJEITADA', 'EM_ANALISE', 'APROVADA'] as const
    ).entries()) {
      propostas.push(
        await prisma.proposta.create({
          data: {
            reservaId: reservas[i === 2 ? 3 : 0].id,
            vendedorId: usuarios.COMERCIAL.id,
            valor: i === 2 ? '999999999999.99' : '120000.00',
            condicoes: 'Condição privada',
            observacoes: 'Observação privada',
            status,
            dataEnvio: new Date(`2026-01-0${[2, 3, 5][i]}T13:00:00Z`),
            prazoLimite: new Date('2026-01-15T12:00:00Z'),
            ...(status === 'EM_ANALISE'
              ? {}
              : {
                  decididoPorId: usuarios.GESTOR.id,
                  dataDecisao: new Date(
                    status === 'REJEITADA'
                      ? '2026-01-02T14:00:00Z'
                      : '2026-01-08T12:00:00Z',
                  ),
                  motivoDecisao: `Proposta ${status}`,
                }),
          },
        }),
      );
    }
  });
  afterAll(async () => {
    await app?.close();
  });
  const get = (
    perfil: keyof UsuariosTeste = 'GESTOR',
    query = '',
    id = clienteId,
  ) =>
    request(app.getHttpServer())
      .get(`/v1/clientes/${id}/historico${query}`)
      .auth(usuarios[perfil].token, { type: 'bearer' });

  it.each(['ADMINISTRADOR', 'GESTOR'] as const)(
    'mostra todos os status, lotes, datas e decisões para %s',
    async (perfil) => {
      const response = await get(perfil).expect(200);
      const items: HistoricoClienteDto[] = response.body.data;
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.body.meta).toEqual({
        page: 1,
        pageSize: 20,
        total: 7,
        totalPages: 1,
      });
      expect(items.map((item) => item.id)).toEqual([
        propostas[2].id,
        reservas[3].id,
        propostas[1].id,
        reservas[2].id,
        propostas[0].id,
        reservas[1].id,
        reservas[0].id,
      ]);
      expect(
        items
          .filter((item) => item.tipo === 'RESERVA')
          .map((item) => item.reserva.status),
      ).toEqual(['CONVERTIDA', 'EXPIRADA', 'CANCELADA', 'ATIVA']);
      expect(items[0]).toMatchObject({
        tipo: 'PROPOSTA',
        data: '2026-01-05T13:00:00.000Z',
        reserva: {
          id: reservas[3].id,
          dataInicio: '2026-01-04T12:00:00.000Z',
          dataVencimento: '2026-01-20T12:00:00.000Z',
          lote: {
            id: reservas[3].loteId,
            numero: '4',
            quadra: 'A',
            loteamentoId,
            loteamento: 'Residencial Norte',
          },
        },
        proposta: {
          valor: '999999999999.99',
          status: 'APROVADA',
          dataEnvio: '2026-01-05T13:00:00.000Z',
          prazoLimite: '2026-01-15T12:00:00.000Z',
          decisao: {
            decididoPorId: usuarios.GESTOR.id,
            data: '2026-01-08T12:00:00.000Z',
            motivo: 'Proposta APROVADA',
          },
        },
      });
      expect(items[2].proposta).toMatchObject({
        status: 'EM_ANALISE',
        valor: '120000.00',
        decisao: null,
      });
      expect(items[4]).toMatchObject({
        reserva: { id: reservas[0].id },
        proposta: {
          status: 'REJEITADA',
          decisao: { motivo: 'Proposta REJEITADA' },
        },
      });
      expect(
        items
          .filter((item) => item.tipo === 'RESERVA')
          .every((item) => item.proposta === null),
      ).toBe(true);
      const json = JSON.stringify(response.body);
      for (const privado of [
        '52998224725',
        '45999999999',
        'privado@exemplo.com',
        'Cliente privado',
        'Condição privada',
        'Observação privada',
        'senhaHash',
      ]) {
        expect(json).not.toContain(privado);
      }
    },
  );
  it('pagina sem repetir ou perder entradas quando as datas empatam', async () => {
    await prisma.proposta.updateMany({
      data: { dataEnvio: new Date('2026-01-01T12:00:00Z') },
    });
    await prisma.reserva.updateMany({
      data: { dataInicio: new Date('2026-01-01T12:00:00Z') },
    });
    const esperado = [...reservas, ...propostas]
      .map((item) => item.id)
      .sort()
      .reverse();
    const ids: string[] = [];
    for (let page = 1; page <= 4; page++) {
      const response = await get('GESTOR', `?page=${page}&pageSize=2`).expect(
        200,
      );
      expect(response.body.meta).toEqual({
        page,
        pageSize: 2,
        total: 7,
        totalPages: 4,
      });
      ids.push(
        ...response.body.data.map((item: HistoricoClienteDto) => item.id),
      );
    }
    expect(ids).toEqual(esperado);
    const fora = await get('GESTOR', '?page=5&pageSize=2').expect(200);
    expect(fora.body.data).toEqual([]);
    expect(fora.body.meta.total).toBe(7);
  });
  it('filtra outro cliente e distingue cliente vazio, removido e ausente', async () => {
    const vazio = await get('GESTOR', '', outroClienteId).expect(200);
    expect(vazio.body).toMatchObject({
      data: [],
      meta: { total: 0, totalPages: 0 },
    });
    await prisma.reserva.create({
      data: {
        clienteId: outroClienteId,
        vendedorId: usuarios.COMERCIAL.id,
        loteId: reservas[1].loteId,
        dataInicio: new Date('2026-02-01T12:00:00Z'),
        dataVencimento: new Date('2026-02-20T12:00:00Z'),
      },
    });
    expect((await get().expect(200)).body.meta.total).toBe(7);
    expect(
      (await get('GESTOR', '', outroClienteId).expect(200)).body.meta.total,
    ).toBe(1);
    expect((await get('GESTOR', '', randomUUID()).expect(404)).body.code).toBe(
      'CLIENTE_NAO_ENCONTRADO',
    );
    await prisma.cliente.update({
      where: { id: clienteId },
      data: { deletedAt: new Date() },
    });
    expect((await get().expect(404)).body.code).toBe('CLIENTE_NAO_ENCONTRADO');
  });
  it('Comercial vê apenas suas reservas e propostas, sem contar dados de colegas', async () => {
    const outro = await criarUsuarioTeste(app, 'COMERCIAL');
    await prisma.reserva.update({
      where: { id: reservas[0].id },
      data: { vendedorId: outro.id },
    });
    await prisma.proposta.updateMany({
      where: { reservaId: reservas[0].id },
      data: { vendedorId: outro.id },
    });
    const propria = await get('COMERCIAL').expect(200);
    expect(propria.body.meta.total).toBe(4);
    expect(
      propria.body.data.map((item: HistoricoClienteDto) => item.id),
    ).toEqual([
      propostas[2].id,
      ...reservas
        .slice(1)
        .toReversed()
        .map((r) => r.id),
    ]);
    const colega = await request(app.getHttpServer())
      .get(`/v1/clientes/${clienteId}/historico`)
      .auth(outro.token, { type: 'bearer' })
      .expect(200);
    expect(colega.body.meta.total).toBe(3);
    expect(
      colega.body.data.map((item: HistoricoClienteDto) => item.id),
    ).toEqual([propostas[1].id, propostas[0].id, reservas[0].id]);
    const semHistorico = await criarUsuarioTeste(app, 'COMERCIAL');
    expect(
      (
        await request(app.getHttpServer())
          .get(`/v1/clientes/${clienteId}/historico`)
          .auth(semHistorico.token, { type: 'bearer' })
          .expect(200)
      ).body,
    ).toMatchObject({ data: [], meta: { total: 0 } });
  });
  it('preserva o histórico com lote, quadra ou loteamento removidos logicamente', async () => {
    await prisma.lote.updateMany({ data: { deletedAt: new Date() } });
    await prisma.quadra.update({
      where: { id: quadraId },
      data: { deletedAt: new Date() },
    });
    await prisma.loteamento.update({
      where: { id: loteamentoId },
      data: { deletedAt: new Date() },
    });
    const response = await get().expect(200);
    expect(response.body.meta.total).toBe(7);
    expect(response.body.data[0].reserva.lote.numero).toBe('4');
  });
  it('exige autenticação e nega Consulta mesmo para cliente ausente', async () => {
    await request(app.getHttpServer())
      .get(`/v1/clientes/${clienteId}/historico`)
      .expect(401);
    for (const id of [clienteId, randomUUID()]) {
      expect((await get('CONSULTA', '', id).expect(403)).body.code).toBe(
        'ACESSO_NEGADO',
      );
    }
  });
  it('valida UUID, paginação e rejeita filtros de vendedor enviados pelo cliente', async () => {
    await get('GESTOR', '', 'invalido').expect(400);
    for (const query of [
      '?page=0',
      '?pageSize=101',
      '?page=abc',
      '?pageSize=0',
      '?vendedorId=' + usuarios.COMERCIAL.id,
    ]) {
      expect((await get('GESTOR', query).expect(400)).body.code).toBe(
        'DADOS_INVALIDOS',
      );
    }
  });
  it('documenta contrato paginado, decisões e erros no Swagger', () => {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().addBearerAuth().build(),
    );
    const operation = document.paths['/v1/clientes/{id}/historico'].get!;
    expect(Object.keys(operation.responses)).toEqual(
      expect.arrayContaining(['200', '400', '401', '403', '404']),
    );
    expect(operation.security).toEqual([{ bearer: [] }]);
    const schemas = document.components!.schemas!;
    expect(schemas.HistoricoClienteDto).toMatchObject({
      properties: {
        tipo: { enum: ['RESERVA', 'PROPOSTA'] },
        proposta: { nullable: true },
      },
    });
    expect(schemas.PropostaHistoricoClienteDto).toMatchObject({
      properties: { valor: { type: 'string' }, decisao: { nullable: true } },
    });
  });
});
