
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { z } from 'zod';

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' } });

type Draw = { index:number; termId:string; text:string; drawnAt:number };
type Session = {
  id: string;
  seed: string;
  rows: number;
  cols: number;
  win: string[];
  terms: string[];
  draws: Draw[];
  status: 'pending'|'running'|'paused'|'ended';
  players: string[];
};

const SESS: Record<string, Session> = {};

const TERM_POOL = ["Pertencimento","Orgulho","Colaboração","Metas","Soul Up","Comunicação","Reconhecimento",
"União","Transparência","Respeito","Ajuda","Sprint","Solução","Aprendizado","Feedback",
"Proatividade","Conhecimento","Superação","Celebração","Decisão","Motivação","Energia",
"Alegria","Confiança","Comprometimento","Cuidado","Crescimento","Segurança","Equipe",
"Abóbora","Poção","Fantasma","Bruxa","Travessura","Vassoura","Doces","Caveira","Múmia","Feitiço",
"Onboarding","Integração","OKR","KPI","Sprint OK","Review","Daily","Planning","Backlog","Refino",
"QA","Deploy","Bug","Code","Design","UX","UI","Roadmap","Sinergia","Autonomia","Foco",
"Cliente","NPS","CSAT","Receita","Churn","Upsell","Cross-sell","Lead","Pipeline","CAC",
"LTV","SEO","Conteúdo","CTA","Cópia","Brand","Storytelling","Mídia","Orçamento","Compliance",
"Pontos ECOA","Selo Verde","Vale Energia","ECOA Social","Impacto","ODS","Escopo 3","Carbono",
"Token","Ética","Governança","Diversidade","Equidade","Inclusão","Sustentável",
"Saúde","Pausa","Alongamento","Hidratação","Café","Bem-estar","Humor","Conexão","Música","Feriado",
"Gamificação","Badge","Recompensa","App","Check-in","Pontos","Desconto","Sorteio","Prêmio",
"Inovação","Resultado","Entrega","Evolução","Excelência","Resiliência","Autoconfiança",
"Liderança","Visão","Clareza","Estratégia","Transformação","Sucesso","Propósito","Impacto Real"];

function uid(n=6){
  const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s=''; for(let i=0;i<n;i++) s+=chars[Math.floor(Math.random()*chars.length)];
  return s;
}
function hashString(str:string){
  let h=0x811c9dc5;
  for(let i=0;i<str.length;i++){
    h^=str.charCodeAt(i);
    h=(h>>>0)*0x01000193;
  }
  return (h>>>0) >>> 0;
}
function mulberry32(a:number){
  return function(){
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}
function shuffle<T>(arr:T[], rand= Math.random){
  for(let i=arr.length-1;i>0;i--){
    const j = Math.floor(rand()*(i+1));
    [arr[i],arr[j]]=[arr[j],arr[i]];
  }
  return arr;
}

io.on('connection', (socket)=>{
  socket.on('join-session', ({sessionId, name})=>{
    socket.join(sessionId);
    socket.emit('hello', {ok:true});
  });
});

app.post('/sessions', (req,res)=>{
  const schema = z.object({
    gridRows: z.number().min(3).max(12),
    gridCols: z.number().min(3).max(12),
    seed: z.string().optional(),
    winConditions: z.array(z.enum(['row','col','diag','diagX','corners','full'])).default(['row','col'])
  });
  const parsed = schema.safeParse(req.body);
  if(!parsed.success) return res.status(400).json(parsed.error);
  const {gridRows, gridCols, seed, winConditions} = parsed.data;
  const id = uid(6);
  SESS[id] = {
    id, seed: seed || uid(8),
    rows: gridRows, cols: gridCols, win: winConditions,
    terms: [...TERM_POOL], draws: [], status:'pending', players: []
  };
  res.status(201).json({ id, gridRows, gridCols, winConditions, joinUrl: `/play/${id}` });
});

app.post('/sessions/:id/draw/next', (req,res)=>{
  const s = SESS[req.params.id]; if(!s) return res.status(404).json({error:'not found'});
  if(!(s as any)._order){
    const rng = mulberry32(hashString(s.id + "::" + s.seed));
    (s as any)._order = shuffle([...s.terms], rng);
  }
  const order = (s as any)._order as string[];
  if(s.draws.length >= order.length) return res.json({done:true});
  const text = order[s.draws.length];
  const draw: Draw = { index: s.draws.length, termId: String(text), text, drawnAt: Date.now() };
  s.draws.push(draw);
  (io as any).to(s.id).emit('draw:announced', { sessionId: s.id, draw });
  res.json(draw);
});

app.post('/sessions/:id/draw/undo', (req,res)=>{
  const s = SESS[req.params.id]; if(!s) return res.status(404).json({error:'not found'});
  s.draws.pop();
  (io as any).to(s.id).emit('draw:update', { sessionId: s.id, draws: s.draws });
  res.json({ok:true});
});

app.post('/sessions/:id/players', (req,res)=>{
  const s = SESS[req.params.id]; if(!s) return res.status(404).json({error:'not found'});
  const schema = z.object({ displayName: z.string().min(1).max(40) });
  const parsed = schema.safeParse(req.body);
  if(!parsed.success) return res.status(400).json(parsed.error);
  const name = parsed.data.displayName;
  const playerId = uid(8);
  s.players.push(playerId);
  // deterministic card
  const seed = hashString(s.id + "::" + name);
  const rng = mulberry32(seed);
  const pool = [...TERM_POOL];
  shuffle(pool, rng);
  const pick = pool.slice(0, s.rows * s.cols);
  shuffle(pick, rng);
  const layout:string[][]=[];
  for(let r=0;r<s.rows;r++) layout.push(pick.slice(r*s.cols,(r+1)*s.cols));
  res.status(201).json({ playerId, cardId: playerId, gridRows: s.rows, gridCols: s.cols, layout });
});

app.post('/cards/:cardId/marks', (req,res)=>{
  res.json({ valid: true, message: "ok (boilerplate)", marksCount: 0 });
});

app.post('/sessions/:id/claim', (req,res)=>{
  res.json({ status: 'approved', reason: null, winner: { playerId: 'mock', cardId: 'mock', place: 1 }});
});

app.get('/sessions/:id/analytics', (req,res)=>{
  const s = SESS[req.params.id]; if(!s) return res.status(404).json({error:'not found'});
  res.json({ players: s.players.length, totalDraws: s.draws.length, durationSec: 0, topTerms: [] });
});

const port = Number(process.env.PORT || 10000);
httpServer.listen(port, ()=> console.log(`API on :${port}`) );
