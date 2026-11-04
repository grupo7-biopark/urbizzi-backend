import type { INestApplication } from '@nestjs/common';
import { PrismaService } from '../../src/shared/infra/database/prisma.service.js';
import { criarUsuarios } from './usuarios.js';
/** Cenário fictício compartilhado pelos mapas interno e público. */
export async function criarCenarioMapa(app: INestApplication) {
  const prisma = app.get(PrismaService);
  const usuarios = await criarUsuarios(app);
  const planta = await prisma.planta.create({
    data: {
      nome: 'Planta ativa',
      versao: 1,
      status: 'PRONTA',
      ativa: true,
      larguraPx: 1024,
      alturaPx: 512,
      maxZoom: 2,
      tamanhoTile: 256,
      criadoPorId: usuarios.ADMINISTRADOR.id,
    },
  });
  const loteamentos = await Promise.all(
    ['Norte', 'Sul'].map((nome) =>
      prisma.loteamento.create({ data: { nome } }),
    ),
  );
  const quadras = await Promise.all(
    loteamentos.map((e) =>
      prisma.quadra.create({ data: { loteamentoId: e.id, numero: 'A' } }),
    ),
  );
  const lotes = await Promise.all(
    (['DISPONIVEL', 'RESERVADO', 'VENDIDO', 'BLOQUEADO'] as const).map(
      (status, i) =>
        prisma.lote.create({
          data: {
            quadraId: quadras[i % 2].id,
            numero: String(i + 1),
            areaM2: '100.25',
            valor: '123456.78',
            exibirValorPublico: i % 2 === 0,
            status,
            observacoes: 'Anotação interna',
          },
        }),
    ),
  );
  await prisma.marcador.createMany({
    data: lotes.map((lote, i) => ({
      plantaId: planta.id,
      loteId: lote.id,
      x: i / 4,
      y: 0.5,
    })),
  });
  const cliente = await prisma.cliente.create({
    data: {
      nome: 'Cliente confidencial',
      documento: '52998224725',
      telefone: '45999999999',
    },
  });
  const reserva = await prisma.reserva.create({
    data: {
      loteId: lotes[1].id,
      clienteId: cliente.id,
      vendedorId: usuarios.COMERCIAL.id,
      dataInicio: new Date(),
      dataVencimento: new Date(Date.now() + 86400000),
    },
  });
  await prisma.proposta.create({
    data: {
      reservaId: reserva.id,
      vendedorId: usuarios.COMERCIAL.id,
      valor: '120000.00',
      condicoes: 'Condição confidencial',
      status: 'APROVADA',
      prazoLimite: new Date(Date.now() + 86400000),
      decididoPorId: usuarios.GESTOR.id,
      dataDecisao: new Date(),
      motivoDecisao: 'Aprovada pelo gestor',
    },
  });
  return { usuarios, planta, loteamentos, quadras, lotes, cliente, reserva };
}
