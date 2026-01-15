# ✅ Checklist de Verificação - NBA Dashboard

## 🔐 Autenticação e Segurança

- [ ] **Login com Supabase funcionando**
  - Verificar: `/login` permite login e redireciona para `/dashboard`
  - Verificar: Credenciais são salvas no navegador

- [ ] **Middleware protegendo rotas**
  - Verificar: `/dashboard` só acessível com sessão ativa
  - Verificar: `/admin` só acessível para emails na whitelist
  - Verificar: Usuários não-admin são redirecionados de `/admin` para `/dashboard`

- [ ] **Variável de ambiente ADMIN_EMAILS configurada**
  - Verificar: Arquivo `.env.local` existe com `ADMIN_EMAILS=seu-email@exemplo.com`
  - Verificar: Múltiplos emails separados por vírgula funcionam

## 🗄️ Banco de Dados (Supabase)

- [ ] **Tabela `profiles` criada**
  - Verificar: Execute `SOLUCAO-DEFINITIVA-PROFILES.sql` no Supabase SQL Editor
  - Verificar: Tabela tem colunas: `id`, `email`, `created_at`, `updated_at`

- [ ] **Trigger automático funcionando**
  - Verificar: Ao criar novo usuário, perfil é criado automaticamente em `profiles`
  - Verificar: Função `handle_new_user()` existe no Supabase

- [ ] **Política RLS configurada**
  - Verificar: Execute `CRIAR-PROFILES-ADMIN-POLICY.sql` no Supabase SQL Editor
  - Verificar: Usuários autenticados podem ver todos os perfis (para admin panel)

- [ ] **Tabelas principais existem**
  - Verificar: `banca` existe com coluna `valor`
  - Verificar: `entradas` existe com colunas: `id`, `user_id`, `stake`, `odd`, `valor_apostado`, `resultado`, `valor_resultado`, `mercado`, `created_at`
  - Se não existirem: Execute `CRIAR-TUDO.sql` no Supabase SQL Editor

## 🎨 Interface e Funcionalidades

- [ ] **Dashboard principal (`/dashboard`)**
  - Verificar: Mostra métricas (Total Entradas, Greens, Reds, Banca Inicial, Banca Atual, % Lucro, ROI)
  - Verificar: Filtros de período funcionam (Hoje, Ontem, 7 dias, etc.)
  - Verificar: Sequências de Greens animadas aparecem

- [ ] **Registrar Entradas (`/dashboard/registrar-entradas`)**
  - Verificar: Formulário permite registrar entrada com stake, odd, mercado
  - Verificar: Valor apostado é calculado automaticamente
  - Verificar: Resultado é calculado automaticamente (green/red)
  - Verificar: Formulário reseta após salvar

- [ ] **Minhas Entradas (`/dashboard/minhas-entradas`)**
  - Verificar: Lista todas as entradas registradas
  - Verificar: Filtros de período funcionam
  - Verificar: Entradas são editáveis

- [ ] **Banca (`/dashboard/banca`)**
  - Verificar: Permite definir valor da banca inicial
  - Verificar: Mostra stakes calculadas (0.2%, 0.5%, 1%, 2%, 5%)
  - Verificar: Botão "Reajustar Stake para Banca Atual" funciona

- [ ] **Relatórios (`/dashboard/relatorios`)**
  - Verificar: Gráfico de Greens/Reds (bolinha) funciona
  - Verificar: Gráfico de desempenho da banca funciona
  - Verificar: Projeções (30, 90, 180 dias) aparecem
  - Verificar: Desempenho por mercado aparece

- [ ] **Como Funciona (`/dashboard/como-funciona`)**
  - Verificar: Espaço para embed de vídeo do YouTube existe

- [ ] **Ajustes (`/dashboard/ajustes`)**
  - Verificar: Botão "Redefinir Todo Processo" funciona
  - Verificar: Apaga todas as entradas e banca do usuário

- [ ] **Painel Admin (`/admin`)**
  - Verificar: Lista todos os usuários cadastrados
  - Verificar: Mostra email e data de criação
  - Verificar: Apenas admins podem acessar

## 🎨 Tema

- [ ] **Tema escuro/claro funcionando**
  - Verificar: Botão de toggle no menu lateral funciona
  - Verificar: Preferência é salva no localStorage
  - Verificar: Tema escuro é o padrão
  - Verificar: Todas as páginas respeitam o tema selecionado

## 📝 Variáveis de Ambiente Necessárias

Crie um arquivo `.env.local` na raiz do projeto com:

```env
NEXT_PUBLIC_SUPABASE_URL=sua-url-do-supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-chave-anon-do-supabase
ADMIN_EMAILS=seu-email@exemplo.com,outro-email@exemplo.com
```

## 📋 Arquivos SQL Necessários

Execute estes arquivos no Supabase SQL Editor (nesta ordem):

1. **`CRIAR-TUDO.sql`** - Cria tabelas `banca` e `entradas` com RLS
2. **`SOLUCAO-DEFINITIVA-PROFILES.sql`** - Cria tabela `profiles` e trigger automático
3. **`CRIAR-PROFILES-ADMIN-POLICY.sql`** - Cria política RLS para admin panel

## 📝 Próximos Passos (Opcional)

- [ ] Adicionar testes automatizados
- [ ] Implementar paginação nas listas grandes
- [ ] Adicionar exportação de relatórios (PDF/Excel)
- [ ] Melhorar tratamento de erros com mensagens mais amigáveis
- [ ] Adicionar loading states mais elaborados

## 🐛 Problemas Conhecidos

- Nenhum problema conhecido no momento

---

**Última atualização**: Janeiro 2025
