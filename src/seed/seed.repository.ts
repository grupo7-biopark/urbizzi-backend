import type { PrismaClient } from '../generated/prisma/client.js';
import { PLANTA_DEV_ID, ORIGINAL_DEV, seedId } from './development-map.js';
import { SeedError, type SeedConfig } from './seed-env.js';
const PERFIS = [
  ['ADMINISTRADOR', 'Administrador'],
  ['GESTOR', 'Gestor'],
  ['COMERCIAL', 'Comercial'],
  ['CONSULTA', 'Consulta'],
] as const;
export const USUARIOS_DEV = [
  {
    id: seedId(1),
    perfil: 'GESTOR',
    nome: 'Gestor de demonstração',
    email: 'gestor@desenvolvimento.example',
  },
  {
    id: seedId(2),
    perfil: 'COMERCIAL',
    nome: 'Comercial de demonstração',
    email: 'comercial@desenvolvimento.example',
  },
  {
    id: seedId(3),
    perfil: 'CONSULTA',
    nome: 'Consulta de demonstração',
    email: 'consulta@desenvolvimento.example',
  },
] as const;

/** Exceção de bootstrap documentada: não é usada por nenhum módulo ou requisição. */
export class SeedRepository {
  constructor(private readonly prisma: PrismaClient) {}
  async temPlantaDev(): Promise<boolean> {
    return Boolean(
      await this.prisma.planta.findUnique({
        where: { id: PLANTA_DEV_ID },
        select: { id: true },
      }),
    );
  }
  async popular(
    config: SeedConfig,
    hashAdmin: string,
    hashDev?: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(20, 5)`;
      const perfis = new Map<string, string>();
      for (const [codigo, nome] of PERFIS) {
        const p = await tx.perfil.upsert({
          where: { codigo },
          update: {},
          create: { codigo, nome },
        });
        perfis.set(codigo, p.id);
      }
      for (const chave of ['prazo_reserva_dias', 'prazo_analise_dias_uteis'])
        await tx.configuracao.upsert({
          where: { chave },
          update: {},
          create: { chave, valor: '7' },
        });
      const admin = await tx.usuario.upsert({
        where: { email: config.SEED_ADMIN_EMAIL },
        update: {},
        create: {
          nome: config.SEED_ADMIN_NOME,
          email: config.SEED_ADMIN_EMAIL,
          senhaHash: hashAdmin,
          perfilId: perfis.get('ADMINISTRADOR')!,
        },
        include: { perfil: true },
      });
      if (admin.perfil.codigo !== 'ADMINISTRADOR')
        throw new SeedError(
          'O e-mail do administrador inicial já pertence a outro perfil. Nenhuma conta foi promovida.',
        );
      if (!config.development) return;
      if (!hashDev)
        throw new SeedError(
          'A senha de desenvolvimento deve estar configurada.',
        );
      for (const u of USUARIOS_DEV) {
        const existente = await tx.usuario.upsert({
          where: { id: u.id },
          update: {},
          create: {
            id: u.id,
            nome: u.nome,
            email: u.email,
            senhaHash: hashDev,
            perfilId: perfis.get(u.perfil)!,
          },
        });
        if (existente.email !== u.email)
          throw new SeedError(
            'Conflito de identidade nos exemplos de desenvolvimento.',
          );
      }
      for (let i = 0; i < 2; i++)
        await tx.loteamento.upsert({
          where: { id: seedId(10 + i) },
          update: {},
          create: {
            id: seedId(10 + i),
            nome: `Demonstração Urbizzi ${i + 1}`,
            localizacao: 'Endereço fictício para desenvolvimento',
          },
        });
      for (let i = 0; i < 4; i++)
        await tx.quadra.upsert({
          where: { id: seedId(20 + i) },
          update: {},
          create: {
            id: seedId(20 + i),
            loteamentoId: seedId(10 + Math.floor(i / 2)),
            numero: String((i % 2) + 1),
          },
        });
      for (let i = 0; i < 12; i++)
        await tx.lote.upsert({
          where: { id: seedId(100 + i) },
          update: {},
          create: {
            id: seedId(100 + i),
            quadraId: seedId(20 + Math.floor(i / 3)),
            numero: String((i % 3) + 1),
            areaM2: '360.00',
            valor: '250000.00',
            exibirValorPublico: i % 2 === 0,
            status:
              i === 0
                ? 'RESERVADO'
                : i === 1
                  ? 'VENDIDO'
                  : i === 2
                    ? 'BLOQUEADO'
                    : 'DISPONIVEL',
            teveReserva: i < 2,
          },
        });
      for (const [i, documento] of ['52998224725', '11144477735'].entries())
        await tx.cliente.upsert({
          where: { id: seedId(200 + i) },
          update: {},
          create: {
            id: seedId(200 + i),
            nome: `Cliente fictício ${i + 1}`,
            documento,
          },
        });
      const agora = new Date(),
        vencimento = new Date(agora.getTime() + 7 * 86400000);
      for (let i = 0; i < 2; i++) {
        await tx.reserva.upsert({
          where: { id: seedId(300 + i) },
          update: {},
          create: {
            id: seedId(300 + i),
            loteId: seedId(100 + i),
            clienteId: seedId(200 + i),
            vendedorId: USUARIOS_DEV[1].id,
            status: i === 0 ? 'ATIVA' : 'CONVERTIDA',
            dataInicio: agora,
            dataVencimento: vencimento,
          },
        });
        await tx.proposta.upsert({
          where: { id: seedId(400 + i) },
          update: {},
          create: {
            id: seedId(400 + i),
            reservaId: seedId(300 + i),
            vendedorId: USUARIOS_DEV[1].id,
            valor: '240000.00',
            condicoes: 'Condições fictícias de demonstração',
            prazoLimite: vencimento,
            ...(i === 1
              ? {
                  status: 'APROVADA',
                  decididoPorId: USUARIOS_DEV[0].id,
                  dataDecisao: agora,
                  motivoDecisao: 'Aprovação fictícia de demonstração',
                }
              : {}),
          },
        });
      }
      // Usa os mesmos locks de numeração e ativação do módulo de plantas.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(7301001)`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(7301002)`;
      const existente = await tx.planta.findUnique({
        where: { id: PLANTA_DEV_ID },
      });
      if (!existente) {
        const ativa = !(await tx.planta.findFirst({
          where: { ativa: true },
          select: { id: true },
        }));
        const versao =
          ((await tx.planta.aggregate({ _max: { versao: true } }))._max
            .versao ?? 0) + 1;
        await tx.planta.create({
          data: {
            id: PLANTA_DEV_ID,
            nome: 'Planta fictícia de demonstração',
            versao,
            ativa,
            status: 'PRONTA',
            larguraPx: 256,
            alturaPx: 256,
            maxZoom: 0,
            tamanhoTile: 256,
            tilesPath: `plantas/${PLANTA_DEV_ID}`,
            originais: [ORIGINAL_DEV],
            criadoPorId: admin.id,
          },
        });
      }
      for (let i = 0; i < 12; i++)
        await tx.marcador.upsert({
          where: {
            plantaId_loteId: {
              plantaId: PLANTA_DEV_ID,
              loteId: seedId(100 + i),
            },
          },
          update: {},
          create: {
            id: seedId(500 + i),
            plantaId: PLANTA_DEV_ID,
            loteId: seedId(100 + i),
            x: (8 + (i % 4) * 62 + 27) / 256,
            y: (8 + Math.floor(i / 4) * 82 + 37) / 256,
          },
        });
    });
  }
}
