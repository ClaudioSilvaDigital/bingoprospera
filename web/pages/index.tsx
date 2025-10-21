import { useEffect, useMemo, useState } from "react";

// Lê a base da API (já definida nas env vars do Render)
const RAW = process.env.NEXT_PUBLIC_API_BASE as string | undefined;
const API_BASE = RAW ? (RAW.startsWith("http") ? RAW : `https://${RAW}`) : "http://localhost:10000";

// Router por hash: "#/play/ID" ou home ("")
type Route =
  | { name: "home" }
  | { name: "play"; sessionId: string };

function useHashRoute(): Route {
  const [hash, setHash] = useState<string>(typeof window !== "undefined" ? window.location.hash : "");

  useEffect(() => {
    const onHash = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  return useMemo(() => {
    const m = hash.match(/^#\/play\/([A-Za-z0-9_-]{4,})$/);
    if (m) return { name: "play", sessionId: m[1] };
    return { name: "home" };
  }, [hash]);
}

export default function App() {
  const route = useHashRoute();

  if (route.name === "play") {
    return <PlayScreen sessionId={route.sessionId} />;
  }
  return <HomeScreen />;
}

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

  const fullLink =
    typeof window !== "undefined" && sessionId
      ? `${window.location.origin}/#/play/${sessionId}`
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
        <button onClick={drawNext} disabled={!sessionId}>
          Sortear próximo
        </button>

        <pre>{log}</pre>

        {sessionId && (
          <p>
            URL para jogadores:&nbsp;
            <a href={`/#/play/${sessionId}`} style={{ textDecoration: "underline", color: "#0070f3" }}>
              {fullLink}
            </a>
          </p>
        )}
      </div>
    </main>
  );
}

function PlayScreen({ sessionId }: { sessionId: string }) {
  const [name, setName] = useState("Jogador");
  const [layout, setLayout] = useState<string[][]>([]);
  const [error, setError] = useState<string>("");

  async function join() {
    setError("");
    try {
      const res = await fetch(`${API_BASE}/sessions/${sessionId}/players`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: name }),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || `Join falhou: ${res.status}`);
      }
      const data = await res.json();
      setLayout(data.layout);
    } catch (e: any) {
      setError(e.message || "Erro ao entrar");
    }
  }

  const cols = layout[0]?.length || 0;

  return (
    <main style={{ maxWidth: 720, margin: "40px auto", padding: "0 16px", fontFamily: "system-ui" }}>
      <h1>Entrar na sessão {sessionId}</h1>
      <div style={{ display: "grid", gap: 12 }}>
        <label>
          Seu nome: <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <button onClick={join}>Entrar</button>
        {error && <div style={{ color: "crimson" }}>{error}</div>}
        {cols > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 6 }}>
            {layout.flat().map((t, i) => (
              <div key={i} style={{ border: "1px solid #999", padding: 8, textAlign: "center" }}>
                {t}
              </div>
            ))}
          </div>
        )}
        <p>
          <a href="/" style={{ textDecoration: "underline" }}>
            ← Voltar para a Home
          </a>
        </p>
      </div>
    </main>
  );
}
