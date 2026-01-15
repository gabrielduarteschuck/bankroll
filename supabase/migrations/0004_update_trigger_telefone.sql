-- Migration: Atualizar trigger para incluir telefone
-- Data: 2025-01-XX
-- Descrição: Atualiza handle_new_user para salvar telefone dos metadados

-- Atualizar função do trigger para incluir telefone
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_email TEXT;
  user_telefone TEXT;
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
  
  -- Extrai telefone dos metadados (se disponível)
  user_telefone := NEW.raw_user_meta_data->>'telefone';
  
  IF user_telefone IS NULL OR user_telefone = '' THEN
    user_telefone := NEW.raw_app_meta_data->>'telefone';
  END IF;
  
  -- Verifica se já existe profile (para manter role existente)
  SELECT role INTO existing_role
  FROM public.profiles
  WHERE id = NEW.id;
  
  -- Insere ou atualiza profile
  INSERT INTO public.profiles (id, email, telefone, role, created_at)
  VALUES (
    NEW.id, 
    user_email,
    user_telefone, -- Pode ser NULL
    COALESCE(existing_role, 'user'), -- Mantém role existente ou cria como 'user'
    COALESCE(NEW.created_at, NOW())
  )
  ON CONFLICT (id) DO UPDATE 
    SET email = EXCLUDED.email,
        telefone = COALESCE(EXCLUDED.telefone, public.profiles.telefone), -- Atualiza telefone se fornecido
        updated_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentário atualizado
COMMENT ON FUNCTION public.handle_new_user() IS 
  'Trigger function para criar/atualizar profile automaticamente. Inclui email e telefone dos metadados.';
