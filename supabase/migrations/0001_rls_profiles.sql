-- Migration: RLS e Controle de Admin por Role
-- Data: 2025-01-XX
-- Descrição: Implementa Row Level Security (RLS) completo com controle de admin por role

-- ============================================================================
-- 1. TABELA PROFILES COM ROLE
-- ============================================================================

-- Criar tabela profiles se não existir
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Adicionar coluna role se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'role'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN role TEXT NOT NULL DEFAULT 'user';
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('user', 'admin'));
  END IF;
END $$;

-- Garantir que email existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'email'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN email TEXT NOT NULL DEFAULT 'sem-email@exemplo.com';
  END IF;
END $$;

-- Criar índices
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- ============================================================================
-- 2. FUNÇÃO AUXILIAR: Verificar se usuário é admin
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = user_id AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 3. TRIGGER: Criar/Atualizar profile automaticamente
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_email TEXT;
  existing_role TEXT;
BEGIN
  -- Extrai email do JSON metadata
  user_email := NEW.raw_user_meta_data->>'email';
  
  IF user_email IS NULL OR user_email = '' THEN
    user_email := NEW.raw_app_meta_data->>'email';
  END IF;
  
  IF user_email IS NULL OR user_email = '' THEN
    user_email := 'sem-email@exemplo.com';
  END IF;
  
  -- Verifica se já existe profile (para manter role existente)
  SELECT role INTO existing_role
  FROM public.profiles
  WHERE id = NEW.id;
  
  -- Insere ou atualiza profile
  INSERT INTO public.profiles (id, email, role, created_at)
  VALUES (
    NEW.id, 
    user_email, 
    COALESCE(existing_role, 'user'), -- Mantém role existente ou cria como 'user'
    COALESCE(NEW.created_at, NOW())
  )
  ON CONFLICT (id) DO UPDATE 
    SET email = EXCLUDED.email,
        updated_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar trigger se não existir
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Popular usuários existentes que não têm profile
DO $$
DECLARE
  user_record RECORD;
  user_email TEXT;
BEGIN
  FOR user_record IN 
    SELECT 
      id,
      raw_user_meta_data,
      raw_app_meta_data,
      created_at
    FROM auth.users
    WHERE id NOT IN (SELECT id FROM public.profiles WHERE id IS NOT NULL)
  LOOP
    user_email := COALESCE(
      user_record.raw_user_meta_data->>'email',
      user_record.raw_app_meta_data->>'email',
      'sem-email@exemplo.com'
    );
    
    INSERT INTO public.profiles (id, email, role, created_at)
    VALUES (
      user_record.id, 
      user_email, 
      'user', -- Usuários existentes começam como 'user'
      COALESCE(user_record.created_at, NOW())
    )
    ON CONFLICT (id) DO NOTHING;
  END LOOP;
END $$;

-- ============================================================================
-- 4. RLS NA TABELA PROFILES
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_all_for_admins" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin_all" ON public.profiles;

-- Policy a) Usuário autenticado pode SELECT apenas a própria linha
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Policy b) Usuário autenticado pode UPDATE apenas a própria linha, mas NÃO pode alterar role
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id 
    AND role = (SELECT role FROM public.profiles WHERE id = auth.uid()) -- Não permite mudar role
  );

-- Policy c) Admin pode SELECT qualquer profile
CREATE POLICY "profiles_admin_select" ON public.profiles
  FOR SELECT
  USING (public.is_admin(auth.uid()));

-- Policy d) Admin pode UPDATE qualquer profile (incluindo role)
CREATE POLICY "profiles_admin_update" ON public.profiles
  FOR UPDATE
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- ============================================================================
-- 5. TABELA BANCA - RLS COMPLETO
-- ============================================================================

-- Garantir que user_id existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'banca' 
    AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.banca ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Habilitar RLS
ALTER TABLE public.banca ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas
DROP POLICY IF EXISTS "banca_select" ON public.banca;
DROP POLICY IF EXISTS "banca_insert" ON public.banca;
DROP POLICY IF EXISTS "banca_update" ON public.banca;
DROP POLICY IF EXISTS "banca_delete" ON public.banca;
DROP POLICY IF EXISTS "banca_admin_select" ON public.banca;
DROP POLICY IF EXISTS "banca_admin_update" ON public.banca;
DROP POLICY IF EXISTS "banca_admin_delete" ON public.banca;

-- Policies para usuários comuns
CREATE POLICY "banca_select" ON public.banca
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "banca_insert" ON public.banca
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "banca_update" ON public.banca
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "banca_delete" ON public.banca
  FOR DELETE
  USING (auth.uid() = user_id);

-- Policies para admins
CREATE POLICY "banca_admin_select" ON public.banca
  FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "banca_admin_update" ON public.banca
  FOR UPDATE
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "banca_admin_delete" ON public.banca
  FOR DELETE
  USING (public.is_admin(auth.uid()));

-- ============================================================================
-- 6. TABELA ENTRADAS - RLS COMPLETO
-- ============================================================================

-- Garantir que user_id existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'entradas' 
    AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.entradas ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Habilitar RLS
ALTER TABLE public.entradas ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas
DROP POLICY IF EXISTS "entradas_select" ON public.entradas;
DROP POLICY IF EXISTS "entradas_insert" ON public.entradas;
DROP POLICY IF EXISTS "entradas_update" ON public.entradas;
DROP POLICY IF EXISTS "entradas_delete" ON public.entradas;
DROP POLICY IF EXISTS "entradas_admin_select" ON public.entradas;
DROP POLICY IF EXISTS "entradas_admin_update" ON public.entradas;
DROP POLICY IF EXISTS "entradas_admin_delete" ON public.entradas;

-- Policies para usuários comuns
CREATE POLICY "entradas_select" ON public.entradas
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "entradas_insert" ON public.entradas
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "entradas_update" ON public.entradas
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "entradas_delete" ON public.entradas
  FOR DELETE
  USING (auth.uid() = user_id);

-- Policies para admins
CREATE POLICY "entradas_admin_select" ON public.entradas
  FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "entradas_admin_update" ON public.entradas
  FOR UPDATE
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "entradas_admin_delete" ON public.entradas
  FOR DELETE
  USING (public.is_admin(auth.uid()));

-- ============================================================================
-- 7. COMENTÁRIOS E DOCUMENTAÇÃO
-- ============================================================================

COMMENT ON TABLE public.profiles IS 'Perfis de usuários com controle de role (user/admin)';
COMMENT ON COLUMN public.profiles.role IS 'Role do usuário: user (padrão) ou admin';
COMMENT ON FUNCTION public.is_admin(UUID) IS 'Verifica se um usuário tem role admin';
COMMENT ON FUNCTION public.handle_new_user() IS 'Trigger function para criar/atualizar profile automaticamente';
