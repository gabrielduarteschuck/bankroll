-- SOLUÇÃO DEFINITIVA - Execute este arquivo completo
-- Este script cria tudo de forma segura, verificando se já existe

-- 1. Criar tabela (se não existir)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Garantir que a coluna email existe (caso a tabela já existia sem ela)
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

-- 3. Criar índice
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- 4. Habilitar RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 5. Política RLS (apenas para profiles, não mexe com banca)
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles 
  FOR SELECT 
  USING (auth.uid() = id);

-- 6. Função do trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_email TEXT;
BEGIN
  user_email := NEW.raw_user_meta_data->>'email';
  
  IF user_email IS NULL OR user_email = '' THEN
    user_email := NEW.raw_app_meta_data->>'email';
  END IF;
  
  IF user_email IS NULL OR user_email = '' THEN
    user_email := 'sem-email@exemplo.com';
  END IF;
  
  INSERT INTO public.profiles (id, email, created_at)
  VALUES (NEW.id, user_email, COALESCE(NEW.created_at, NOW()))
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Criar trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 8. Popular usuários existentes (usando abordagem mais segura)
DO $$
DECLARE
  user_record RECORD;
  user_email TEXT;
  profiles_count INTEGER;
BEGIN
  -- Verifica se a tabela existe
  SELECT COUNT(*) INTO profiles_count
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'profiles';
  
  IF profiles_count = 0 THEN
    RAISE EXCEPTION 'Tabela profiles não existe. Execute as partes anteriores do script primeiro.';
  END IF;

  -- Verifica se a coluna email existe
  SELECT COUNT(*) INTO profiles_count
  FROM information_schema.columns
  WHERE table_schema = 'public' 
  AND table_name = 'profiles' 
  AND column_name = 'email';
  
  IF profiles_count = 0 THEN
    RAISE EXCEPTION 'Coluna email não existe na tabela profiles.';
  END IF;

  -- Insere usuários existentes
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
    
    INSERT INTO public.profiles (id, email, created_at)
    VALUES (
      user_record.id, 
      user_email, 
      COALESCE(user_record.created_at, NOW())
    )
    ON CONFLICT (id) DO NOTHING;
  END LOOP;
END $$;
