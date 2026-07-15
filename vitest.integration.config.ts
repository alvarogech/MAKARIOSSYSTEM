import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Config separada para os testes de integração (tests/integration/**),
 * que exigem um Supabase local rodando (supabase start && supabase db
 * reset) e por isso ficam fora de `npm test`. Ver instruções em
 * supabase/README.md e no cabeçalho de tests/integration/rls.integration.test.ts.
 */
export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/integration/**/*.test.{ts,tsx}"],
    testTimeout: 20000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
