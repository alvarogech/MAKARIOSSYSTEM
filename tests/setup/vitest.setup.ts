import "@testing-library/jest-dom/vitest";

// Variáveis mínimas para que módulos que leem `process.env` em nível de
// função (nunca em nível de import) não quebrem caso algum teste os
// exercite indiretamente. Nenhum destes valores é real.
process.env.NEXT_PUBLIC_SUPABASE_URL ||= "http://localhost:54321";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||= "test-publishable-key";
process.env.NEXT_PUBLIC_APP_URL ||= "http://localhost:3000";
process.env.SUPABASE_SECRET_KEY ||= "test-secret-key-do-not-use-in-prod";
