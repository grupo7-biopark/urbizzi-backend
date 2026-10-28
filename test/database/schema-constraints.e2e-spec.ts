import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from './../../src/app.module.js';
import { PrismaService } from './../../src/shared/infra/database/prisma.service.js';
import { limparBanco } from '../helpers/database.js';

// Restrições garantidas pelo banco (índices únicos parciais e CHECK),
// testadas direto no Prisma, sem passar pela aplicação.
describe('Restrições do schema (integração)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await limparBanco(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  async function criarVendedor() {
    const perfil = await prisma.perfil.create({
      data: { codigo: 'COMERCIAL', nome: 'Comercial' },
    });
    return prisma.usuario.create({
      data: {
        nome: 'Vendedor Teste',
        email: 'vendedor@teste.com',
        senhaHash: 'hash',
        perfilId: perfil.id,
      },
    });
  }

  async function criarQuadra() {
    const loteamento = await prisma.loteamento.create({
      data: { nome: 'Universitário Norte' },
    });
    return prisma.quadra.create({
      data: { loteamentoId: loteamento.id, numero: '1' },
    });
  }

  function criarLote(quadraId: string, numero = '10') {
    return prisma.lote.create({ data: { quadraId, numero, areaM2: '360' } });
  }

  async function criarCenarioReserva() {
    const vendedor = await criarVendedor();
    const quadra = await criarQuadra();
    const lote = await criarLote(quadra.id);
    const cliente = await prisma.cliente.create({
      data: { nome: 'Cliente Teste', documento: '12345678909' },
    });
    return { vendedor, lote, cliente };
  }

  function dadosReserva(c: Awaited<ReturnType<typeof criarCenarioReserva>>) {
    return {
      loteId: c.lote.id,
      clienteId: c.cliente.id,
      vendedorId: c.vendedor.id,
      dataInicio: new Date('2026-11-01T12:00:00Z'),
      dataVencimento: new Date('2026-11-08T12:00:00Z'),
    };
  }

  describe('reservas', () => {
    it('não permite duas reservas ATIVA para o mesmo lote', async () => {
      const cenario = await criarCenarioReserva();
      await prisma.reserva.create({ data: dadosReserva(cenario) });

      await expect(
        prisma.reserva.create({ data: dadosReserva(cenario) }),
      ).rejects.toMatchObject({ code: 'P2002' });
    });

    it('permite nova reserva ATIVA depois que a anterior é cancelada', async () => {
      const cenario = await criarCenarioReserva();
      const primeira = await prisma.reserva.create({
        data: dadosReserva(cenario),
      });
      await prisma.reserva.update({
        where: { id: primeira.id },
        data: { status: 'CANCELADA', motivoEncerramento: 'Desistência' },
      });

      await expect(
        prisma.reserva.create({ data: dadosReserva(cenario) }),
      ).resolves.toMatchObject({ status: 'ATIVA' });
    });

    it('cria exatamente uma reserva em tentativas simultâneas (RNF04)', async () => {
      const cenario = await criarCenarioReserva();

      const resultados = await Promise.allSettled(
        Array.from({ length: 5 }, () =>
          prisma.reserva.create({ data: dadosReserva(cenario) }),
        ),
      );

      expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(
        1,
      );
      expect(
        await prisma.reserva.count({
          where: { loteId: cenario.lote.id, status: 'ATIVA' },
        }),
      ).toBe(1);
    });

    it('não permite vencimento anterior ao início', async () => {
      const cenario = await criarCenarioReserva();

      await expect(
        prisma.reserva.create({
          data: {
            ...dadosReserva(cenario),
            dataVencimento: new Date('2026-10-01T12:00:00Z'),
          },
        }),
      ).rejects.toThrow(/reservas_data_vencimento_check/);
    });
  });

  describe('lotes e quadras', () => {
    it('não permite dois lotes com o mesmo número na mesma quadra', async () => {
      const quadra = await criarQuadra();
      await criarLote(quadra.id, '10');

      await expect(criarLote(quadra.id, '10')).rejects.toMatchObject({
        code: 'P2002',
      });
    });

    it('permite o mesmo número de lote em outra quadra', async () => {
      const quadra = await criarQuadra();
      const outra = await prisma.quadra.create({
        data: { loteamentoId: quadra.loteamentoId, numero: '2' },
      });
      await criarLote(quadra.id, '10');

      await expect(criarLote(outra.id, '10')).resolves.toBeDefined();
    });

    it('permite reutilizar o número de um lote excluído (soft delete)', async () => {
      const quadra = await criarQuadra();
      const lote = await criarLote(quadra.id, '10');
      await prisma.lote.update({
        where: { id: lote.id },
        data: { deletedAt: new Date() },
      });

      await expect(criarLote(quadra.id, '10')).resolves.toBeDefined();
    });

    it('não permite duas quadras com o mesmo número no loteamento', async () => {
      const quadra = await criarQuadra();

      await expect(
        prisma.quadra.create({
          data: { loteamentoId: quadra.loteamentoId, numero: quadra.numero },
        }),
      ).rejects.toMatchObject({ code: 'P2002' });
    });

    it('não permite área zero', async () => {
      const quadra = await criarQuadra();

      await expect(
        prisma.lote.create({
          data: { quadraId: quadra.id, numero: '11', areaM2: '0' },
        }),
      ).rejects.toThrow(/lotes_area_m2_check/);
    });
  });

  describe('propostas', () => {
    async function criarReserva() {
      const cenario = await criarCenarioReserva();
      const reserva = await prisma.reserva.create({
        data: dadosReserva(cenario),
      });
      return { ...cenario, reserva };
    }

    function dadosProposta(c: Awaited<ReturnType<typeof criarReserva>>) {
      return {
        reservaId: c.reserva.id,
        vendedorId: c.vendedor.id,
        valor: '250000.00',
        condicoes: 'Entrada de 20% e saldo financiado',
        prazoLimite: new Date('2026-11-12T12:00:00Z'),
      };
    }

    it('não permite duas propostas EM_ANALISE na mesma reserva', async () => {
      const cenario = await criarReserva();
      await prisma.proposta.create({ data: dadosProposta(cenario) });

      await expect(
        prisma.proposta.create({ data: dadosProposta(cenario) }),
      ).rejects.toMatchObject({ code: 'P2002' });
    });

    it('permite nova proposta depois que a anterior é rejeitada', async () => {
      const cenario = await criarReserva();
      const primeira = await prisma.proposta.create({
        data: dadosProposta(cenario),
      });
      await prisma.proposta.update({
        where: { id: primeira.id },
        data: {
          status: 'REJEITADA',
          decididoPorId: cenario.vendedor.id,
          dataDecisao: new Date(),
          motivoDecisao: 'Valor abaixo da tabela',
        },
      });

      await expect(
        prisma.proposta.create({ data: dadosProposta(cenario) }),
      ).resolves.toMatchObject({ status: 'EM_ANALISE' });
    });

    it('exige gestor, data e motivo ao decidir a proposta (RN10)', async () => {
      const cenario = await criarReserva();
      const proposta = await prisma.proposta.create({
        data: dadosProposta(cenario),
      });

      await expect(
        prisma.proposta.update({
          where: { id: proposta.id },
          data: { status: 'APROVADA' },
        }),
      ).rejects.toThrow(/propostas_decisao_check/);
    });
  });

  describe('clientes e usuários', () => {
    it('não permite dois clientes ativos com o mesmo documento', async () => {
      await prisma.cliente.create({
        data: { nome: 'A', documento: '12345678909' },
      });

      await expect(
        prisma.cliente.create({
          data: { nome: 'B', documento: '12345678909' },
        }),
      ).rejects.toMatchObject({ code: 'P2002' });
    });

    it('não permite documento com formatação ou tamanho inválido', async () => {
      await expect(
        prisma.cliente.create({
          data: { nome: 'A', documento: '123.456.789-09' },
        }),
      ).rejects.toThrow(/clientes_documento_check/);
    });

    it('não permite dois usuários com o mesmo e-mail', async () => {
      await criarVendedor();
      const perfil = await prisma.perfil.findFirstOrThrow();

      await expect(
        prisma.usuario.create({
          data: {
            nome: 'Outro',
            email: 'vendedor@teste.com',
            senhaHash: 'hash',
            perfilId: perfil.id,
          },
        }),
      ).rejects.toMatchObject({ code: 'P2002' });
    });
  });
});
