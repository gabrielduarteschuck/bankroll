# 📋 Resumo do Projeto - NBA Dashboard

## 🎯 Objetivo
Dashboard para gestão de apostas esportivas (NBA) com controle de banca, entradas, relatórios e painel administrativo.

## 📁 Estrutura do Projeto

### Arquivos SQL Necessários (Execute no Supabase SQL Editor)
1. **`CRIAR-TUDO.sql`** - Cria tabelas `banca` e `entradas` com RLS
2. **`SOLUCAO-DEFINITIVA-PROFILES.sql`** - Cria tabela `profiles` e trigger automático
3. **`CRIAR-PROFILES-ADMIN-POLICY.sql`** - Cria política RLS para admin panel

### Documentação
- **`CHECKLIST.md`** - Checklist completo de verificação
- **`ADMIN-SETUP.md`** - Instruções para configurar painel admin
- **`README.md`** - Documentação principal

### Rotas Principais

#### Públicas
- `/` - Página inicial (redireciona para `/dashboard` se logado)
- `/login` - Página de login

#### Protegidas (requer login)
- `/dashboard` - Painel principal com métricas e filtros
- `/dashboard/registrar-entradas` - Formulário para registrar novas entradas
- `/dashboard/minhas-entradas` - Lista de todas as entradas (editável)
- `/dashboard/banca` - Configuração da banca inicial e stakes
- `/dashboard/relatorios` - Relatórios com gráficos e projeções
- `/dashboard/como-funciona` - Página com espaço para vídeo do YouTube
- `/dashboard/ajustes` - Configurações e reset de dados

#### Admin (requer login + email na whitelist)
- `/admin` - Painel administrativo listando todos os usuários

## 🔧 Configuração

### Variáveis de Ambiente (`.env.local`)
```env
NEXT_PUBLIC_SUPABASE_URL=sua-url-do-supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-chave-anon-do-supabase
ADMIN_EMAILS=seu-email@exemplo.com,outro-email@exemplo.com
```

### Instalação
```bash
npm install
npm run dev
```

## 🗄️ Estrutura do Banco de Dados

### Tabela `banca`
- `id` (UUID)
- `user_id` (UUID, FK para auth.users)
- `valor` (DECIMAL)
- `created_at`, `updated_at` (TIMESTAMP)

### Tabela `entradas`
- `id` (UUID)
- `user_id` (UUID, FK para auth.users)
- `stake` (DECIMAL)
- `odd` (DECIMAL)
- `valor_apostado` (DECIMAL)
- `resultado` (TEXT: 'green' ou 'red')
- `valor_resultado` (DECIMAL)
- `mercado` (TEXT, nullable)
- `created_at` (TIMESTAMP)

### Tabela `profiles`
- `id` (UUID, FK para auth.users)
- `email` (TEXT)
- `created_at`, `updated_at` (TIMESTAMP)

## 🎨 Funcionalidades Principais

### Dashboard
- Métricas: Total Entradas, Greens, Reds, Banca Inicial, Banca Atual, % Lucro, ROI
- Filtros de período: Hoje, Ontem, 7/15/30/60/90 dias, Personalizado
- Sequências de Greens animadas

### Registrar Entradas
- Seleção de stake (0.2%, 0.5%, 1%, 2%, 5% ou customizado)
- Input de odd
- Cálculo automático do valor apostado
- Seleção de mercado (NBA) ou "Outros"
- Marcação de resultado (green/red)
- Cálculo automático do resultado

### Relatórios
- Gráfico de Greens/Reds (estilo bolinha)
- Gráfico de desempenho da banca
- Projeções: 30, 90, 180 dias
- Desempenho por mercado

### Tema
- Tema escuro (padrão) e claro
- Toggle no menu lateral
- Preferência salva no localStorage

## 🔐 Segurança

- Middleware protege todas as rotas `/dashboard` e `/admin`
- RLS (Row Level Security) no Supabase
- Admin panel protegido por whitelist de emails
- Sessões gerenciadas via Supabase Auth Helpers

## 📝 Próximas Melhorias (Opcional)

- Paginação nas listas grandes
- Exportação de relatórios (PDF/Excel)
- Notificações push
- Dashboard mobile otimizado
- Integração com APIs de odds

---

**Última atualização**: Janeiro 2025
