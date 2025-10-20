
# Prospera Bingo • Boilerplate (Render FIXED)

- `render.yaml` corrigido (Redis é um **service type** dentro de `services`, não uma chave de topo).
- `api/` e `web/` prontos para deploy.
- Metabase configurado como serviço Docker do tipo **web**.

## Deploy
1) Suba este diretório para um repositório GitHub.
2) No Render: **Blueprints → New** → cole a URL do repositório.
3) Apply. O Render criará Postgres, Redis, API, Web e Metabase.
4) Abra o serviço **prospera-bingo-web** e teste.

## Observações
- Em `prospera-bingo-web`, as variáveis `NEXT_PUBLIC_API_BASE` e `NEXT_PUBLIC_WS_BASE` recebem a **URL** da API via `fromService.property=url`.
- Depois você pode plugar Prisma + Postgres seguindo o schema que já tem.

