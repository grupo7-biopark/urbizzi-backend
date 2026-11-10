import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BusinessRuleError } from '../../../../shared/domain/errors/domain.error.js';
import type { UsuarioAutenticado } from '../../../../shared/domain/usuario-autenticado.js';
import type { LoteamentoService } from '../../../loteamentos/application/services/loteamento.service.js';
import type {
  PainelConsultaRepository,
  PainelPendencias,
  PainelResumo,
  PainelVendas,
} from '../../domain/repositories/painel-consulta.repository.interface.js';
import { PainelService } from './painel.service.js';

describe('PainelService', () => {
  let service: PainelService;
  let repository: {
    obterResumo: ReturnType<typeof vi.fn>;
    obterVendas: ReturnType<typeof vi.fn>;
    obterPendencias: ReturnType<typeof vi.fn>;
  };
  let loteamentoService: {
    findById: ReturnType<typeof vi.fn>;
  };

  const usuarioGestor: UsuarioAutenticado = {
    id: '11111111-1111-1111-1111-111111111111',
    perfil: 'GESTOR',
    nome: 'Gestor Teste',
  };

  const usuarioComercial: UsuarioAutenticado = {
    id: '22222222-2222-2222-2222-222222222222',
    perfil: 'COMERCIAL',
    nome: 'Comercial Teste',
  };

  const mockResumo: PainelResumo = {
    geral: {
      total: 100,
      disponivel: 50,
      reservado: 20,
      vendido: 25,
      bloqueado: 5,
      porStatus: {
        DISPONIVEL: 50,
        RESERVADO: 20,
        VENDIDO: 25,
        BLOQUEADO: 5,
      },
    },
    porLoteamento: [
      {
        id: 'loteamento-1',
        loteamentoId: 'loteamento-1',
        nome: 'Loteamento 1',
        total: 100,
        disponivel: 50,
        reservado: 20,
        vendido: 25,
        bloqueado: 5,
        porStatus: {
          DISPONIVEL: 50,
          RESERVADO: 20,
          VENDIDO: 25,
          BLOQUEADO: 5,
        },
      },
    ],
    total: 100,
    disponivel: 50,
    reservado: 20,
    vendido: 25,
    bloqueado: 5,
    porStatus: {
      DISPONIVEL: 50,
      RESERVADO: 20,
      VENDIDO: 25,
      BLOQUEADO: 5,
    },
  };

  const mockVendas: PainelVendas = {
    total: 5,
    valorTotal: '500000.00',
    periodo: {
      dia: 1,
      semana: 3,
      mes: 5,
    },
    resumo: {
      dia: 1,
      semana: 3,
      mes: 5,
    },
    porPeriodo: [
      {
        periodo: '2026-11-05',
        quantidade: 1,
        valorTotal: '100000.00',
      },
    ],
    porDia: [
      {
        data: '2026-11-05',
        quantidade: 1,
        valorTotal: '100000.00',
      },
    ],
    porSemana: [
      {
        semana: '2026-W45',
        quantidade: 3,
        valorTotal: '300000.00',
      },
    ],
    porMes: [
      {
        mes: '2026-11',
        quantidade: 5,
        valorTotal: '500000.00',
      },
    ],
    porVendedor: [
      {
        vendedorId: usuarioComercial.id,
        nome: usuarioComercial.nome,
        quantidade: 5,
        valorTotal: '500000.00',
      },
    ],
  };

  const mockPendencias: PainelPendencias = {
    reservasAtivas: 10,
    reservasVencendoEmBreve: 3,
    propostasPendentes: 4,
    propostasAtrasadas: 1,
    total: 14,
    reservas: {
      ativas: 10,
      vencendoEmBreve: 3,
    },
    propostas: {
      pendentes: 4,
      atrasadas: 1,
      emDia: 3,
    },
  };

  beforeEach(() => {
    repository = {
      obterResumo: vi.fn().mockResolvedValue(mockResumo),
      obterVendas: vi.fn().mockResolvedValue(mockVendas),
      obterPendencias: vi.fn().mockResolvedValue(mockPendencias),
    };
    loteamentoService = {
      findById: vi
        .fn()
        .mockResolvedValue({ id: 'loteamento-1', nome: 'Loteamento 1' }),
    };

    service = new PainelService(
      repository as unknown as PainelConsultaRepository,
      loteamentoService as unknown as LoteamentoService,
    );
  });

  describe('obterResumo', () => {
    it('devolve resumo de lotes geral e por loteamento', async () => {
      const result = await service.obterResumo({}, usuarioGestor);

      expect(repository.obterResumo).toHaveBeenCalledWith({
        loteamentoId: undefined,
        dataDe: undefined,
        dataAte: undefined,
      });
      expect(result.geral.total).toBe(100);
      expect(result.porLoteamento).toHaveLength(1);
      expect(result.porLoteamento[0].nome).toBe('Loteamento 1');
      expect(result.total).toBe(100);
      expect(result.disponivel).toBe(50);
    });

    it('valida existência de loteamentoId quando informado', async () => {
      await service.obterResumo(
        { loteamentoId: 'loteamento-1' },
        usuarioGestor,
      );

      expect(loteamentoService.findById).toHaveBeenCalledWith('loteamento-1');
      expect(repository.obterResumo).toHaveBeenCalledWith(
        expect.objectContaining({ loteamentoId: 'loteamento-1' }),
      );
    });

    it('aceita datas válidas e ajusta dataAte simples para fim do dia UTC', async () => {
      await service.obterResumo(
        { dataDe: '2026-11-01', dataAte: '2026-11-05' },
        usuarioGestor,
      );

      const chamada = repository.obterResumo.mock.calls[0][0];
      expect(chamada.dataDe).toBeInstanceOf(Date);
      expect(chamada.dataAte).toBeInstanceOf(Date);
      expect(chamada.dataAte?.getUTCHours()).toBe(23);
      expect(chamada.dataAte?.getUTCMinutes()).toBe(59);
    });

    it('rejeita período com dataDe posterior a dataAte', async () => {
      await expect(
        service.obterResumo(
          { dataDe: '2026-11-10', dataAte: '2026-11-01' },
          usuarioGestor,
        ),
      ).rejects.toThrow(BusinessRuleError);
    });
  });

  describe('obterVendas', () => {
    it('devolve totais e séries de vendas por período e vendedor', async () => {
      const result = await service.obterVendas({}, usuarioGestor);

      expect(repository.obterVendas).toHaveBeenCalledWith({
        loteamentoId: undefined,
        vendedorId: undefined,
        dataDe: undefined,
        dataAte: undefined,
        agrupamento: undefined,
      });
      expect(result.total).toBe(5);
      expect(result.valorTotal).toBe('500000.00');
      expect(result.periodo.dia).toBe(1);
      expect(result.porVendedor).toHaveLength(1);
    });

    it('limita Comercial ao próprio vendedorId se filtro de vendedor for informado', async () => {
      await service.obterVendas(
        { vendedorId: 'outro-vendedor' },
        usuarioComercial,
      );

      expect(repository.obterVendas).toHaveBeenCalledWith(
        expect.objectContaining({ vendedorId: usuarioComercial.id }),
      );
    });

    it('permite Gestor filtrar por qualquer vendedorId', async () => {
      await service.obterVendas(
        { vendedorId: 'outro-vendedor' },
        usuarioGestor,
      );

      expect(repository.obterVendas).toHaveBeenCalledWith(
        expect.objectContaining({ vendedorId: 'outro-vendedor' }),
      );
    });

    it('valida existência de loteamentoId', async () => {
      await service.obterVendas(
        { loteamentoId: 'loteamento-1' },
        usuarioGestor,
      );

      expect(loteamentoService.findById).toHaveBeenCalledWith('loteamento-1');
    });
  });

  describe('obterPendencias', () => {
    it('gestor visualiza todas as pendências sem restrição de vendedor por padrão', async () => {
      const result = await service.obterPendencias({}, usuarioGestor);

      expect(repository.obterPendencias).toHaveBeenCalledWith(
        expect.objectContaining({
          vendedorId: undefined,
          loteamentoId: undefined,
        }),
      );
      expect(result.reservasAtivas).toBe(10);
      expect(result.reservasVencendoEmBreve).toBe(3);
      expect(result.propostasPendentes).toBe(4);
      expect(result.propostasAtrasadas).toBe(1);
      expect(result.total).toBe(14);
    });

    it('comercial é sempre restrito às próprias pendências', async () => {
      await service.obterPendencias(
        { vendedorId: 'tentativa-de-outro-vendedor' },
        usuarioComercial,
      );

      expect(repository.obterPendencias).toHaveBeenCalledWith(
        expect.objectContaining({
          vendedorId: usuarioComercial.id,
        }),
      );
    });

    it('aplica diasVencimentoEmBreve personalizado quando informado', async () => {
      await service.obterPendencias(
        { diasVencimentoEmBreve: 5 },
        usuarioGestor,
      );

      const chamada = repository.obterPendencias.mock.calls[0][0];
      expect(chamada.limiteBreve.getTime()).toBeGreaterThan(
        Date.now() + 4 * 86400000,
      );
    });

    it('valida existência de loteamentoId', async () => {
      await service.obterPendencias(
        { loteamentoId: 'loteamento-1' },
        usuarioGestor,
      );

      expect(loteamentoService.findById).toHaveBeenCalledWith('loteamento-1');
    });

    it('rejeita período inválido', async () => {
      await expect(
        service.obterPendencias({ dataDe: 'invalido' }, usuarioGestor),
      ).rejects.toThrow(BusinessRuleError);
    });
  });
});
