# STEP B — Persistir Declarações (Claims) com Prisma + Postgres (Render)

Este pacote adiciona **Prisma** à API e persiste as **declarações de bingo** em Postgres.
As sessões, sorteios e cartelas continuam em memória por enquanto.

## 1) Adicionar arquivos ao repo
- Copie **api/prisma/** para dentro do seu repo.
- Copie **api/src/db.ts** para o seu repo.

## 2) Ajustar `api/package.json`
No `api/package.json`, adicione:
- `dependencies`: `@prisma/client`
- `devDependencies`: `prisma`
- `scripts.postinstall`: `"prisma generate"` (opcional)

Exemplo mínimo:
{
  "dependencies": {
    "@prisma/client": "^5.19.1"
  },
  "devDependencies": {
    "prisma": "^5.19.1"
  },
  "scripts": {
    "postinstall": "prisma generate"
  }
}

## 3) Build Command da API no Render
```
npm install --no-audit --no-fund --include=dev && npx prisma generate && npm run build
```

## 4) Start Command da API no Render
```
npx prisma migrate deploy && node dist/index.js
```

## 5) Patch nas rotas
No `api/src/index.ts`, importe `prisma` e troque os trechos de gravação/listagem de claims para usar as funções do arquivo **api/src/index.prisma.patch.txt**.

## 6) Deploy
- Commit no GitHub.
- Render → API → Manual Deploy → Clear build cache & deploy.

## 7) Teste
- Jogador declara bingo.
- Abra `/#/admin/{SESSION_ID}` → a declaração permanece mesmo após reiniciar a API.