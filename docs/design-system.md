# Design system — Fase 1

Extraído dos arquivos em `makarios-docs/brand/` antes de qualquer
implementação, conforme exigido. Este documento distingue claramente o que
foi **extraído da identidade fornecida** do que foi **assumido/padronizado**
por não haver especificação da marca para aquele aspecto.

## Fontes analisadas

- `logo-makarios-oficial-azul.png` — logotipo em creme sobre fundo azul (PNG, sem perda).
- `logo-makarios-oficial.png` — logotipo em creme sobre fundo transparente.
- `MAKARIOS PROPOSTA ID_page-0004 (1).jpg` — página do deck de identidade: origem do nome, tipografia (**Heuvel Grotesk**), construção do logotipo.
- `MAKARIOS PROPOSTA ID_page-0005.jpg` — página do deck: variação outline do logotipo, significado ("filhos bem-aventurados").
- `MAKARIOS PROPOSTA ID_page-0009.jpg` / `..._Editado_...png` — aplicação do logotipo em fundo azul sólido.
- `makarios-docs/certificate/MAKARIOS CERTIFICADO SEM NOME.pdf.pdf` — referência de aplicação (moldura, ícone de folha, hierarquia tipográfica em um documento formal).

Não há, nos arquivos fornecidos, uma página dedicada de paleta estendida,
grade de espaçamento, raios de borda ou biblioteca de ícones — esses pontos
estão marcados como **assumidos** abaixo, não inventados como "identidade
oficial".

## Cor — extraída via amostragem de pixel

| Token | Valor | Fonte | Observação |
|---|---|---|---|
| `--color-brand-blue` | `#2E7FBF` | `logo-makarios-oficial-azul.png`, amostrado nos 4 cantos (PNG sem compressão, tratado como autoritativo) | Azul primário da marca |
| `--color-brand-cream` | `#F7F6F1` | `logo-makarios-oficial.png` (preenchimento das letras) e `page-0005.jpg` (fundo), valores idênticos em dois arquivos independentes | Cor de contraste sobre o azul; também serve como "branco quente" de fundo |

**Pendência registrada**: as páginas do deck exportadas em JPEG
(`page-0004`, `page-0009`) amostram um azul de fundo ligeiramente diferente
(`#1482BF`). A diferença é pequena (mesma família de matiz azul-ciano) e
consistente com variação de exportação/compressão entre os arquivos, não
com uma segunda cor de marca deliberada — mas deve ser confirmada com quem
aprovou a identidade antes de finalizar o token em produção. Até lá,
`#2E7FBF` (do arquivo "oficial") é o valor usado no código.

### Escala derivada (assumida, não extraída)

A marca não fornece uma escala de tons do azul/creme. Foi gerada uma escala
neutra de 50–900 a partir dos dois tons extraídos, para uso em estados
(hover, disabled, fundo sutil, texto secundário) — ver `src/app/globals.css`.

## Tipografia

- **Fonte da marca**: **Heuvel Grotesk**, citada explicitamente na página
  0004 do deck ("Ênfase tipográfico no prefixo 'mak', uso de fonte Heuvel
  Grotesk"). É uma fonte comercial, sem licença de uso web confirmada e sem
  distribuição open-source conhecida.
- **Decisão da Fase 1**: usar **Poppins** (Google Fonts, licença SIL Open
  Font License, carregada via `next/font/google` — auto-hospedada pelo
  Next.js, nenhum arquivo de fonte de terceiros é redistribuído no
  repositório) como substituta temporária. Poppins foi escolhida por
  compartilhar as características mais visíveis do wordmark de referência:
  geometria arredondada, baixo contraste de traço, terminais suaves,
  proporção próxima em letras como "a" e "o".
- **Pendência registrada** (também na seção 23 do `PLANO_TECNICO.md`):
  confirmar com o proprietário da marca se há licença de uso web para
  Heuvel Grotesk; se houver, trocar o token `--font-brand` mantendo a
  mesma estrutura de tokens (nenhum outro código muda).

### Escala tipográfica (assumida — não especificada pela marca)

| Token | Tamanho | Uso |
|---|---|---|
| `--text-xs` | 12px | legendas, metadados |
| `--text-sm` | 14px | texto secundário, labels |
| `--text-base` | 16px | corpo de texto |
| `--text-lg` | 18px | destaque de corpo |
| `--text-xl` | 22px | título de card/seção |
| `--text-2xl` | 28px | título de página |
| `--text-3xl` | 36px | título de tela cheia (ex.: login) |

## Espaçamento, raio e bordas (assumidos — não especificados pela marca)

- Grade de espaçamento: múltiplos de 4px (Tailwind padrão), sem alteração.
- Raio de borda: `--radius-sm: 8px`, `--radius-md: 12px`, `--radius-lg: 20px`
  — o wordmark tem contra-formas bastante arredondadas (ver o "a" e o "k"
  na página 0004), então cards/botões usam raio generoso (12–20px) em vez
  do raio quase-reto comum em UIs corporativas, para não destoar da marca.
- Bordas: 1px, cor `--color-border` (derivada da escala neutra), exceto
  elementos de destaque que usam o azul da marca.

## Ícones

Nenhum ícone além da folha do logotipo foi fornecido. Fase 1 usa
`lucide-react` (open-source, MIT) como biblioteca de ícones de interface
(setas, olho de senha, spinner, alerta) — não tenta imitar o ícone de
folha, que permanece exclusivo do logotipo.

## Comportamento em celular e desktop

Os arquivos de marca não especificam breakpoints ou comportamento
responsivo (são artes estáticas de apresentação). Fase 1 adota o padrão já
definido no `PLANO_TECNICO.md` (mobile-first para aluno/professor,
desktop-first para coordenação/administração) usando os breakpoints padrão
do Tailwind (`sm`, `md`, `lg`, `xl`). O layout-base construído nesta fase
(`src/components/layout`) é fluido em ambos os sentidos — os layouts
específicos de cada área acadêmica (ainda não implementados) é que vão
divergir mobile-first vs. desktop-first a partir da Fase 2+.

## Tom de marca aplicado à UI

A instituição pediu explicitamente para evitar "aparência escolar
genérica" e "visual corporativo frio" (doc 06). Na prática, isso guiou
estas decisões:

- Fundo azul da marca usado com moderação (cabeçalhos, estados vazios,
  tela de login) — não como cor de fundo de toda a aplicação, que usa o
  creme/branco quente como base neutra para leitura prolongada.
- Cantos arredondados generosos em vez de UI "quadrada" de painel
  administrativo genérico.
- Sem gradientes, sombras pesadas ou efeitos — mantém a leitura limpa dos
  materiais de origem.
