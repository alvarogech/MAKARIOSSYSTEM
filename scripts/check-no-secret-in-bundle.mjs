#!/usr/bin/env node
/**
 * Confere, depois de `npm run build`, que a SUPABASE_SECRET_KEY (e o nome
 * da própria variável) nunca aparece nos artefatos client-side gerados
 * pelo Next.js. Só variáveis prefixadas com NEXT_PUBLIC_ podem ir para o
 * bundle do navegador — isso valida empiricamente que o client
 * administrativo (src/integrations/supabase/admin.ts) não vazou.
 *
 * Uso: node scripts/check-no-secret-in-bundle.mjs
 * Saída: exit code 0 se nada foi encontrado, 1 caso contrário.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const CLIENT_BUILD_DIR = join(process.cwd(), ".next", "static");
const FORBIDDEN_NEEDLES = [
  "SUPABASE_SECRET_KEY",
  process.env.SUPABASE_SECRET_KEY,
].filter((needle) => typeof needle === "string" && needle.length > 0);

function collectFiles(dir) {
  let files = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      files = files.concat(collectFiles(fullPath));
    } else if (entry.endsWith(".js") || entry.endsWith(".js.map")) {
      files.push(fullPath);
    }
  }
  return files;
}

function main() {
  let buildFiles;
  try {
    buildFiles = collectFiles(CLIENT_BUILD_DIR);
  } catch {
    console.error(
      `Diretório de build client-side não encontrado em ${CLIENT_BUILD_DIR}. ` +
        "Rode `npm run build` antes deste script.",
    );
    process.exit(1);
  }

  const findings = [];

  for (const file of buildFiles) {
    const content = readFileSync(file, "utf8");
    for (const needle of FORBIDDEN_NEEDLES) {
      if (content.includes(needle)) {
        findings.push({ file, needle });
      }
    }
  }

  if (findings.length > 0) {
    console.error(
      "FALHA: encontrado material sensível no bundle client-side:",
    );
    for (const { file, needle } of findings) {
      console.error(`  - "${needle}" em ${file}`);
    }
    process.exit(1);
  }

  console.log(
    `OK: nenhuma ocorrência de SUPABASE_SECRET_KEY (nome ou valor) em ` +
      `${buildFiles.length} arquivo(s) client-side inspecionado(s) em ${CLIENT_BUILD_DIR}.`,
  );
}

main();
