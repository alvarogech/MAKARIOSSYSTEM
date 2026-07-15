// Stub para testes: o pacote real "server-only" lança um erro sempre que é
// importado fora do bundler do Next.js (que é quem realmente sabe
// distinguir bundle de servidor vs. de cliente). Fora do Next.js — como no
// Vitest — essa checagem não faz sentido e só atrapalharia testar módulos
// que legitimamente são server-only. Ver alias em vitest.config.ts.
export {};
