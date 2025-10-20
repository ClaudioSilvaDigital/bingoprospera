
# Prospera Bingo • Boilerplate (Render)

- `render.yaml`: cria API, Web, Postgres, Redis e Metabase.
- `api/`: Node + Express + Socket.IO (memória). Pronto para subir e testar sorteio, players e cartelas.
- `web/`: Next.js mínimo para criar sessão e entrar como jogador.

## Uso rápido
1) Suba este repositório no GitHub.
2) No Render: **Blueprint** -> aponte para o repo -> Apply.
3) Abra `prospera-bingo-web` -> `NEXT_PUBLIC_API_BASE` já estará ligado à API.
4) Teste: crie sessão na home, depois abra `/play/{id}`.

### Depois
- Plugar Prisma + Postgres usando o schema que já te entreguei.
- Conectar Metabase ao Postgres e criar dashboards.
