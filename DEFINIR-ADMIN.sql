-- Script para definir usuário como admin
-- Execute este script no Supabase SQL Editor

-- Opção 1: Atualizar por email (RECOMENDADO)
UPDATE public.profiles
SET role = 'admin'
WHERE email = 'duarte.schuck@icloud.com';

-- Opção 2: Atualizar por ID (se a opção 1 não funcionar)
UPDATE public.profiles
SET role = 'admin'
WHERE id = '9405948c-c893-43e5-bd1e-06e38e388bf9';

-- Verificar se foi atualizado
SELECT id, email, role, created_at
FROM public.profiles
WHERE email = 'duarte.schuck@icloud.com';

-- Se ainda não funcionar por causa de RLS, use esta abordagem:
-- Primeiro, verifique se o profile existe:
-- SELECT * FROM public.profiles WHERE email = 'duarte.schuck@icloud.com';

-- Se não existir, crie manualmente:
-- INSERT INTO public.profiles (id, email, role, created_at)
-- SELECT id, email, 'admin', created_at
-- FROM auth.users
-- WHERE email = 'duarte.schuck@icloud.com'
-- ON CONFLICT (id) DO UPDATE SET role = 'admin';
