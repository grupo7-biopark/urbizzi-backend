import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Client } from 'pg';

describe('Migration de unicidade sem caixa (integração)', () => {
  let client: Client;
  let schema: string;
  let migration: string;
  beforeAll(async () => {
    migration = await readFile(
      'prisma/migrations/20261110130000_cadastros_unicidade_sem_caixa/migration.sql',
      'utf8',
    );
  });
  beforeEach(async () => {
    client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    // Identificador interno aleatório, nunca proveniente da entrada do usuário.
    schema = 'teste_unicidade_' + randomUUID().replaceAll('-', '');
    await client.query(`CREATE SCHEMA "${schema}"; SET search_path TO "${schema}", public;
      CREATE TABLE loteamentos (id int PRIMARY KEY, nome varchar(150), deleted_at timestamptz);
      CREATE TABLE quadras (id int PRIMARY KEY, loteamento_id int, numero varchar(20), deleted_at timestamptz);
      CREATE TABLE lotes (id int PRIMARY KEY, quadra_id int, numero varchar(20), deleted_at timestamptz);
      CREATE UNIQUE INDEX loteamentos_nome_key ON loteamentos(nome) WHERE deleted_at IS NULL;
      CREATE UNIQUE INDEX quadras_loteamento_id_numero_key ON quadras(loteamento_id, numero) WHERE deleted_at IS NULL;
      CREATE UNIQUE INDEX lotes_quadra_id_numero_key ON lotes(quadra_id, numero) WHERE deleted_at IS NULL;`);
  });
  afterEach(async () => {
    await client.query('ROLLBACK');
    await client.query(`DROP SCHEMA "${schema}" CASCADE`);
    await client.end();
  });

  for (const tabela of ['loteamentos', 'quadras', 'lotes']) {
    it(`recusa duplicados antigos de ${tabela} sem alterar registros ou tipos`, async () => {
      const sql =
        tabela === 'loteamentos'
          ? "INSERT INTO loteamentos(id,nome) VALUES(1,'Caso'),(2,'caso')"
          : `INSERT INTO ${tabela}(id,${tabela === 'quadras' ? 'loteamento_id' : 'quadra_id'},numero) VALUES(1,1,'Caso'),(2,1,'caso')`;
      await client.query(sql);
      await expect(client.query(migration)).rejects.toThrow(
        'Existem cadastros ativos duplicados',
      );
      await client.query('ROLLBACK');
      expect(
        (await client.query(`SELECT count(*)::int AS total FROM ${tabela}`))
          .rows[0].total,
      ).toBe(2);
      const tipos = await client.query(
        'SELECT data_type FROM information_schema.columns WHERE table_schema=$1 AND column_name IN ($2,$3)',
        [schema, 'nome', 'numero'],
      );
      expect(
        tipos.rows.every(
          (row: { data_type: string }) => row.data_type === 'character varying',
        ),
      ).toBe(true);
    });
  }
  it('preserva grafia, índices parciais e limites de tamanho após converter os tipos', async () => {
    await client.query(
      "INSERT INTO loteamentos VALUES(1,'Antigo',now()),(2,'ANTIGO',null)",
    );
    await client.query(migration);
    expect(
      (await client.query('SELECT nome FROM loteamentos WHERE id=2')).rows[0]
        .nome,
    ).toBe('ANTIGO');
    await expect(
      client.query("INSERT INTO loteamentos VALUES(3,'antigo',null)"),
    ).rejects.toMatchObject({ code: '23505' });
    await client.query(
      "INSERT INTO quadras VALUES(1,1,'A',null),(2,2,'a',null)",
    );
    await expect(
      client.query("INSERT INTO quadras VALUES(3,1,'a',null)"),
    ).rejects.toMatchObject({ code: '23505' });
    await client.query("INSERT INTO lotes VALUES(1,1,'B',null),(2,2,'b',null)");
    await expect(
      client.query("INSERT INTO lotes VALUES(3,1,'b',null)"),
    ).rejects.toMatchObject({ code: '23505' });
    await expect(
      client.query('INSERT INTO loteamentos VALUES(9,$1,null)', [
        'x'.repeat(151),
      ]),
    ).rejects.toMatchObject({ code: '23514' });
    await expect(
      client.query('INSERT INTO quadras VALUES(9,1,$1,null)', ['x'.repeat(21)]),
    ).rejects.toMatchObject({ code: '23514' });
    await expect(
      client.query('INSERT INTO lotes VALUES(9,1,$1,null)', ['x'.repeat(21)]),
    ).rejects.toMatchObject({ code: '23514' });
  });
});
