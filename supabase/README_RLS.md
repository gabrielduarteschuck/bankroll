# 🔐 Row Level Security (RLS) - Documentação

## 📋 Visão Geral

Este projeto implementa **Row Level Security (RLS)** completo no Supabase, garantindo que:
- Usuários comuns só acessam seus próprios dados
- Admins podem acessar todos os dados
- Controle de acesso baseado em **role** na tabela `profiles`

---

## 🗄️ Estrutura das Tabelas

### Tabela `profiles`
- `id` (UUID, PK) - Referencia `auth.users(id)`
- `email` (TEXT) - Email do usuário
- `role` (TEXT) - Role: `'user'` (padrão) ou `'admin'`
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

### Tabela `banca`
- `id` (UUID, PK)
- `user_id` (UUID, FK) - Referencia `auth.users(id)`
- `valor` (DECIMAL)
- `created_at`, `updated_at` (TIMESTAMPTZ)

### Tabela `entradas`
- `id` (UUID, PK)
- `user_id` (UUID, FK) - Referencia `auth.users(id)`
- `stake_percent`, `valor_stake`, `odd` (DECIMAL)
- `mercado` (VARCHAR)
- `resultado` (VARCHAR)
- `valor_resultado` (DECIMAL)
- `observacoes` (TEXT)
- `created_at`, `updated_at` (TIMESTAMPTZ)

---

## 🔒 Políticas RLS Implementadas

### 1. Tabela `profiles`

#### Para Usuários Comuns:
- ✅ **SELECT**: Apenas a própria linha (`id = auth.uid()`)
- ✅ **UPDATE**: Apenas a própria linha, mas **NÃO pode alterar `role`**

#### Para Admins:
- ✅ **SELECT**: Qualquer profile
- ✅ **UPDATE**: Qualquer profile (incluindo `role`)

### 2. Tabela `banca`

#### Para Usuários Comuns:
- ✅ **SELECT**: Apenas onde `user_id = auth.uid()`
- ✅ **INSERT**: Apenas com `user_id = auth.uid()`
- ✅ **UPDATE**: Apenas onde `user_id = auth.uid()`
- ✅ **DELETE**: Apenas onde `user_id = auth.uid()`

#### Para Admins:
- ✅ **SELECT**: Todas as linhas
- ✅ **UPDATE**: Todas as linhas
- ✅ **DELETE**: Todas as linhas

### 3. Tabela `entradas`

#### Para Usuários Comuns:
- ✅ **SELECT**: Apenas onde `user_id = auth.uid()`
- ✅ **INSERT**: Apenas com `user_id = auth.uid()`
- ✅ **UPDATE**: Apenas onde `user_id = auth.uid()`
- ✅ **DELETE**: Apenas onde `user_id = auth.uid()`

#### Para Admins:
- ✅ **SELECT**: Todas as linhas
- ✅ **UPDATE**: Todas as linhas
- ✅ **DELETE**: Todas as linhas

---

## 🧪 Como Testar

### Pré-requisitos
1. Execute a migration `0001_rls_profiles.sql` no Supabase SQL Editor
2. Tenha pelo menos 2 usuários cadastrados no sistema
3. Um dos usuários deve ser promovido a admin (veja seção abaixo)

---

### Teste 1: Usuário Comum Não Acessa Dados de Outro

#### 1.1 Testar SELECT em `profiles`
```sql
-- Faça login como usuário comum (user1@example.com)
-- Tente buscar profile de outro usuário
SELECT * FROM public.profiles WHERE email = 'user2@example.com';

-- Resultado esperado: 0 linhas (não retorna nada)
-- O usuário só vê seu próprio profile
```

#### 1.2 Testar SELECT em `banca`
```sql
-- Faça login como usuário comum (user1@example.com)
-- Tente buscar banca de outro usuário
SELECT * FROM public.banca WHERE user_id != auth.uid();

-- Resultado esperado: 0 linhas (não retorna nada)
-- O usuário só vê sua própria banca
```

#### 1.3 Testar SELECT em `entradas`
```sql
-- Faça login como usuário comum (user1@example.com)
-- Tente buscar entradas de outro usuário
SELECT * FROM public.entradas WHERE user_id != auth.uid();

-- Resultado esperado: 0 linhas (não retorna nada)
-- O usuário só vê suas próprias entradas
```

#### 1.4 Testar UPDATE de `role` (deve falhar)
```sql
-- Faça login como usuário comum (user1@example.com)
-- Tente alterar seu próprio role para admin
UPDATE public.profiles 
SET role = 'admin' 
WHERE id = auth.uid();

-- Resultado esperado: ERRO ou nenhuma linha afetada
-- A política impede que usuários comuns alterem o role
```

---

### Teste 2: Admin Acessa Tudo

#### 2.1 Testar SELECT em `profiles` (admin)
```sql
-- Faça login como admin (admin@example.com)
-- Busque todos os profiles
SELECT * FROM public.profiles;

-- Resultado esperado: Todas as linhas retornadas
-- Admin vê todos os usuários
```

#### 2.2 Testar SELECT em `banca` (admin)
```sql
-- Faça login como admin (admin@example.com)
-- Busque todas as bancas
SELECT * FROM public.banca;

-- Resultado esperado: Todas as linhas retornadas
-- Admin vê todas as bancas
```

#### 2.3 Testar SELECT em `entradas` (admin)
```sql
-- Faça login como admin (admin@example.com)
-- Busque todas as entradas
SELECT * FROM public.entradas;

-- Resultado esperado: Todas as linhas retornadas
-- Admin vê todas as entradas
```

#### 2.4 Testar UPDATE de `role` (admin)
```sql
-- Faça login como admin (admin@example.com)
-- Promova outro usuário a admin
UPDATE public.profiles 
SET role = 'admin' 
WHERE email = 'user2@example.com';

-- Resultado esperado: 1 linha afetada
-- Admin pode alterar roles
```

---

### Teste 3: Promover Usuário a Admin

#### Opção 1: Via SQL Editor (Recomendado)
```sql
-- No Supabase SQL Editor (usa service_role automaticamente)
UPDATE public.profiles 
SET role = 'admin' 
WHERE email = 'duarte.schuck@icloud.com';
```

#### Opção 2: Via Função RPC (Se criada)
```sql
-- Criar função para promover usuário (opcional)
CREATE OR REPLACE FUNCTION public.promote_to_admin(user_email TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE public.profiles 
  SET role = 'admin' 
  WHERE email = user_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Usar a função
SELECT public.promote_to_admin('duarte.schuck@icloud.com');
```

#### Opção 3: Verificar se usuário é admin
```sql
-- Verificar role de um usuário
SELECT id, email, role 
FROM public.profiles 
WHERE email = 'duarte.schuck@icloud.com';

-- Resultado esperado: role = 'admin'
```

---

## 🔧 Funções Auxiliares

### `public.is_admin(user_id UUID)`
Verifica se um usuário tem role `'admin'`.

```sql
-- Exemplo de uso
SELECT public.is_admin(auth.uid());
-- Retorna: true ou false
```

---

## ⚠️ Importante

### Segurança
- ✅ **Nunca use `service_role` key no frontend**
- ✅ Todas as políticas RLS são aplicadas automaticamente
- ✅ Usuários comuns **não podem** alterar seu próprio `role`
- ✅ Apenas admins podem alterar `role` de outros usuários

### Boas Práticas
1. Sempre teste as políticas RLS após criar/modificar
2. Use o SQL Editor do Supabase para promover usuários a admin
3. Monitore logs do Supabase para verificar tentativas de acesso negadas
4. Documente qualquer mudança nas políticas RLS

---

## 📝 Checklist de Verificação

Após executar a migration, verifique:

- [ ] Tabela `profiles` tem coluna `role`
- [ ] Função `public.is_admin()` existe
- [ ] Trigger `on_auth_user_created` está ativo
- [ ] RLS está habilitado em `profiles`, `banca`, `entradas`
- [ ] Políticas RLS estão criadas para todas as operações
- [ ] Usuário comum não acessa dados de outros
- [ ] Admin acessa todos os dados
- [ ] Usuário comum não pode alterar `role`

---

## 🐛 Troubleshooting

### Problema: Usuário não consegue ver seus próprios dados
**Solução:** Verifique se `user_id` está correto e se RLS está habilitado

### Problema: Admin não consegue ver todos os dados
**Solução:** Verifique se o `role` está como `'admin'` (não `'Admin'` ou `'ADMIN'`)

### Problema: Trigger não cria profile automaticamente
**Solução:** Execute manualmente o script de popular usuários existentes

### Problema: Erro ao atualizar role
**Solução:** Certifique-se de estar usando service_role ou sendo admin

---

## 📚 Referências

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL RLS](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)

---

**Última atualização:** Janeiro 2025
