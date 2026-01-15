# ⚠️ IMPORTANTE: Como Executar os Scripts SQL

## ❌ NÃO execute arquivos `.md` (markdown) no SQL Editor!

O erro que você viu acontece porque tentou executar um arquivo `.md` no SQL Editor.

## ✅ Execute APENAS arquivos `.sql`

---

## 📋 Passo a Passo Correto

### 1️⃣ Execute `CRIAR-TUDO.sql`

1. **Abra o arquivo:** `CRIAR-TUDO.sql` (não o `.md`!)
2. **Copie TODO o conteúdo** (Ctrl+A, Ctrl+C)
3. **No Supabase:** SQL Editor → Cole o conteúdo → Clique em **Run**

**O arquivo correto começa com:**
```sql
-- Criar tabela BANCA
CREATE TABLE IF NOT EXISTS public.banca (
```

**❌ NÃO execute arquivos que começam com:**
```
# Configuração do Painel Admin
```
(Isso é markdown, não SQL!)

---

### 2️⃣ Execute `SOLUCAO-DEFINITIVA-PROFILES.sql`

1. **Abra o arquivo:** `SOLUCAO-DEFINITIVA-PROFILES.sql`
2. **Copie TODO o conteúdo**
3. **No Supabase:** SQL Editor → Cole → **Run**

**O arquivo correto começa com:**
```sql
-- SOLUÇÃO DEFINITIVA - Execute este arquivo completo
CREATE TABLE IF NOT EXISTS public.profiles (
```

---

### 3️⃣ Execute `CRIAR-PROFILES-ADMIN-POLICY.sql`

1. **Abra o arquivo:** `CRIAR-PROFILES-ADMIN-POLICY.sql`
2. **Copie TODO o conteúdo**
3. **No Supabase:** SQL Editor → Cole → **Run**

**O arquivo correto começa com:**
```sql
-- Política adicional para permitir que admins vejam todos os perfis
DROP POLICY IF EXISTS "profiles_select_all_for_admins" ON public.profiles;
```

---

## 🔍 Como Identificar o Arquivo Correto

### ✅ Arquivo SQL (CORRETO para executar):
- Nome termina em `.sql`
- Conteúdo começa com `--` (comentários SQL) ou `CREATE TABLE`
- Exemplo: `CRIAR-TUDO.sql`

### ❌ Arquivo Markdown (NÃO executar):
- Nome termina em `.md`
- Conteúdo começa com `#` (títulos markdown)
- Exemplo: `ADMIN-SETUP.md`, `CHECKLIST.md`, `PASSO-A-PASSO-MANUAL.md`

---

## 📝 Resumo dos 3 Arquivos SQL para Executar

Execute **nesta ordem** no Supabase SQL Editor:

1. ✅ **`CRIAR-TUDO.sql`** - Cria tabelas `banca` e `entradas`
2. ✅ **`SOLUCAO-DEFINITIVA-PROFILES.sql`** - Cria tabela `profiles` e trigger
3. ✅ **`CRIAR-PROFILES-ADMIN-POLICY.sql`** - Cria política RLS

**Todos os 3 arquivos terminam em `.sql`!**
