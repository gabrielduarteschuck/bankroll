## purge-ai-suggestions (Scheduled)

Apaga todas as linhas de `public.ai_suggestions` (e os votos em `ai_suggestions_votes` via cascade).

### Secrets necessárias

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

### Agendamento (02:00 BRT)

O scheduler do Supabase usa **UTC** na prática.

- 02:00 (America/Sao_Paulo) = 05:00 UTC
- Cron: `0 5 * * *`

### Teste manual

Depois de deployar, rode a função manualmente pelo painel do Supabase e confira:

```sql
select count(*) from public.ai_suggestions;
```

