# Documentação oficial — Plataforma Makários

Este diretório contém a especificação consolidada da Plataforma de Ensino da Escola Makários, da Igreja Emaús.

## Ordem de leitura

1. `01-visao-produto-e-escopo.md`
2. `02-regras-finais-de-negocio.md`
3. `03-perfis-e-permissoes.md`
4. `04-mapa-de-telas-e-jornadas.md`
5. `05-modelo-de-dados-conceitual.md`
6. `06-integracoes-e-requisitos-tecnicos.md`
7. `07-mvp-roadmap-e-criterios-de-aceitacao.md`
8. `08-dados-iniciais-temporada-2026-2.md`

## Regra de prioridade

Estes arquivos representam a versão consolidada e atual do projeto.

Quando houver conflito com conversas anteriores, rascunhos, anotações ou outros documentos, prevalece a seguinte ordem:

1. `02-regras-finais-de-negocio.md`
2. `08-dados-iniciais-temporada-2026-2.md`
3. Demais documentos deste diretório
4. Arquivos de referência visual
5. Materiais históricos

Não implementar regras antigas que conflitem com esta documentação.

## Arquivos de identidade visual e certificado

Os arquivos da identidade visual oficial da Makários devem ser colocados fora deste diretório, preferencialmente assim:

```text
/brand
  logo-makarios.*
  manual-identidade.*
  paleta.*
  tipografia-ou-referencias.*
  elementos-graficos.*

/certificate
  modelo-certificado-volume.*
  modelo-certificado-formacao-completa.*
```

A plataforma deve adaptar a identidade visual oficial para uma interface digital, sem criar uma nova marca.

## Premissas importantes

- A plataforma é um apoio às aulas presenciais, não uma substituição.
- O primeiro lançamento atenderá somente à Igreja Emaús.
- Não haverá sistema de pagamento dentro da plataforma.
- Alunos serão cadastrados manualmente ou por importação de planilha.
- O desenvolvimento deve ser feito por fases.
- Não tentar construir todo o sistema em uma única entrega.
