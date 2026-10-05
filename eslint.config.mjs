// eslint-config-next@16 já exporta um array de flat config nativo do
// ESLint 9 — nada de FlatCompat/eslintrc legado aqui (isso quebrava com um
// erro de "circular structure" ao tentar validar o plugin React como se
// fosse uma config legada).
import nextConfig from "eslint-config-next";

const eslintConfig = [
  ...nextConfig,
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "supabase/functions/**",
      "makarios-docs/**",
    ],
  },
  {
    // Chama a atenção em code review (e falha o lint) se alguém importar o
    // client administrativo do Supabase fora dos poucos lugares
    // explicitamente revisados que realmente precisam dele. A proteção
    // "de verdade" contra vazamento para o bundle do navegador é o
    // `import "server-only"` dentro do próprio admin.ts (falha o build);
    // esta regra é uma segunda camada, mais cedo no ciclo (falha o lint
    // antes mesmo de tentar buildar).
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/integrations/supabase/admin",
              message:
                "O client administrativo do Supabase é exclusivamente server-side. " +
                "Use '@/integrations/supabase/server' (respeitando RLS) em vez disso, " +
                "a menos que a operação realmente exija privilégio administrativo — " +
                "e, nesse caso, isole o import num arquivo listado nas exceções deste " +
                "eslint.config.mjs, não num Client Component.",
            },
            {
              name: "@/lib/serverEnv",
              message:
                "Variáveis server-only (SUPABASE_SECRET_KEY, ENROLLMENT_DATA_KEY) — " +
                "use '@/lib/env' (getPublicEnv) se só precisar da URL/chave " +
                "publicáveis. Import legítimo só nas exceções deste arquivo.",
            },
          ],
        },
      ],
    },
  },
  {
    // Exceções revisadas: os únicos lugares que legitimamente precisam do
    // client administrativo e/ou das variáveis server-only nesta fase.
    files: [
      "src/jobs/index.ts",
      "src/modules/**/actions/**",
      "netlify/functions/**",
      "src/integrations/supabase/admin.ts",
      "src/modules/enrollment/dataProtection.ts",
      // Leitura pública (página sem sessão) do estado de um token de
      // convite manual — precisa bypassar RLS de `invitations` (que nunca
      // libera SELECT para anon, de propósito), mas só lê, nunca escreve.
      "src/modules/auth/inspectInviteToken.ts",
      // Único lugar que monta o transporte SMTP — precisa das credenciais
      // server-only (SMTP_*) de @/lib/serverEnv.
      "src/modules/notifications/mailer.ts",
      // Deriva o token estável do convite de aluno (HMAC com o segredo do
      // servidor) — o link do e-mail inicial, dos lembretes e dos reenvios
      // é sempre o mesmo.
      "src/modules/auth/inviteTokens.ts",
      // Lembrete de primeiro acesso do aluno é disparado por uma rota de
      // cron sem sessão de usuário — precisa do client administrativo
      // para ler/escrever `invitations` de qualquer um.
      "src/modules/enrollment/studentReminders.ts",
      // Decide se o convite usa e-mail+senha ou código de acesso —
      // precisa checar auth.users (admin) pra saber se o e-mail já está
      // em uso por outra conta.
      "src/modules/enrollment/studentInvite.ts",
      // Rota chamada pelo pg_cron (sem sessão) — precisa do segredo
      // compartilhado CRON_SECRET para autenticar a chamada.
      "src/app/api/cron/student-reminders/route.ts",
      // Reenvio manual pontual de convite de aluno (mesmo segredo
      // compartilhado, sem sessão de usuário).
      "src/app/api/admin/resend-student-invite/route.ts",
    ],
    rules: {
      "no-restricted-imports": "off",
    },
  },
];

export default eslintConfig;
