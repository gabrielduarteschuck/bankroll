# 🔐 Como Acessar o Painel Admin

## Passo 1: Configurar seu email como admin

Abra o arquivo `.env.local` na raiz do projeto e adicione/edite a linha `ADMIN_EMAILS`:

```env
ADMIN_EMAILS=seu-email@exemplo.com
```

**Importante:** Use o **mesmo email** que você usa para fazer login!

**Exemplo:**
```env
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-chave-aqui
ADMIN_EMAILS=gabriel@exemplo.com
```

**Para múltiplos admins:**
```env
ADMIN_EMAILS=admin1@exemplo.com,admin2@exemplo.com,admin3@exemplo.com
```

---

## Passo 2: Reiniciar o servidor

Após editar o `.env.local`, **pare e reinicie** o servidor:

```bash
# Pare o servidor (Ctrl+C)
# Depois inicie novamente:
npm run dev
```

⚠️ **Importante:** O servidor precisa ser reiniciado para carregar as novas variáveis de ambiente!

---

## Passo 3: Acessar o painel admin

1. Faça login normalmente em `http://localhost:3000/login`
2. Acesse `http://localhost:3000/admin`
3. ✅ Se seu email está em `ADMIN_EMAILS`, você verá a lista de usuários
4. ❌ Se não está, será redirecionado para `/dashboard`

---

## 🔍 Verificar se está funcionando

### Se você vê a lista de usuários:
✅ **Funcionando!** Você tem acesso de admin.

### Se é redirecionado para `/dashboard`:
❌ **Problema:** Seu email não está em `ADMIN_EMAILS` ou o servidor não foi reiniciado.

**Soluções:**
1. Verifique se o email no `.env.local` é **exatamente** o mesmo que você usa para login
2. Verifique se não há espaços extras no email
3. Reinicie o servidor completamente
4. Limpe o cache do navegador e tente novamente

---

## 📝 Exemplo Completo de `.env.local`

```env
NEXT_PUBLIC_SUPABASE_URL=https://abcdefghijklmnop.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
ADMIN_EMAILS=gabriel@exemplo.com
```

---

## 🎯 Resumo Rápido

1. ✅ Adicione `ADMIN_EMAILS=seu-email@exemplo.com` no `.env.local`
2. ✅ Reinicie o servidor (`npm run dev`)
3. ✅ Acesse `http://localhost:3000/admin`

Pronto! 🎉
