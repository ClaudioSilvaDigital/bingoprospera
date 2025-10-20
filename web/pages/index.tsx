
import { useState } from "react";

const API_BASE = (typeof window !== 'undefined'
  ? (process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:10000')
  : process.env.NEXT_PUBLIC_API_BASE) as string;

export default function Home(){
  const [sessionId, setSessionId] = useState<string>('');
  const [rows, setRows] = useState(6);
  const [cols, setCols] = useState(6);
  const [log, setLog] = useState<string>('');

  async function createSession(){
    const res = await fetch(`${API_BASE}/sessions`, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ gridRows: rows, gridCols: cols, winConditions: ['row','col'] })
    });
    const data = await res.json();
    setSessionId(data.id);
    setLog(`Sessão criada: ${data.id}`);
  }

  async function drawNext(){
    if(!sessionId) return;
    const res = await fetch(`${API_BASE}/sessions/${sessionId}/draw/next`, { method:'POST' });
    const data = await res.json();
    setLog(`Sorteado: ${data.text}`);
  }

  return (
    <main style={{maxWidth: 640, margin:'40px auto', padding:'0 16px', fontFamily:'system-ui'}}>
      <h1>Prospera Bingo • Web</h1>
      <p>Boilerplate Next.js conectado à API Render.</p>

      <div style={{display:'grid', gap:12}}>
        <label>Linhas: <input type="number" min={3} max={12} value={rows} onChange={e=>setRows(Number(e.target.value))} /></label>
        <label>Colunas: <input type="number" min={3} max={12} value={cols} onChange={e=>setCols(Number(e.target.value))} /></label>
        <button onClick={createSession}>Criar sessão</button>
        <button onClick={drawNext} disabled={!sessionId}>Sortear próximo</button>
        <pre>{log}</pre>
        {sessionId && <p>URL para jogadores (exemplo de rota): /play/{sessionId}</p>}
      </div>
    </main>
  );
}
