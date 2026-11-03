import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // Os arquivos compartilham o mesmo banco e limpam as tabelas no
    // beforeEach; em paralelo, um apagaria os dados do outro.
    fileParallelism: false,
    // O worker de plantas fica desligado; os testes processam a fila
    // chamando o service ou ligando o worker explicitamente.
    env: { PLANTAS_PROCESSAMENTO_ATIVO: 'false' },
  },
});
