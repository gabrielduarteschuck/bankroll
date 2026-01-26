-- Migration: Corrigir trigger handle_new_user
-- Data: 2026-01-25
-- Problema: Email não estava sendo capturado corretamente (usar NEW.email diretamente)

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_email TEXT;
  user_telefone TEXT;
BEGIN
  -- PRIMEIRO tenta NEW.email (onde Supabase Auth armazena o email)
  user_email := NEW.email;

  -- Fallback para metadados se NEW.email estiver vazio
  IF user_email IS NULL OR user_email = '' THEN
    user_email := NEW.raw_user_meta_data->>'email';
  END IF;

  IF user_email IS NULL OR user_email = '' THEN
    user_email := NEW.raw_app_meta_data->>'email';
  END IF;

  -- Extrai telefone dos metadados (se disponível)
  user_telefone := NEW.raw_user_meta_data->>'telefone';

  IF user_telefone IS NULL OR user_telefone = '' THEN
    user_telefone := NEW.raw_app_meta_data->>'telefone';
  END IF;

  -- Insere profile
  INSERT INTO public.profiles (id, email, telefone, role, created_at)
  VALUES (
    NEW.id,
    user_email,
    user_telefone,
    'user',
    NEW.created_at
  )
  ON CONFLICT (id) DO UPDATE
    SET
      email = EXCLUDED.email,
      telefone = COALESCE(EXCLUDED.telefone, public.profiles.telefone),
      updated_at = NOW();

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Erro ao criar profile para usuário %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- Recriar trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
