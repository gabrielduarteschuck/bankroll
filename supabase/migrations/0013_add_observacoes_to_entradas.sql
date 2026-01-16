-- Migration: adicionar coluna observacoes em public.entradas (idempotente)
-- Data: 2026-01-16
-- Objetivo:
-- - permitir salvar uma descrição opcional da entrada

ALTER TABLE public.entradas
ADD COLUMN IF NOT EXISTS observacoes TEXT;

