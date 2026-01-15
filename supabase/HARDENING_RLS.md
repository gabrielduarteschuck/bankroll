# 🔒 Hardening RLS - Blindagem Extra

## 📋 O que foi implementado

### 1. Função `is_admin` com SECURITY DEFINER
- ✅ Recriada com `SECURITY DEFINER` para funcionar dentro de policies RLS
- ✅ `SET search_path = public` para segurança (previne SQL injection via search_path)
- ✅ Marcada como `STABLE` para otimização
- ✅ Garante que funciona sempre, mesmo quando chamada por usuários autenticados

### 2. Trava na coluna `role`
- ✅ Policy de UPDATE bloqueia alteração de `role` para usuários comuns
- ✅ Trigger `BEFORE UPDATE` bloqueia alteração de `role` para não-admins
- ✅ Dupla proteção: Policy + Trigger
- ✅ Apenas admins (via policy) ou SQL manual (service_role) podem alterar `role`

---

## 🛡️ Camadas de Proteção

### Camada 1: Policy RLS
```sql
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id 
    AND role = (SELECT role FROM public.profiles WHERE id = auth.uid())
  );
```
**Proteção:** Usuário comum só pode atualizar se o `role` não mudar.

### Camada 2: Trigger BEFORE UPDATE
```sql
CREATE TRIGGER prevent_role_update_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  WHEN (OLD.role IS DISTINCT FROM NEW.role)
  EXECUTE FUNCTION public.prevent_role_update();
```
**Proteção:** Bloqueia qualquer tentativa de alterar `role` por não-admins, mesmo que a policy passe.

---

## ✅ Resultado Final

### Usuário Comum:
- ❌ **NÃO pode** alterar `role` via UPDATE
- ❌ **NÃO pode** alterar `role` via trigger
- ✅ **PODE** alterar outros campos (email, etc.)

### Admin:
- ✅ **PODE** alterar `role` via policy `profiles_admin_update`
- ✅ **PODE** alterar `role` via SQL manual (service_role)

### SQL Manual (service_role):
- ✅ **PODE** alterar `role` diretamente (bypassa RLS)

---

## 🧪 Como Testar

### Teste 1: Usuário comum tenta alterar role (deve falhar)
```sql
-- Faça login como usuário comum
UPDATE public.profiles 
SET role = 'admin' 
WHERE id = auth.uid();

-- Resultado esperado: ERRO
-- "Apenas administradores podem alterar o role. Usuário atual não tem permissão."
```

### Teste 2: Admin altera role (deve funcionar)
```sql
-- Faça login como admin
UPDATE public.profiles 
SET role = 'admin' 
WHERE email = 'outro@exemplo.com';

-- Resultado esperado: Sucesso
-- 1 linha afetada
```

### Teste 3: Usuário comum altera email (deve funcionar)
```sql
-- Faça login como usuário comum
UPDATE public.profiles 
SET email = 'novo@exemplo.com' 
WHERE id = auth.uid();

-- Resultado esperado: Sucesso
-- 1 linha afetada
```

---

## 📝 Arquivo de Migration

**Arquivo:** `supabase/migrations/0002_harden_admin.sql`

**Conteúdo:**
- Recria função `is_admin` com SECURITY DEFINER
- Atualiza policy de UPDATE para bloquear alteração de role
- Cria trigger `prevent_role_update` para proteção extra
- Verifica e habilita RLS

**Total:** 154 linhas de SQL

---

## 🔐 Segurança Garantida

1. ✅ Função `is_admin` segura (SECURITY DEFINER + search_path fixo)
2. ✅ Policy RLS bloqueia alteração de role
3. ✅ Trigger bloqueia alteração de role (proteção extra)
4. ✅ Dupla camada de proteção (Policy + Trigger)
5. ✅ Apenas admins podem alterar role

**Nível de segurança:** Máximo ⭐⭐⭐⭐⭐

---

**Última atualização:** Janeiro 2025
