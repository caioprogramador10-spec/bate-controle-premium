# Bate-Controle Elite · Premium

Controle financeiro de turmas de bate-bola: componentes, pagamentos da fantasia,
custos extras rateados, despesas, cobrança por WhatsApp e relatórios.

Nova versão visual baseada no padrão do **Sistema RH Premium v3** (tokens, tema
claro/escuro, superfícies de vidro), com identidade própria.

## Identidade visual — "Folia & Ouro"

| Token | Cor | Significado |
|---|---|---|
| `--brand` | `#7c3aed` Roxo Folia | o cetim das fantasias — botões, links, navegação |
| `--gold` | `#f2b011` Ouro Elite | o dourado da logo — dinheiro, destaques, plano |
| `--night` | `#140b26` Noite de Desfile | fundo das áreas de marca (login, balanço) |

Para mudar a identidade, edite só os tokens em `assets/css/base.css`.

## Estrutura

```
index.html               telas: login, bloqueio, app, painéis e modais
manifest.webmanifest     instalação como app (nome, cores, ícones, atalhos)
sw.js                    service worker: abre rápido e funciona sem internet
assets/img/icon-*.png    ícones do app (192, 512, maskable, iPhone, favicon)
assets/css/base.css      tokens, temas e base
assets/css/layout.css    login, menu lateral, barra inferior do celular, master
assets/css/components.css botões, cards, tabela→cartões, modais, avisos
assets/css/admin.css     painel master
assets/img/logo.png
js/config.js             Supabase, preço, PIX, WhatsApp, Telegram, admin
js/app.js                lógica do app da turma
js/admin.js              painel master (dono do sistema)
supabase/schema.sql      tabelas, índices e permissões do Supabase
js/pagamentos.js         botão "Pagar com cartão" (Mercado Pago) — original
```

## Banco de dados (Supabase)

O arquivo `supabase/schema.sql` cria as 4 tabelas (`batecontroleusers`,
`componentes`, `extras`, `gastos_manuais`), os índices e as permissões.

- **Projeto novo:** Supabase › SQL Editor › cole o arquivo › Run.
- **Projeto que já está no ar:** pode rodar o mesmo arquivo sem medo — ele usa
  `if not exists` e só **acrescenta** as colunas `observacao` e `ultimo_acesso`
  em `batecontroleusers` (usadas pelo painel master). Nada é apagado.

Sem rodar o SQL o sistema continua funcionando; só as anotações e o
"último acesso" do painel master ficam indisponíveis.

## Painel master

Entre com o usuário master. A tela mostra:
- Receita mensal recorrente, taxa de conversão, potencial e receita em risco.
- Indicadores clicáveis: turmas, assinantes, em teste, vencendo em 7 dias, bloqueadas.
- Lista de turmas com busca (nome, WhatsApp, padrinho), filtros e ordenação,
  barra de prazo e botões rápidos de WhatsApp e "+30 dias".
- Próximos vencimentos, ranking de indicações (50% off com 5, grátis com 10)
  e gráfico de novas turmas por mês.
- Detalhes da turma: uso do sistema (componentes, atrasados, arrecadado, caixa),
  +30 / +90 / +1 ano / +7 dias grátis, data e status manuais, anotações internas,
  mensagens prontas (cobrança, boas-vindas, pagamento confirmado),
  redefinir senha, trocar WhatsApp e apagar turma (com os dados dela).
- Avisar em lote quem vence e exportar a lista de turmas em CSV.
- **Turmas sem entrar no app:** o sistema registra cada acesso da turma
  (`ultimo_acesso`) e marca como "Sem acesso" toda turma ativa que está há
  `DIAS_INATIVIDADE` dia(s) sem abrir o app (padrão: 1, em `js/config.js`).
  Aparecem num cartão próprio, num filtro da lista e no painel "Turmas sem entrar",
  com botão "Lembrar" (mensagem pronta no WhatsApp com o link do app) e
  "Lembrar quem sumiu" para enviar a todas. Turmas já lembradas no dia ficam marcadas.
  Requer rodar o `supabase/schema.sql` (cria a coluna `ultimo_acesso`).

## O que mudou

**Visual e uso no celular**
- Computador: menu lateral com selo do plano (teste/assinante) e contador de atrasados.
- Celular: barra inferior (Início · Turma · **+** · Caixa · Mais), modais que sobem
  de baixo, campos com 16px (sem zoom no iPhone), tabela vira cartões.
- Tema claro/escuro (segue o sistema e lembra a escolha).
- Ícones SVG no lugar de emojis; tela de login dividida; tela de bloqueio redesenhada.

**Melhorias**
- Visão geral: balanço em caixa com barra de arrecadação, vencimentos dos próximos
  7 dias e maiores saldos em aberto.
- Situação de cada componente: atrasado (com dias), vence hoje/amanhã, em X dias, quitado.
- Filtros com contagem (Todos / Atrasados / Em dia / Quitados) e busca por nome ou telefone.
- Registrar pagamento em modal com valores rápidos ("Quitar") e opção de avançar ou não o vencimento.
- Editar componente completo (nome, WhatsApp, valor, vencimento, corrigir valor pago).
- Novo componente já vem com o valor e o dia de vencimento mais usados na turma.
- Mensagem de cobrança correta conforme a situação (antes dizia sempre "vence amanhã").
- "Avisar vencimentos" abre uma lista com botão por pessoa (antes abria várias abas
  automaticamente e o navegador bloqueava).
- Confirmações e perguntas em modais próprios, avisos (toast) no lugar de `alert()`.
- Valores em R$ no padrão brasileiro e máscara de telefone.
- Exportar planilha CSV (abre no Excel), PDF redesenhado nas cores da marca.
- **Modo demonstração** sem cadastro (dados ficam só no aparelho) — bom para vender.
- Painel master: contadores de assinantes/teste, renovação soma a partir do vencimento atual.
- Instalável na tela inicial do celular (manifest).

**Correções**
- Cabeçalho da tabela tinha 5 colunas e as linhas 6.
- Datas calculadas no fuso local (à noite o "amanhã" virava "depois de amanhã").
- Nomes digitados agora são escapados (antes um nome com HTML quebrava a tela).
- A senha não fica mais salva no `localStorage`.

## Segurança — pontos de atenção (não alterados)

Estes já existiam no projeto original e continuam iguais, porque mudar exige
mexer no Supabase:

1. **Login master no navegador** (`ADMIN_USER`/`ADMIN_PASS` em `js/config.js`): qualquer
   pessoa que abrir o código-fonte vê a senha. Recomendado: usar Supabase Auth.
2. **Token do bot do Telegram** exposto no front-end (`config.js` e `pagamentos.js`):
   qualquer um pode enviar mensagens pelo seu bot. Recomendado: mover o envio para
   uma Edge Function do Supabase e gerar um token novo no @BotFather.
3. **Senhas das turmas em texto puro** na tabela `batecontroleusers`, e a liberação
   do acesso é conferida no navegador. Recomendado: Supabase Auth + RLS por `turma_id`.

## Rodar localmente

Qualquer servidor estático serve, por exemplo:

```
python -m http.server 5510
```

e abra `http://localhost:5510`.

## Usar como app no celular

- **Android (Chrome):** abra o site › menu ⋮ › **Instalar app**. Vira um ícone
  na tela inicial e abre em tela cheia, sem barra do navegador.
- **iPhone (Safari):** botão Compartilhar › **Adicionar à Tela de Início**.
- O app precisa estar publicado em **https** (Netlify, Vercel, GitHub Pages…).
  Abrindo o arquivo direto do computador, a instalação e o modo sem internet não funcionam.
- **Sem internet:** o app abre normalmente e mostra a faixa "Sem internet".
  Os dados só são salvos com conexão; quando ela volta, a tela atualiza sozinha.
- **Ao publicar uma versão nova:** aumente o número de `VERSAO` no `sw.js`
  (ex.: `bc-v2` → `bc-v3`) para os celulares baixarem os arquivos novos.
- Botões e ícones têm área de toque mínima de 44px no celular.
