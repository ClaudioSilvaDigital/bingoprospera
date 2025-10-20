
# Prospera Bingo • Blueprint FIXED4 (mínimo confiável)

Este blueprint cria **API**, **WEB** e **Postgres** — nada além — para evitar erros de schema.
Depois você pode criar **Redis** e **Metabase** manualmente pelo painel, sem YAML.

## Passos
1) Suba este repositório no GitHub (substitua o `render.yaml` antigo).
2) No Render → Blueprints → New → cole a URL.
3) Apply. Deve criar os 3 recursos sem erro.
4) Abra o serviço web e teste criar uma sessão.

### Depois (opcional, pelo painel)
- **Redis:** New → Redis → Create (copie a connection string para `REDIS_URL` da API).
- **Metabase:** New → Web Service → "Deploy an existing image" → `metabase/metabase:latest`.
