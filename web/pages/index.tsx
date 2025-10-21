import { useEffect, useMemo, useState } from "react";

// ===== Config da API =====
const RAW = process.env.NEXT_PUBLIC_API_BASE as string | undefined;
const API_BASE = RAW ? (RAW.startsWith("http") ? RAW : `https://${RAW}`) : "http://localhost:10000";

// ===== Router por HASH =====
type Route =
  | { name: "home" }
  | { name: "play"; sessionId: string }
  | { name: "admin"; sessionId: string };

function useHashRoute(): Route {
  const [hash, setHash] = useState<string>(
    typeof window !== "undefined" ? window.location.hash : ""
  );
  useEffect(() => {
    const onHash = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  // #/admin/ABC123
  let m = hash.match(/^#\/admin\/([A-Za-z0-9_-]{4,})$/);
  if (m) return { name: "admin", sessionId: m[1] };

  // #/play/ABC123
  m = hash.match(/^#\/play\/([A-Za-z0-9_-]{4,})$/);
  if (m) return { name: "play", sessionId: m[1] };

  return { name: "home" };
}

// ===== App root =====
export default function App() {
  const route = useHashRoute();
  if (route.name === "admin") return <AdminScreen sessionId={route.sessionId} />;
  if (route.name === "play") return <PlayScreen sessionId={route.sessionId} />;
  return <HomeScreen />;
}

// ====== HOME (criar sessão / sortear) ======
function HomeScreen() {
  const [sessionId, setSessionId] = useState<string>("");
  const [rows, setRows] = useState(6);
  const [cols, setCols] = useState(6);
  const [log, setLog] = useState<string>("");

  async function createSession() {
    const res = await fetch(`${API_BASE}/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gridRows: rows, gridCols: cols, winConditions: ["row", "col"] }),
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
    <main style={{ maxWidth: 640, margin: "40px auto", padding: "0 16px", fontFamily: "system-ui" }}>
      <h1>Prospera Bingo • Web</h1>
      <p>Boilerplate Next.js conectado à API Render.</p>

      <div style={{ display: "grid", gap: 12 }}>
        <label>
          Linhas:{" "}
          <input type="number" min={3} max={12} value={rows} onChange={(e) => setRows(Number(e.target.value))} />
        </label>
        <label>
          Colunas:{" "}
          <input type="number" min={3} max={12} value={cols} onChange={(e) => setCols(Number(e.target.value))} />
        </label>

        <button onClick={createSession}>Criar sessão</button>
        <button onClick={drawNext} disabled={!sessionId}>Sortear próximo</button>

        <pre>{log}</pre>

        {sessionId && (
          <>
            <p>
              URL para jogadores:&nbsp;
              <a href={`/#/play/${sessionId}`} style={{ textDecoration: "underline", color: "#0070f3" }}>
                {fullPlayerLink}
              </a>
            </p>
            <p>
              URL da gestão:&nbsp;
              <a href={`/#/admin/${sessionId}`} style={{ textDecoration: "underline", color: "#0070f3" }}>
                {fullAdminLink}
              </a>
            </p>
          </>
        )}
      </div>
    </main>
  );
}

// ====== PLAY (cartela do jogador) ======
function PlayScreen({ sessionId }: { sessionId: string }) {
  const [name, setName] = useState("Jogador");
  const [layout, setLayout] = useState<string[][]>([]);
  const [drawn, setDrawn] = useState<Set<string>>(new Set());  // termos sorteados
  const [marks, setMarks] = useState<Set<string>>(new Set());  // "r,c"
  const [grid, setGrid] = useState<{ rows: number; cols: number }>({ rows: 0, cols: 0 });
  const [error, setError] = useState<string>("");

  const keyRC = (r: number, c: number) => `${r},${c}`;

  // Entrar e receber cartela
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

  // Polling do estado (2s)
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

  // Marcação (só se termo já foi sorteado)
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
      let ok = true; for (let r = 0; r < R; r++) if (!marks.has(keyRC(r, c))) { ok = false; break; }
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
        : "Declaração recebida, mas o servidor não confirmou bingo. O host irá revisar.");
    } catch (e: any) {
      alert(e.message || "Erro ao declarar bingo");
    }
  }

  const cols = layout[0]?.length || 0;

  return (
    <main style={{ maxWidth: 720, margin: "40px auto", padding: "0 16px", fontFamily: "system-ui" }}>
      <h1>Entrar na sessão {sessionId}</h1>
      <div style={{ display: "grid", gap: 12 }}>
        {!layout.length && (
          <>
            <label>Seu nome: <input value={name} onChange={(e) => setName(e.target.value)} /></label>
            <button onClick={join}>Entrar</button>
            {error && <div style={{ color: "crimson" }}>{error}</div>}
          </>
        )}

        {layout.length > 0 && (
          <div style={{ fontSize: 12, color: "#555" }}>
            <b>Dica:</b> células só podem ser marcadas depois que o termo for sorteado.
          </div>
        )}

        {cols > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 6 }}>
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
                    style={{
                      border: "1px solid #999",
                      padding: 8,
                      textAlign: "center",
                      cursor: isDrawn ? "pointer" : "not-allowed",
                      background: isMarked ? "#b2f2bb" : isDrawn ? "#e7f5ff" : "#f1f3f5",
                      fontWeight: isMarked ? 700 : 500,
                    }}
                    title={!isDrawn ? "Aguarde o sorteio deste termo" : "Marcar/Desmarcar"}
                  >
                    {t}
                  </button>
                );
              })
            )}
          </div>
        )}

        {layout.length > 0 && (
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <span>Termos sorteados: {drawn.size}</span>
            <span> | Marcas: {marks.size}</span>
            <button onClick={claim} style={{ marginLeft: "auto" }}>Declarar BINGO</button>
          </div>
        )}

        <p><a href="/" style={{ textDecoration: "underline" }}>← Voltar para a Home</a></p>
      </div>
    </main>
  );
}

// ====== ADMIN (lista e visualiza declarações) ======
function AdminScreen({ sessionId }: { sessionId: string }) {
  const [claims, setClaims] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);

  useEffect(() => {
    let t: any;
    const tick = async () => {
      try {
        const r = await fetch(`${API_BASE}/sessions/${sessionId}/claims`);
        if (r.ok) {
          const data = await r.json();
          setClaims(data.claims || []);
          if (!selected && data.claims?.length) setSelected(data.claims[0]);
        }
      } catch {}
      t = setTimeout(tick, 2000);
    };
    tick();
    return () => { if (t) clearTimeout(t); };
  }, [sessionId]);

  return (
    <main style={{ maxWidth: 1100, margin: "30px auto", padding: "0 16px", fontFamily: "system-ui" }}>
      <h1>Gestão • Sessão {sessionId}</h1>
      <p><a href="/" style={{ textDecoration: "underline" }}>← Home</a></p>

      <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 16 }}>
        <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
          <h3>Declarações ({claims.length})</h3>
          <div style={{ display: "grid", gap: 8 }}>
            {claims.map((c: any) => (
              <button
                key={c.id}
                onClick={() => setSelected(c)}
                style={{
                  textAlign: "left",
                  padding: 8,
                  border: "1px solid #ccc",
                  borderRadius: 6,
                  background: selected?.id === c.id ? "#e7f5ff" : "#fff",
                }}
              >
                <div style={{ fontWeight: 700 }}>{c.playerName}</div>
                <div style={{ fontSize: 12, color: "#555" }}>
                  {new Date(c.declaredAt).toLocaleTimeString()} • Server: {c.serverCheck}
                </div>
              </button>
            ))}
            {!claims.length && <div style={{ color: "#777" }}>Nenhuma declaração ainda.</div>}
          </div>
        </div>

        <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
          <h3>Cartela</h3>
          {!selected && <div>Selecione uma declaração ao lado.</div>}
          {selected && (
            <>
              <div style={{ marginBottom: 8, color: "#555" }}>
                Jogador: <b>{selected.playerName}</b> • Validação servidor: <b>{selected.serverCheck}</b>
              </div>
              <ClaimBoard claim={selected} />
            </>
          )}
        </div>
      </div>
    </main>
  );
}

function ClaimBoard({ claim }: { claim: any }) {
  const layout: string[][] = claim.layout;
  const marks: Array<[number, number]> = claim.marks || [];
  const set = useMemo(() => new Set(marks.map(([r, c]) => `${r},${c}`)), [marks]);
  const cols = layout[0]?.length || 0;
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 6 }}>
      {layout.map((row: string[], r: number) =>
        row.map((t: string, c: number) => {
          const k = `${r},${c}`;
          const marked = set.has(k);
          return (
            <div
              key={k}
              style={{
                border: "1px solid #999",
                padding: 8,
                textAlign: "center",
                background: marked ? "#b2f2bb" : "#f8f9fa",
                fontWeight: marked ? 700 : 500,
              }}
            >
              {t}
            </div>
          );
        })
      )}
    </div>
  );
}
