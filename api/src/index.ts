import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from './db.js';

const app = express();
app.use(cors());
app.use(express.json());

// ---------------------------------------------------------------------
// Helpers: sorteio, validação de bingo por regra (1-linha, 2-linhas, cheia)
// ---------------------------------------------------------------------
const uid = (n = 6) => crypto.randomBytes(n).toString('base64url').slice(0, n);
const keyRC = (r: number, c: number) => `${r},${c}`;

function countCompletedLines(layout: string[][], marks: Array<[number, number]>) {
  const R = layout.length;
  const C = layout[0]?.length || 0;
  if (!R || !C) return 0;
  const set = new Set(marks.map(([r, c]) => `${r},${c}`));
  let lines = 0;

  // Linhas
  for (let r = 0; r < R; r++) {
    let ok = true;
    for (let c = 0; c < C; c++) {
      if (!set.has(`${r},${c}`)) { ok = false; break; }
    }
    if (ok) lines++;
  }

  // Colunas
  for (let c = 0; c < C; c++) {
    let ok = true;
    for (let r = 0; r < R; r++) {
      if (!set.has(`${r},${c}`)) { ok = false; break; }
    }
    if (ok) lines++;
  }

  // Diagonais
  {
    let ok = true;
    for (let i = 0; i < Math.min(R, C); i++) {
      if (!set.has(`${i},${i}`)) { ok = false; break; }
    }
    if (ok) lines++;
  }
  {
    let ok = true;
    for (let i = 0; i < Math.min(R, C); i++) {
      if (!set.has(`${i},${C - 1 - i}`)) { ok = false; break; }
    }
    if (ok) lines++;
  }

  return lines;
}

function serverCheckByRule(
  layout: string[][],
  marks: Array<[number, number]>,
  rule: '1-linha' | '2-linhas' | '3-linhas' | 'cheia'
) {
  const lines = countCompletedLines(layout, marks);
  if (rule === '1-linha')  return lines >= 1 ? 'valid' : 'invalid';
  if (rule === '2-linhas') return lines >= 2 ? 'valid' : 'invalid';
  if (rule === '3-linhas') return lines >= 3 ? 'valid' : 'invalid';

  if (rule === 'cheia') {
    const total = layout.length * (layout[0]?.length || 0);
    return marks.length >= total ? 'valid' : 'invalid';
  }

  return 'invalid';
}



// ---------------------------------------------------------------------
// Estado em memória
// ---------------------------------------------------------------------
type Session = {
  id: string;
  rows: number;
  cols: number;
  win: Array<'row' | 'col' | 'diag'>;
  terms: string[];
  draws: { index: number; text: string; drawnAt: number }[];
  players: { id: string; name: string; layout: string[][] }[];
};
const SESS: Record<string, Session> = {};

type RoundMem = { number: number; rule: '1-linha' | '2-linhas' | '3-linhas' | 'cheia' };
const ACTIVE_ROUND: Record<string, RoundMem> = {};

// Pool de palavras
const WORDS = [
  'Pertencimento','Orgulho','Colaboração','Metas','Soul Up','Comunicação',
  'Reconhecimento','Time','Token','Respeito','Ajudar','Sprint',
  'Solução','Aprendizado','Feedback','Proatividade','Compartilhar',
  'Superamos','Celebramos','Decisão','Fantasma','Bruxa','Vassoura',
  'Doces','Caveira','Energia Verde','Feitiço','Motivação','Energia','Empolgação',
  'Alegria','Confiança','Compromisso','Cuidado','Crescer','Segurança',
  'Equipe','Governança','Equidade','Conexão','Conteúdo','Gamificação',
  'Vale Energia','Roadmap','Web 3','Crescimento','Feriado','Pipeline',
  'Compliance','Sucesso','Pausa','Objetivo','Orçamento','Prosperar',
  'Conhecimento','Celebração','Planejamento','Sprint','OKR',
  'Transparência','Honestidade','Foco','Alinhamento','Prioridade',
  'Inovação','Sustentável','Propósito','Inspiração','Criatividade',
  'Resultado','Evolução','Pontos Ecoa','Valorização','Eficiência','Transformação'
];

function makeBoard(rows: number, cols: number, terms: string[]): string[][] {
  const arr = [...terms];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  const need = rows * cols;
  const pick = arr.slice(0, need);
  const grid: string[][] = [];
  for (let r = 0; r < rows; r++) grid.push(pick.slice(r * cols, (r + 1) * cols));
  return grid;
}

// ---------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------
app.get('/', (_req, res) => {
  res.send('Prospera Bingo API: OK');
});

// ---------------------------------------------------------------------
// Rotas principais
// ---------------------------------------------------------------------

// Cria sessão
app.post('/sessions', async (req, res) => {
  const schema = z.object({
    gridRows: z.number().int().min(3).max(12),
    gridCols: z.number().int().min(3).max(12),
    winConditions: z.array(z.enum(['row', 'col', 'diag'])).default(['row', 'col'])
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error);

  const id = uid(6).toUpperCase();
  const rows = parsed.data.gridRows;
  const cols = parsed.data.gridCols;
  const win = parsed.data.winConditions as Array<'row' | 'col' | 'diag'>;

  SESS[id] = {
    id, rows, cols, win,
    terms: [...WORDS],
    draws: [],
    players: []
  };

  // Rodada #1 padrão
  ACTIVE_ROUND[id] = { number: 1, rule: '1-linha' };
  await prisma.round.create({
    data: { sessionId: id, number: 1, rule: '1-linha', isActive: true }
  });

  res.status(201).json({ id });
});

// Sorteia próximo termo
app.post('/sessions/:id/draw/next', (req, res) => {
  const s = SESS[req.params.id];
  if (!s) return res.status(404).json({ error: 'not found' });
  const already = new Set(s.draws.map(d => d.text));
  const next = s.terms.find(t => !already.has(t));
  if (!next) return res.status(400).json({ error: 'no-more-terms' });
  s.draws.push({ index: s.draws.length, text: next, drawnAt: Date.now() });
  res.json({ text: next, total: s.draws.length });
});

// Jogador entra (gera cartela)
app.post('/sessions/:id/players', (req, res) => {
  const s = SESS[req.params.id];
  if (!s) return res.status(404).json({ error: 'not found' });

  const schema = z.object({ displayName: z.string().min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error);

  const pid = uid(6).toUpperCase();
  const layout = makeBoard(s.rows, s.cols, s.terms);
  s.players.push({ id: pid, name: parsed.data.displayName, layout });

  res.json({ playerId: pid, layout, gridRows: s.rows, gridCols: s.cols });
});

// Estado da sessão (player/admin)
app.get('/sessions/:id/state', (req, res) => {
  const s = SESS[req.params.id];
  if (!s) return res.status(404).json({ error: 'not found' });
  res.json({ id: s.id, rows: s.rows, cols: s.cols, win: s.win, draws: s.draws, termsCount: s.terms.length });
});

// Rodada ativa (admin/jogador)
app.get('/sessions/:id/round', async (req, res) => {
  const s = SESS[req.params.id];
  if (!s) return res.status(404).json({ error: 'not found' });

  let m = ACTIVE_ROUND[req.params.id];
  if (!m) {
    const r = await prisma.round.findFirst({
      where: { sessionId: req.params.id, isActive: true },
      orderBy: { number: 'desc' }
    });
    if (r) {
      m = ACTIVE_ROUND[req.params.id] = { number: r.number, rule: r.rule as any };
    } else {
      m = ACTIVE_ROUND[req.params.id] = { number: 1, rule: '1-linha' };
      await prisma.round.create({
        data: { sessionId: req.params.id, number: 1, rule: '1-linha', isActive: true }
      });
    }
  }
  return res.json(m);
});

// Inicia nova rodada
app.post('/sessions/:id/round/start', async (req, res) => {
  const s = SESS[req.params.id];
  if (!s) return res.status(404).json({ error: 'not found' });

  // /round/start
const schema = z.object({
  rule: z.enum(['1-linha','2-linhas','3-linhas','cheia']).default('1-linha'),
});

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error);

  const current = await prisma.round.findFirst({
    where: { sessionId: req.params.id, isActive: true },
    orderBy: { number: 'desc' }
  });
  const nextNum = (current?.number ?? 0) + 1;

  if (current) {
    await prisma.round.update({
      where: { sessionId_number: { sessionId: req.params.id, number: current.number } },
      data: { isActive: false, endedAt: new Date() }
    });
  }

  const created = await prisma.round.create({
    data: {
      sessionId: req.params.id,
      number: nextNum,
      rule: parsed.data.rule,
      isActive: true
    }
  });

  ACTIVE_ROUND[req.params.id] = { number: created.number, rule: created.rule as any };
  return res.status(201).json(ACTIVE_ROUND[req.params.id]);
});

// Altera regra da rodada ativa
app.post('/sessions/:id/round/rule', async (req, res) => {
  const s = SESS[req.params.id];
  if (!s) return res.status(404).json({ error: 'not found' });

  // /round/rule
const schema = z.object({
  rule: z.enum(['1-linha','2-linhas','3-linhas','cheia']),
});

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error);

  const r = await prisma.round.findFirst({
    where: { sessionId: req.params.id, isActive: true },
    orderBy: { number: 'desc' }
  });
  if (!r) return res.status(404).json({ error: 'no-active-round' });

  const updated = await prisma.round.update({
    where: { sessionId_number: { sessionId: req.params.id, number: r.number } },
    data: { rule: parsed.data.rule }
  });

  ACTIVE_ROUND[req.params.id] = { number: updated.number, rule: updated.rule as any };
  return res.json(ACTIVE_ROUND[req.params.id]);
});

// Declaração de bingo (claim) com informação da rodada
app.post('/sessions/:id/claim', async (req, res) => {
  const s = SESS[req.params.id];
  if (!s) return res.status(404).json({ error: 'not found' });

  const schema = z.object({
    playerId: z.string().min(1),
    playerName: z.string().min(1),
    layout: z.array(z.array(z.string())),
    marks: z.array(z.tuple([z.number().int(), z.number().int()])),
    clientHasBingo: z.boolean()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error);

  const { playerId, playerName, layout, marks, clientHasBingo } = parsed.data;

  // Rodada ativa
  let current = ACTIVE_ROUND[s.id] as { number: number; rule: '1-linha' | '2-linhas' | '3-linhas' | 'cheia' } | undefined;
  if (!current) {
    const r = await prisma.round.findFirst({
      where: { sessionId: s.id, isActive: true },
      orderBy: { number: 'desc' }
    });
    if (r) {
      current = ACTIVE_ROUND[s.id] = { number: r.number, rule: r.rule as any };
    } else {
      current = ACTIVE_ROUND[s.id] = { number: 1, rule: '1-linha' };
      await prisma.round.create({
        data: { sessionId: s.id, number: 1, rule: '1-linha', isActive: true }
      });
    }
  }

  const roundNumber = current.number;
  const roundRule = current.rule;
  const verdict = serverCheckByRule(layout, marks, roundRule); // 'valid' | 'invalid'

  try {
    await prisma.claim.create({
      data: {
        id: uid(8),
        sessionId: s.id,
        playerId,
        playerName,
        layout: layout as any,
        marks: marks as any,
        clientHasBingo,
        serverCheck: verdict,
        declaredAt: new Date(),
        roundNumber,
        roundRule
      }
    });
    return res.status(201).json({ status: 'received', serverCheck: verdict, roundNumber, roundRule });
  } catch (e: any) {
    console.error('claim save error', e);
    return res.status(500).json({ error: 'persist_fail' });
  }
});

// Lista claims (opcional ?round=NUM)
app.get('/sessions/:id/claims', async (req, res) => {
  try {
    const roundParam = req.query.round ? Number(req.query.round) : undefined;
    const rows = await prisma.claim.findMany({
      where: { sessionId: req.params.id, ...(roundParam ? { roundNumber: roundParam } : {}) },
      orderBy: { declaredAt: 'asc' }
    });

    // ============================================================
// GET /sessions/:id/stats
// Estatísticas consolidadas da sessão:
// - winnersByRound: vencedores por rodada (primeira claim 'valid' por player/round)
// - leaderboard: ranking geral por jogador (#vitórias)
// - totals: contagens diversas
// Aceita ?round=N para focar só em uma rodada.
// ============================================================
app.get('/sessions/:id/stats', async (req, res) => {
  try {
    const sessionId = req.params.id;
    const roundParam = req.query.round ? Number(req.query.round) : undefined;

    // Busca claims válidas da sessão (opcionalmente filtradas por rodada)
    const rows = await prisma.claim.findMany({
      where: {
        sessionId,
        serverCheck: 'valid',
        ...(roundParam ? { roundNumber: roundParam } : {}),
      },
      orderBy: { declaredAt: 'asc' },
    });

    // winnersByRound: só a PRIMEIRA claim válida de cada player em cada rodada
    const seen = new Set<string>(); // `${roundNumber}:${playerId}`
    const winnersByRound: Record<number, Array<{
      playerId: string;
      playerName: string;
      declaredAt: number;
      roundRule: string | null;
    }>> = {};

    for (const r of rows) {
      const key = `${r.roundNumber}:${r.playerId}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const item = {
        playerId: r.playerId,
        playerName: r.playerName,
        declaredAt: new Date(r.declaredAt).getTime(),
        roundRule: r.roundRule,
      };
      const rn = r.roundNumber ?? 0;
      (winnersByRound[rn] ||= []).push(item);
    }

    // leaderboard: total de vitórias por jogador (contando chaves únicas acima)
    const winCountByPlayer = new Map<string, { playerId: string; playerName: string; wins: number }>();
    for (const rn of Object.keys(winnersByRound)) {
      for (const w of winnersByRound[Number(rn)]) {
        const cur = winCountByPlayer.get(w.playerId) || { playerId: w.playerId, playerName: w.playerName, wins: 0 };
        cur.wins += 1;
        winCountByPlayer.set(w.playerId, cur);
      }
    }
    const leaderboard = Array.from(winCountByPlayer.values())
      .sort((a, b) => b.wins - a.wins || a.playerName.localeCompare(b.playerName));

    // totals
    const totals = {
      roundsCount: Object.keys(winnersByRound).length,
      uniquePlayersWithWin: leaderboard.length,
      validClaims: rows.length,
    };

    return res.json({ totals, winnersByRound, leaderboard });
  } catch (e: any) {
    console.error('stats error', e);
    return res.status(500).json({ error: 'stats_fail' });
  }
});

    const claims = rows.map(r => ({
      id: r.id,
      sessionId: r.sessionId,
      playerId: r.playerId,
      playerName: r.playerName,
      layout: r.layout as any,
      marks: r.marks as any,
      clientHasBingo: r.clientHasBingo,
      serverCheck: r.serverCheck as 'valid' | 'invalid' | 'unknown',
      declaredAt: new Date(r.declaredAt).getTime(),
      roundNumber: r.roundNumber,
      roundRule: r.roundRule
    }));

    return res.json({ count: claims.length, claims });
  } catch (e: any) {
    console.error('claim list error', e);
    return res.status(500).json({ error: 'list_fail' });
  }
});

// ---------------------------------------------------------------------
// Listen
// ---------------------------------------------------------------------
const PORT = process.env.PORT ? Number(process.env.PORT) : 10000;
app.listen(PORT, () => {
  console.log(`API listening on :${PORT}`);
});
