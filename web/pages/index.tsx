import { useEffect, useMemo, useState } from "react";

const RAW = process.env.NEXT_PUBLIC_API_BASE as string | undefined;
const API_BASE = RAW ? (RAW.startsWith("http") ? RAW : `https://${RAW}`) : "http://localhost:10000";

type Route =
  | { name: "home" }
  | { name: "play"; sessionId: string }
  | { name: "admin"; sessionId: string };

function useHashRoute(): Route {
  const [hash, setHash] = useState<string>(typeof window !== "undefined" ? window.location.hash : "");
  useEffect(() => {
    const onHash = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  let m = hash.match(/^#\/admin\/([A-Za-z0-9_-]{4,})$/);
  if (m) return { name: "admin", sessionId: m[1] };
  m = hash.match(/^#\/play\/([A-Za-z0-9_-]{4,})$/);
  if (m) return { name: "play", sessionId: m[1] };
  return { name: "home" };
}

export default function Root() {
  const route = useHashRoute();
  if (route.name === "admin") return <AdminScreen sessionId={route.sessionId} />;
  if (route.name === "play") return <PlayScreen sessionId={route.sessionId} />;
  return <HomeScreen />;
}

/* =============== HOME =============== */
function HomeScreen() {
  const [sessionId, setSessionId] = useState<string>("");
  const [rows, setRows] = useState(6);
  const [cols, setCols] = useState(6);
  const [log, setLog] = useState<string>("");

  async function createSession() {
    const res = await fetch(`${API_BASE}/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gridRows: rows, gridCols: cols, winConditions: ["row", "col", "diag"] }),
    });
    const data = await res.json();
    setSessionId(data.id);
    setLog(`Sessão criada: ${data.id}`);
  }

  async function drawNext() {
    if (!sessionId) return;
    const res = await fetch(`${API_BASE}/sessions/${sessionId}/draw/next`, { method: "POST" });
    const data = await res.json();
    setLog(`Sorteado: ${data.text}`);
  }

  const fullPlayerLink =
    typeof window !== "undefined" && sessionId
      ? `${window.location.origin}/#/play/${sessionId}`
      : "";
  const fullAdminLink =
    typeof window !== "undefined" && sessionId
      ? `${window.location.origin}/#/admin/${sessionId}`
      : "";

  return (
    <div className="min-h-full">
      <header className="bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/60 sticky top-0 border-b border-gray-100">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center gap-3">
          <div className="size-9 rounded-xl bg-prospera-primary/10 flex items-center justify-center">
            <span className="text-prospera-primary font-black">P</span>
          </div>
          <div className="font-bold">Prospera Bingo</div>
          <div className="ml-auto text-sm text-gray-500">Sustentável, rápido e divertido</div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 grid md:grid-cols-2 gap-8">
        <section className="card p-6">
          <h1 className="h1 mb-2">Criar Sessão</h1>
          <p className="subtle mb-6">Defina o tamanho da cartela e comece o sorteio.</p>

          <div className="grid grid-cols-2 gap-4">
            <label className="text-sm">
              Linhas
              <input
                type="number"
                min={3}
                max={12}
                value={rows}
                onChange={(e) => setRows(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-prospera-accent"
              />
            </label>
            <label className="text-sm">
              Colunas
              <input
                type="number"
                min={3}
                max={12}
                value={cols}
                onChange={(e) => setCols(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-prospera-accent"
              />
            </label>
          </div>

          <div className="mt-6 flex gap-3">
            <button onClick={createSession} className="btn">Criar sessão</button>
            <button onClick={drawNext} disabled={!sessionId} className="btn-secondary disabled:opacity-60">
              Sortear próximo
            </button>
          </div>

          <pre className="mt-4 text-sm bg-gray-50 rounded-xl p-3 border border-gray-100">{log || "—"}</pre>

          {sessionId && (
            <div className="mt-6 space-y-2">
              <div className="text-sm">URL Jogadores:</div>
              <a className="text-prospera-primary underline break-all" href={`/#/play/${sessionId}`}>
                {fullPlayerLink}
              </a>
              <div className="text-sm mt-2">URL Gestão:</div>
              <a className="text-prospera-primary underline break-all" href={`/#/admin/${sessionId}`}>
                {fullAdminLink}
              </a>
            </div>
          )}
        </section>

        <section className="card p-6">
          <h2 className="h2 mb-2">Boas práticas</h2>
          <ul className="list-disc pl-6 text-sm text-gray-700 space-y-2">
            <li>Não imprime nada. Tudo via navegador.</li>
            <li>Compatível com celular (toques grandes, contraste alto).</li>
            <li>Paleta Prospera para reforçar a identidade.</li>
            <li>Fácil de operar em eventos: sessão, sorteio, telão e gestão.</li>
          </ul>
          <div className="mt-4 rounded-2xl border border-dashed border-prospera-accent/40 p-3 text-sm text-gray-600">
            Dica: use o link de gestão num telão e o de jogadores via QR code.
          </div>
        </section>
      </main>

      <footer className="py-6 text-center text-xs text-gray-500">
        © {new Date().getFullYear()} Claudio Silva • Se não agora, quando?
      </footer>
    </div>
  );
}

/* =============== PLAY =============== */
function PlayScreen({ sessionId }: { sessionId: string }) {
  const [name, setName] = useState("Jogador");
  const [layout, setLayout] = useState<string[][]>([]);
  const [drawn, setDrawn] = useState<Set<string>>(new Set());
  const [marks, setMarks] = useState<Set<string>>(new Set());
  const [grid, setGrid] = useState<{ rows: number; cols: number }>({ rows: 0, cols: 0 });
  const [error, setError] = useState<string>("");

  const keyRC = (r: number, c: number) => `${r},${c}`;

  async function join() {
    setError("");
    try {
      const res = await fetch(`${API_BASE}/sessions/${sessionId}/players`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: name }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setLayout(data.layout);
      setGrid({ rows: data.gridRows, cols: data.gridCols });
    } catch (e: any) {
      setError(e.message || "Erro ao entrar");
    }
  }

  useEffect(() => {
    let t: any;
    const tick = async () => {
      try {
        const r = await fetch(`${API_BASE}/sessions/${sessionId}/state`);
        if (r.ok) {
          const data = await r.json();
          const set = new Set<string>(data.draws.map((d: any) => d.text));
          setDrawn(set);
        }
      } catch {}
      t = setTimeout(tick, 2000);
    };
    tick();
    return () => { if (t) clearTimeout(t); };
  }, [sessionId]);

  function toggleMark(r: number, c: number) {
    if (!layout.length) return;
    const term = layout[r][c];
    if (!drawn.has(term)) return;
    const k = keyRC(r, c);
    setMarks(prev => {
      const n = new Set(prev);
      if (n.has(k)) n.delete(k); else n.add(k);
      return n;
    });
  }

  function hasBingo(): boolean {
    const R = grid.rows || layout.length;
    const C = grid.cols || (layout[0]?.length || 0);
    if (R === 0 || C === 0) return false;
    for (let r = 0; r < R; r++) {
      let ok = true; for (let c = 0; c < C; c++) if (!marks.has(keyRC(r, c))) { ok = false; break; }
      if (ok) return true;
    }
    for (let c = 0; c < C; c++) {
      let ok = true; for (let r = 0; r < R; r++) if (!marks.has(keyRC(r, r === r ? c : c))) { ok = false; break; } // mantém simples
      if (ok) return true;
    }
    { let ok = true; for (let i = 0; i < Math.min(R, C); i++) if (!marks.has(keyRC(i, i))) { ok = false; break; } if (ok) return true; }
    { let ok = true; for (let i = 0; i < Math.min(R, C); i++) if (!marks.has(keyRC(i, C - 1 - i))) { ok = false; break; } if (ok) return true; }
    return false;
  }

  async function claim() {
    const marksArr: Array<[number, number]> = Array.from(marks).map(k => {
      const [r, c] = k.split(",").map(Number);
      return [r, c] as [number, number];
    });
    try {
      const r = await fetch(`${API_BASE}/sessions/${sessionId}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId: name.replace(/\s+/g, "-").toUpperCase().slice(0, 8) || "PLAYER",
          playerName: name,
          layout,
          marks: marksArr,
          clientHasBingo: hasBingo(),
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || `Falha: ${r.status}`);
      alert(data?.claim?.serverCheck === "valid"
        ? "Bingo! (validado no servidor)"
        : "Declaração recebida, o host irá revisar.");
    } catch (e: any) {
      alert(e.message || "Erro ao declarar bingo");
    }
  }

  const cols = layout[0]?.length || 0;

  return (
    <div className="min-h-full">
      <header className="bg-white/70 backdrop-blur sticky top-0 border-b border-gray-100">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center gap-3">
          <div className="size-9 rounded-xl bg-prospera-primary/10 flex items-center justify-center">
            <span className="text-prospera-primary font-black">P</span>
          </div>
          <div className="font-bold">Conexão Prospera • Bingo</div>
          <a href="/" className="ml-auto text-sm text-prospera-primary underline">Home</a>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 grid gap-8">
        {!layout.length && (
          <section className="card p-6">
            <h1 className="h1 mb-2">Entrar na sessão {sessionId}</h1>
            <p className="subtle mb-6">Digite seu nome e gere sua cartela.</p>
            <label className="text-sm block">
              Seu nome
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-prospera-accent"
              />
            </label>
            <div className="mt-4 flex gap-3">
              <button onClick={join} className="btn">Entrar</button>
              {error && <div className="text-red-600 text-sm">{error}</div>}
            </div>
            <p className="subtle mt-4">Dica: células só podem ser marcadas quando o termo for sorteado.</p>
          </section>
        )}

        {cols > 0 && (
          <section className="card p-4 md:p-6">
            <div className={`grid gap-2`} style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}>
              {layout.map((row, r) =>
                row.map((t, c) => {
                  const k = `${r},${c}`;
                  const isDrawn = drawn.has(t);
                  const isMarked = marks.has(k);
                  return (
                    <button
                      key={k}
                      onClick={() => toggleMark(r, c)}
                      disabled={!isDrawn}
                      className={[
                        "px-3 py-3 rounded-xl border text-sm font-semibold transition",
                        isMarked
                          ? "bg-emerald-100 border-emerald-300"
                          : isDrawn
                            ? "bg-blue-50 border-blue-200 hover:bg-blue-100"
                            : "bg-gray-100 border-gray-200 text-gray-500 cursor-not-allowed"
                      ].join(" ")}
                      title={!isDrawn ? "Aguarde o sorteio deste termo" : "Marcar/Desmarcar"}
                    >
                      {t}
                    </button>
                  );
                })
              )}
            </div>

            <div className="mt-4 flex items-center gap-3">
              <span className="subtle">Sorteados: <b>{drawn.size}</b></span>
              <span className="subtle">• Marcas: <b>{marks.size}</b></span>
              <button onClick={claim} className="btn ml-auto">Declarar BINGO</button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

/* =============== ADMIN =============== */
function AdminScreen({ sessionId }: { sessionId: string }) {
  const [claims, setClaims] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [state, setState] = useState<{ draws: any[]; rows: number; cols: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>("");

  useEffect(() => {
    let t: any;
    const tick = async () => {
      try {
        const [r1, r2] = await Promise.all([
          fetch(`${API_BASE}/sessions/${sessionId}/state`),
          fetch(`${API_BASE}/sessions/${sessionId}/claims`),
        ]);
        if (r1.ok) {
          const s = await r1.json();
          setState({ draws: s.draws || [], rows: s.rows, cols: s.cols });
        }
        if (r2.ok) {
          const d = await r2.json();
          setClaims(d.claims || []);
          if (!selected && d.claims?.length) {
            const firstValid = d.claims.find((x: any) => x.serverCheck === "valid");
            setSelected(firstValid || d.claims[0]);
          }
        }
      } catch (e: any) {
        setErr("Falha ao atualizar painel.");
      }
      t = setTimeout(tick, 3000);
    };
    tick();
    return () => { if (t) clearTimeout(t); };
  }, [sessionId]);

  async function drawNext() {
    setBusy(true); setErr("");
    try {
      const r = await fetch(`${API_BASE}/sessions/${sessionId}/draw/next`, { method: "POST" });
      if (!r.ok) throw new Error(await r.text());
    } catch (e:any) {
      setErr(e.message || "Erro ao sortear");
    } finally {
      setBusy(false);
    }
  }

  const totalDraws = state?.draws?.length || 0;
  const validCount = claims.filter(c => c.serverCheck === "valid").length;

  return (
    <div className="min-h-full">
      <header className="bg-white/70 backdrop-blur sticky top-0 border-b border-gray-100">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center gap-3">
          <div className="size-9 rounded-xl bg-prospera-primary/10 flex items-center justify-center">
            <span className="text-prospera-primary font-black">P</span>
          </div>
          <div className="font-bold">Prospera Bingo • Gestão</div>
          <a href="/" className="ml-auto text-sm text-prospera-primary underline">Home</a>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 grid md:grid-cols-[380px_1fr] gap-6">
        <div className="flex items-center gap-3 flex-wrap mb-1">
          <span className="px-3 py-2 rounded-xl bg-white border border-gray-200">Sorteios: <b>{totalDraws}</b></span>
          <span className="px-3 py-2 rounded-xl bg-white border border-gray-200">Declarações: <b>{claims.length}</b> (válidas: <b>{validCount}</b>)</span>
          <button onClick={drawNext} disabled={busy} className="btn ml-auto">
            {busy ? "Sorteando..." : "Sortear próximo"}
          </button>
        </div>
        {err && <div className="text-red-600 mb-2">{err}</div>}

        <section className="card p-4 md:p-5 overflow-hidden">
          <h3 className="h2 mb-3">Declarações</h3>
          <div className="grid gap-3 max-h-[520px] overflow-y-auto pr-1">
            {claims.map((c:any)=>(
              <button key={c.id}
                onClick={()=>setSelected(c)}
                className={[
                  "text-left p-3 rounded-xl border transition",
                  selected?.id===c.id ? "bg-blue-50 border-blue-200" : "bg-white border-gray-200 hover:bg-gray-50"
                ].join(" ")}
              >
                <div className="flex justify-between items-center">
                  <span className="font-semibold">{c.playerName}</span>
                  <span className={[
                    "text-xs px-2 py-1 rounded-md",
                    c.serverCheck==="valid" ? "bg-emerald-100 text-emerald-800" :
                    c.serverCheck==="invalid" ? "bg-red-100 text-red-800" :
                    "bg-gray-100 text-gray-700"
                  ].join(" ")}>{c.serverCheck}</span>
                </div>
                <div className="text-xs text-gray-600">{new Date(c.declaredAt).toLocaleTimeString()}</div>
              </button>
            ))}
            {!claims.length && <div className="text-gray-600 text-sm">Nenhuma declaração ainda.</div>}
          </div>
        </section>

        <section className="card p-4 md:p-5">
          <h3 className="h2 mb-3">Cartela</h3>
          {!selected && <div className="text-gray-600">Selecione uma declaração ao lado.</div>}
          {selected && <ClaimBoard claim={selected} />}
          <div className="mt-4">
            <h4 className="font-semibold mb-2 text-gray-800">Últimos sorteios</h4>
            <div className="flex flex-wrap gap-2">
              {(state?.draws || []).slice(-24).reverse().map((d:any)=>(
                <span key={d.index} className="px-3 py-1 rounded-xl border border-gray-200 bg-white text-sm">{d.text}</span>
              ))}
              {!state?.draws?.length && <span className="text-gray-600 text-sm">Ainda não há sorteios.</span>}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function ClaimBoard({ claim }: { claim: any }) {
  const layout: string[][] = claim.layout;
  const marks: Array<[number, number]> = claim.marks || [];
  const set = useMemo(() => new Set(marks.map(([r, c]) => `${r},${c}`)), [marks]);
  const cols = layout[0]?.length || 0;
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}>
      {layout.map((row: string[], r: number) =>
        row.map((t: string, c: number) => {
          const k = `${r},${c}`;
          const marked = set.has(k);
          return (
            <div
              key={k}
              className={[
                "px-3 py-3 rounded-xl border text-sm font-semibold",
                marked ? "bg-emerald-100 border-emerald-300" : "bg-gray-50 border-gray-200"
              ].join(" ")}
            >
              {t}
            </div>
          );
        })
      )}
    </div>
  );
}
