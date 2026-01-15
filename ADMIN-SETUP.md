# Configuração do Painel Admin

## 1. Criar Tabela Profiles e Trigger

Execute no Supabase SQL Editor:
1. `SOLUCAO-DEFINITIVA-PROFILES.sql` - Cria a tabela profiles, trigger automático e popula usuários existentes
2. `CRIAR-PROFILES-ADMIN-POLICY.sql` - Cria política RLS para admins verem todos os perfis

## 2. Configurar Whitelist de Admins

Adicione a variável de ambiente `ADMIN_EMAILS` no seu arquivo `.env.local`:

```env
ADMIN_EMAILS=admin1@example.com,admin2@example.com,admin3@example.com
```

Os emails devem estar separados por vírgula (sem espaços ou com espaços que serão removidos automaticamente).

## 3. Como Funciona

- **Middleware**: Protege `/admin` verificando se o usuário está logado E se o email está na whitelist
- **Tabela Profiles**: Espelha os usuários do `auth.users` automaticamente via trigger
- **RLS**: Política permite que usuários autenticados vejam todos os perfis (apenas para desenvolvimento)
- **Redirecionamento**: Usuários não-admin são redirecionados para `/dashboard`

## 4. Segurança

⚠️ **Importante**: A política RLS atual permite que qualquer usuário autenticado veja todos os perfis. Para produção, considere:

1. Usar `service_role` key no backend para buscar perfis
2. Criar uma função RPC que verifica a whitelist de admins
3. Criar uma tabela separada de admins e verificar via função
