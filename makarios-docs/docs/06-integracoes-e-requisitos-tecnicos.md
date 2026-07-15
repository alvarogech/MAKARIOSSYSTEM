# Integrações e requisitos técnicos

## 1. Diretriz geral

A plataforma será uma aplicação web responsiva.

Prioridades:

- experiência mobile para aluno e professor;
- experiência desktop para coordenação e administração;
- segurança;
- simplicidade;
- manutenção;
- custo sustentável;
- possibilidade de expansão.

## 2. Vídeos — YouTube não listado

### Requisitos

- armazenar URL e ID do vídeo;
- incorporar o player;
- não exibir o link de forma destacada;
- registrar eventos de reprodução;
- salvar progresso;
- considerar concluído após percentual configurado.

### Observação

O progresso obtido pelo player do YouTube pode ter limitações. A implementação deve usar a API oficial do player e registrar eventos de forma confiável, sem prometer proteção absoluta contra manipulação ou compartilhamento do link.

## 3. E-mail — Titan

Conta prevista:

```text
makarios@igrejaemaus.com.br
```

Nome do remetente:

```text
Escola Makários | Igreja Emaús
```

Usos:

- convite;
- primeiro acesso;
- recuperação de senha;
- comunicados;
- avaliação;
- reposição;
- certificado;
- notificações.

### Configuração

As credenciais devem ser fornecidas por variáveis de ambiente.

Exemplo:

```env
SMTP_HOST=
SMTP_PORT=
SMTP_SECURE=
SMTP_USER=makarios@igrejaemaus.com.br
SMTP_PASSWORD=
SMTP_FROM_NAME=Escola Makários | Igreja Emaús
SMTP_FROM_EMAIL=makarios@igrejaemaus.com.br
SMTP_REPLY_TO=makarios@igrejaemaus.com.br
```

Nunca versionar a senha.

Deve existir função de teste de envio no painel administrativo.

## 4. Armazenamento de arquivos

A plataforma deverá armazenar:

- PDFs;
- apresentações;
- documentos;
- imagens;
- certificados gerados;
- arquivos de importação.

Requisitos:

- acesso controlado;
- URL temporária ou autorizada quando necessário;
- limite de tamanho;
- validação de tipo;
- histórico de versão para material oficial;
- remoção lógica ou arquivamento.

## 5. Importação XLSX e CSV

O importador deve:

1. receber arquivo;
2. identificar cabeçalhos;
3. permitir mapeamento de colunas;
4. validar campos;
5. detectar duplicidade;
6. mostrar prévia;
7. permitir correção antes de importar;
8. processar em lote;
9. gerar relatório;
10. permitir baixar erros.

Campos esperados:

- nome;
- e-mail;
- telefone;
- nascimento;
- volume;
- temporada;
- turma;
- status;
- autorizado;
- observações.

## 6. Certificados em PDF

Requisitos:

- usar o modelo visual anexado;
- preencher dados dinamicamente;
- gerar código único;
- gerar QR Code;
- salvar o PDF;
- permitir reemissão;
- permitir invalidação com auditoria;
- disponibilizar validação pública.

## 7. Autenticação

Requisitos:

- login por e-mail;
- primeiro acesso por convite;
- senha criada pelo usuário;
- recuperação de senha;
- expiração de token;
- sessão segura;
- encerramento de sessões;
- bloqueio de usuário;
- proteção contra tentativas excessivas.

## 8. Segurança e LGPD

- senhas com hash seguro;
- controle de acesso no backend;
- mínimo privilégio;
- auditoria;
- backup;
- termos de uso;
- política de privacidade;
- registro de consentimento;
- exportação de dados;
- anonimização ou exclusão quando legalmente aplicável;
- não expor dados pessoais em logs;
- não expor credenciais no frontend.

## 9. Avaliação e cronômetro

A tentativa deve:

- salvar respostas automaticamente;
- registrar início e encerramento;
- manter consistência do cronômetro no servidor;
- não depender apenas do relógio do navegador;
- encerrar ao atingir 60 minutos;
- preservar respostas salvas em caso de queda;
- permitir tratamento excepcional pela coordenação;
- registrar cancelamento e nova tentativa em auditoria.

## 10. Responsividade

### Aluno e professor

Desenvolvimento mobile first.

### Coordenação e administração

Desktop first, mas funcional em tablet e celular.

## 11. Acessibilidade

- contraste adequado;
- navegação por teclado;
- labels em campos;
- status com texto e ícone;
- mensagens de erro claras;
- botões com tamanho adequado;
- não depender apenas de cor;
- HTML semântico.

## 12. Desempenho

- paginação;
- filtros no servidor quando necessário;
- carregamento progressivo;
- cache seguro;
- otimização de imagens;
- consultas indexadas;
- processamento de importação sem travar a interface.

## 13. Logs e monitoramento

Registrar:

- erros;
- falhas de envio de e-mail;
- falhas de importação;
- tentativas de acesso;
- alterações críticas;
- falhas na geração de certificado.

## 14. Ambientes

Manter:

- desenvolvimento;
- homologação;
- produção.

Cada ambiente deve ter banco, credenciais e armazenamento separados.

## 15. Arquivos visuais

Os arquivos de identidade visual devem ser analisados antes da implementação do design.

A interface deve:

- respeitar marca;
- não inventar nova linguagem;
- adaptar elementos para uso digital;
- manter boa legibilidade;
- evitar aparência escolar genérica;
- evitar visual corporativo frio;
- evitar excesso de efeitos.
