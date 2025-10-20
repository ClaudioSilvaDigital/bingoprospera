
import { useEffect, useState } from "react";
import { useRouter } from "next/router";

const API_BASE = (typeof window !== 'undefined'
  ? (process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:10000')
  : process.env.NEXT_PUBLIC_API_BASE) as string;

export default function Play(){
  const router = useRouter();
  const { id } = router.query;
  const [name, setName] = useState('Jogador');
  const [layout, setLayout] = useState<string[][]>([]);

  async function join(){
    const res = await fetch(`${API_BASE}/sessions/${id}/players`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ displayName: name })
    });
    const data = await res.json();
    setLayout(data.layout);
  }

  return (
    <main style={{maxWidth: 640, margin:'40px auto', padding:'0 16px', fontFamily:'system-ui'}}>
      <h1>Entrar na sessão {id as string}</h1>
      <div style={{display:'grid', gap:12}}>
        <input value={name} onChange={e=>setName(e.target.value)} />
        <button onClick={join}>Entrar</button>
        <div style={{display:'grid', gridTemplateColumns:`repeat(${layout[0]?.length||0}, 1fr)`, gap:6}}>
          {layout.flat().map((t,i)=>(
            <div key={i} style={{border:'1px solid #999', padding:8, textAlign:'center'}}>{t}</div>
          ))}
        </div>
      </div>
    </main>
  );
}
