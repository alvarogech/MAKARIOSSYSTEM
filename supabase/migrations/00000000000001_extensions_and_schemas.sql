-- Fase 1 — Fundação
-- Extensões necessárias e schema privado (tabelas internas nunca expostas
-- pela API automática do Supabase/PostgREST, que só expõe o schema `public`
-- por padrão).

create extension if not exists pgcrypto;

create schema if not exists private;

comment on schema private is
  'Tabelas e funções internas (jobs, audit_logs, etc.). Nunca exposto pela '
  'API automática do Supabase — acesso exclusivamente via funções '
  'SECURITY DEFINER em public ou pelo client administrativo server-side.';
