# 📝 Passo a Passo - O Que Fazer Manualmente

## ✅ Checklist Rápido

Você precisa fazer **3 coisas manualmente**:

1. ✅ Criar arquivo `.env.local` com suas credenciais do Supabase
2. ✅ Executar 3 scripts SQL no Supabase SQL Editor
3. ✅ Testar se tudo está funcionando

---

## 🔧 Passo 1: Configurar Variáveis de Ambiente

### 1.1 Criar arquivo `.env.local` na raiz do projeto

Crie um arquivo chamado `.env.local` (sem aspas) na pasta raiz do projeto (`/Users/gabrielduarteschuck/nba-dashboard/`)

### 1.2 Adicionar as seguintes linhas:

```env
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-chave-anon-aqui
ADMIN_EMAILS=seu-email@exemplo.com
```

**Onde encontrar essas informações:**
- Acesse seu projeto no [Supabase Dashboard](https://app.supabase.com)
- Vá em **Settings** → **API**
- Copie a **URL** e a **anon/public key**
- Para `ADMIN_EMAILS`, use o email que você usa para fazer login (pode adicionar múltiplos separados por vírgula)

**Exemplo completo:**
```env
NEXT_PUBLIC_SUPABASE_URL=https://abcdefghijklmnop.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTYzODk2NzI4MCwiZXhwIjoxOTU0NTQzMjgwfQ.exemplo123456789
ADMIN_EMAILS=gabriel@exemplo.com,admin@exemplo.com
```

---

## 🗄️ Passo 2: Executar Scripts SQL no Supabase

### 2.1 Acessar o SQL Editor do Supabase

1. Acesse [Supabase Dashboard](https://app.supabase.com)
2. Selecione seu projeto
3. No menu lateral, clique em **SQL Editor** (ícone de banco de dados)

### 2.2 Executar os 3 scripts (nesta ordem)

#### Script 1: `CRIAR-TUDO.sql`
- Abra o arquivo `CRIAR-TUDO.sql` do projeto
- Copie **todo o conteúdo**
- Cole no SQL Editor do Supabase
- Clique em **Run** (ou pressione `Ctrl+Enter` / `Cmd+Enter`)
- ✅ Deve aparecer "Success. No rows returned"

#### Script 2: `SOLUCAO-DEFINITIVA-PROFILES.sql`
- Abra o arquivo `SOLUCAO-DEFINITIVA-PROFILES.sql` do projeto
- Copie **todo o conteúdo**
- Cole no SQL Editor do Supabase
- Clique em **Run**
- ✅ Deve aparecer "Success. No rows returned"

#### Script 3: `CRIAR-PROFILES-ADMIN-POLICY.sql`
- Abra o arquivo `CRIAR-PROFILES-ADMIN-POLICY.sql` do projeto
- Copie **todo o conteúdo**
- Cole no SQL Editor do Supabase
- Clique em **Run**
- ✅ Deve aparecer "Success. No rows returned"

**⚠️ Importante:** Execute os scripts **nesta ordem** e **um de cada vez**. Aguarde cada um terminar antes de executar o próximo.

---

## 🧪 Passo 3: Testar se Está Funcionando

### 3.1 Reiniciar o servidor de desenvolvimento

No terminal, pare o servidor (se estiver rodando) e inicie novamente:

```bash
npm run dev
```

Isso garante que as variáveis de ambiente sejam carregadas.

### 3.2 Testar Login

1. Acesse `http://localhost:3000/login`
2. Faça login com seu email e senha
3. ✅ Deve redirecionar para `/dashboard`

### 3.3 Testar Dashboard

1. Verifique se as métricas aparecem no dashboard
2. Tente registrar uma entrada em `/dashboard/registrar-entradas`
3. Verifique se aparece em `/dashboard/minhas-entradas`

### 3.4 Testar Painel Admin (se configurou ADMIN_EMAILS)

1. Acesse `http://localhost:3000/admin`
2. ✅ Se seu email está em `ADMIN_EMAILS`, deve ver a lista de usuários
3. ✅ Se não está, deve redirecionar para `/dashboard`

---

## ❌ Problemas Comuns

### Erro: "Could not find the table 'public.banca'"
**Solução:** Execute o script `CRIAR-TUDO.sql` novamente no Supabase SQL Editor

### Erro: "column 'email' does not exist"
**Solução:** Execute o script `SOLUCAO-DEFINITIVA-PROFILES.sql` novamente

### Erro: "Invalid API key" ou "Failed to fetch"
**Solução:** Verifique se o arquivo `.env.local` está na raiz do projeto e se as credenciais estão corretas. Reinicie o servidor (`npm run dev`)

### Painel Admin não funciona / redireciona sempre
**Solução:** 
1. Verifique se o email em `ADMIN_EMAILS` é **exatamente** o mesmo que você usa para fazer login
2. Verifique se não há espaços extras no `.env.local`
3. Reinicie o servidor após alterar `.env.local`

### Variáveis de ambiente não carregam
**Solução:** 
1. Certifique-se de que o arquivo se chama `.env.local` (com o ponto no início)
2. Reinicie o servidor completamente (pare e inicie novamente)
3. Verifique se não há erros de sintaxe no arquivo (sem aspas nas strings)

---

## ✅ Pronto!

Depois de fazer esses 3 passos, seu projeto deve estar funcionando completamente!

Se tiver algum problema, consulte o arquivo `CHECKLIST.md` para verificar cada item.
