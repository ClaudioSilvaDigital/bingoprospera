
# Prospera Bingo • Boilerplate (Render FIXED3)

Correções aplicadas:
- `fromService.property` agora usa **host** (o Render só aceita: host, hostport, port, connectionString).
- Front-end normaliza `NEXT_PUBLIC_API_BASE`: se vier só o host, ele prefixa `https://` automaticamente (e `ws://`/`wss://` para sockets).
- Redis com `ipAllowList` exigido pelo Render.

## Deploy
1) Suba o repositório no GitHub com este `render.yaml`.
2) No Render → Blueprints → New → cole a URL do repositório → Apply.
3) Abra o serviço **prospera-bingo-web** e teste criar sessão.

**Nota de segurança**: o `ipAllowList` para Redis está aberto (`0.0.0.0/0`) para facilitar o primeiro deploy. Depois, restrinja para os IPs dos seus serviços ou desabilite acesso público e use apenas a **internal connection**.
