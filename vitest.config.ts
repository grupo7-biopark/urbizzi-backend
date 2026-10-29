import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  // Resolves the path aliases declared in tsconfig.json, including the ones
  // added by `nest g library`.
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      // Cobertura mínima exigida em docs/testing.md
      include: [
        'src/modules/**/domain/**/*.ts',
        'src/modules/**/application/**/*.ts',
        'src/shared/domain/policies/propriedade.policy.ts',
        'src/shared/infra/auth/perfis.guard.ts',
        'src/shared/infra/auth/perfis.decorator.ts',
      ],
      thresholds: { lines: 80, branches: 80 },
    },
  },
});
