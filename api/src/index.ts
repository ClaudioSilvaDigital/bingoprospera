import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from './db';

const app = express();
app.use(cors());
app.use(express.json());

// Health
app.get('/', (_req, res) => {
  res.send('Prospera Bingo API: OK');
});

// === util ===
const uid = (n = 6) => crypto.randomBytes(n).toString('base64url').slice(0, n);
const keyRC = (r:number,c:number)=>`${r},${c}`;

function hasBingoServer(layout: string[][], marks: Array<[number,number]>): boolean {
  const R = layout.length;
  const C = layout[0]?.length || 0;
  const set = new Set(marks.map(([r,c])=>keyRC(r,c)));
  if (!R || !C) return false;
  // linhas
  for (let r=0;r<R;r++){
    let ok=true; for(let c=0;c<C;c++) if(!set.has(keyRC(r,c))){ ok=false; break; }
    if(ok) return true;
  }
  // colunas
  for (let c=0;c<C;c++){
    let ok=true; for(let r=0;r<R;r++) if(!set.has(keyRC(r,c))){ ok=false; break; }
    if(ok) return true;
  }
  // diagonais
  { let ok=true; for(let i=0;i<Math.min(R,C);i++) if(!set.has(keyRC(i,i))){ ok=false; break; } if(ok) return true; }
  { let ok=true; for(let i=0;i<Math.min(R,C);i++) if(!set.has(keyRC(i,C-1-i))){ ok=false; break; } if(ok) return true; }
  return false;
}

// ====== Estado em memória (sessions, draws, players) ======
type Session = {
  id: string;
  rows: number;
  cols: number;
  win: Array<'row'|'col'|'diag'>;
  terms: string[]; // pool total
  draws: { index: number; text: string; drawnAt: number }[];
  players: { id:string; name:string; layout:string[][] }[];
};
const SESS: Record<string, Session> = {};

// pool simples (você pode trocar pelo seu dicionário)
const WORDS = [
  'Pertencimento','Orgulho','Colaboração','Metas','Soul Up','Comunicação',
  'Reconhecimento','Time','Transparência','Respeito','Ajudei','Sprint',
  'Solução','Aprendizado','Feedback','Proatividade','Compartilhar',
  'Superamos','Celebramos','Decisão','Fantasma','Bruxa','Vassoura',
  'Doces','Caveira','Múmia','Feitiço','Motivação','Energia','Empolgação',
  'Alegria','Confiança','Compromisso','Cuidado','Crescer','Segurança',
  'Equipe','Governança','Equidade','Conexão','Conteúdo','Gamificação',
  'Vale Energia','Roadmap','Web 3','Crescimento','Feriado','Pipeline',
  'Compliance','Sucesso','Pausa','Objetivo','Orçamento','Prosperar',
  'Conhecimento','celebração','Planejamento','Sprint entregue','OKR',
  'Transparência','Honestidade','Foco','Alinhamento','Prioridade'
];

// util para gerar cartela (embaralha e preenche RxC)
function makeBoard(rows:number, cols:number, terms:string[]): string[][] {
  const arr = [...terms];
  for (let i=arr.length-1;i>0;i--) { const j=Math.floor(Math.random()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]]; }
  const need = rows*cols;
  const pick = arr.slice(0, need);
  const grid: string[][] = [];
  for (let r=0;r<rows;r++) grid.push(pick.slice(r*cols,(r+1)*cols));
  return grid;
}

// ====== Rotas ======

// cria sessão
app.post('/sessions', (req, res) => {
  const schema = z.object({
    gridRows: z.number().int().min(3).max(12),
    gridCols: z.number().int().min(3).max(12),
    winConditions: z.array(z.enum(['row','col','diag'])).default(['row','col'])
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error);

  const id = uid(6).toUpperCase();
  const rows = parsed.data.gridRows;
  const cols = parsed.data.gridCols;
  const win = parsed.data.winConditions as Array<'row'|'col'|'diag'>;

  SESS[id] = {
    id, rows, cols, win,
    terms: [...WORDS],
    draws: [],
    players: []
  };
  res.status(201).json({ id });
});

// sortear próximo
app.post('/sessions/:id/draw/next', (req,res)=>{
  const s = SESS[req.params.id]; if(!s) return res.status(404).json({error:'not found'});
  const already = new Set(s.draws.map(d=>d.text));
  const next = s.terms.find(t=>!already.has(t));
  if (!next) return res.status(400).json({error:'no-more-terms'});
  s.draws.push({ index: s.draws.length, text: next, drawnAt: Date.now() });
  res.json({ text: next, total: s.draws.length });
});

// entrar jogador (gera cartela)
app.post('/sessions/:id/players', (req, res)=>{
  const s = SESS[req.params.id]; if(!s) return res.status(404).json({error:'not found'});
  const schema = z.object({ displayName: z.string().min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error);

  const pid = uid(6).toUpperCase();
  const layout = makeBoard(s.rows, s.cols, s.terms);
  s.players.push({ id: pid, name: parsed.data.displayName, layout });

  res.json({ playerId: pid, layout, gridRows: s.rows, gridCols: s.cols });
});

// estado da sessão (para polling no player)
app.get('/sessions/:id/state', (req,res)=>{
  const s = SESS[req.params.id]; if(!s) return res.status(404).json({error:'not found'});
  res.json({ id: s.id, rows: s.rows, cols: s.cols, win: s.win, draws: s.draws, termsCount: s.terms.length });
});

// ===== Claims — persistência em Postgres (Prisma) =====

// salvar claim
app.post('/sessions/:id/claim', async (req,res)=>{
  const s = SESS[req.params.id]; if(!s) return res.status(404).json({error:'not found'});

  const schema = z.object({
    playerId: z.string().min(1),
    playerName: z.string().min(1),
    layout: z.array(z.array(z.string())),
    marks: z.array(z.tuple([z.number().int(), z.number().int()])),
    clientHasBingo: z.boolean()
  });
  const parsed = schema.safeParse(req.body);
  if(!parsed.success) return res.status(400).json(parsed.error);

  const { playerId, playerName, layout, marks, clientHasBingo } = parsed.data;

  const claim = {
    id: uid(8),
    sessionId: s.id,
    playerId,
    playerName,
    layout,
    marks,
    declaredAt: Date.now(),
    clientHasBingo,
    serverCheck: hasBingoServer(layout, marks) ? 'valid' : 'invalid' as const
  };

  try {
    await prisma.claim.create({
      data: {
        id: claim.id,
        sessionId: claim.sessionId,
        playerId: claim.playerId,
        playerName: claim.playerName,
        layout: claim.layout as any,
        marks: claim.marks as any,
        clientHasBingo: claim.clientHasBingo,
        serverCheck: claim.serverCheck,
        declaredAt: new Date(claim.declaredAt),
      }
    });
    return res.status(201).json({ status: 'received', claim });
  } catch (e:any) {
    console.error('claim save error', e);
    return res.status(500).json({ error: 'persist_fail' });
  }
});

// listar claims
app.get('/sessions/:id/claims', async (req,res)=>{
  try {
    const rows = await prisma.claim.findMany({
      where: { sessionId: req.params.id },
      orderBy: { declaredAt: 'asc' }
    });
    const claims = rows.map(r => ({
      id: r.id,
      sessionId: r.sessionId,
      playerId: r.playerId,
      playerName: r.playerName,
      layout: r.layout as any,
      marks: r.marks as any,
      clientHasBingo: r.clientHasBingo,
      serverCheck: r.serverCheck as 'valid'|'invalid'|'unknown',
      declaredAt: new Date(r.declaredAt).getTime(),
    }));
    res.json({ count: claims.length, claims });
  } catch (e:any) {
    console.error('claim list error', e);
    res.status(500).json({ error: 'list_fail' });
  }
});

// ===== listen =====
const port = Number(process.env.PORT || 10000);
app.listen(port, () => {
  console.log(`API listening on :${port}`);
});
