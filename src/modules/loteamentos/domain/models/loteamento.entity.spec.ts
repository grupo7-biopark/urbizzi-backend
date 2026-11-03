import { Loteamento } from './loteamento.entity.js';

describe('Loteamento', () => {
  it('cria com id, timestamps e campos opcionais nulos', () => {
    const loteamento = Loteamento.create({ nome: 'Bela Vista' });

    expect(loteamento.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(loteamento.nome).toBe('Bela Vista');
    expect(loteamento.descricao).toBeNull();
    expect(loteamento.localizacao).toBeNull();
    expect(loteamento.createdAt).toEqual(loteamento.updatedAt);
  });

  it('atualiza apenas os campos informados', () => {
    const loteamento = Loteamento.create({
      nome: 'Bela Vista',
      descricao: 'Perto do centro',
      localizacao: 'Toledo - PR',
    });

    loteamento.atualizar({ localizacao: 'Cascavel - PR' });

    expect(loteamento.auditoria).toEqual({
      nome: 'Bela Vista',
      descricao: 'Perto do centro',
      localizacao: 'Cascavel - PR',
    });
  });

  it('limpa descrição e localização com null, mas ignora nome nulo', () => {
    const loteamento = Loteamento.create({
      nome: 'Bela Vista',
      descricao: 'Perto do centro',
      localizacao: 'Toledo - PR',
    });

    loteamento.atualizar({
      nome: null as unknown as string,
      descricao: null,
      localizacao: null,
    });

    expect(loteamento.auditoria).toEqual({
      nome: 'Bela Vista',
      descricao: null,
      localizacao: null,
    });
  });

  it('restaura sem alterar os dados', () => {
    const props = {
      id: '0b6f3c1e-8a52-4a8e-9d3f-2c7f1e5a9b10',
      nome: 'Bela Vista',
      descricao: null,
      localizacao: null,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-02T00:00:00Z'),
    };

    const loteamento = Loteamento.restore(props);

    expect(loteamento.id).toBe(props.id);
    expect(loteamento.updatedAt).toEqual(props.updatedAt);
  });
});
