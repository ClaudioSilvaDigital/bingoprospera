import type { AppProps } from "next/app";
import Image from "next/image";
import "../styles/globals.css";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>

      <header className="flex flex-col items-center justify-center py-6 bg-white shadow-sm">
  <a className="flex flex-col items-center gap-2">
    <Image
      src="/logo-prospera.png"
      alt="Prospera"
      width={300}
      height={92}
      priority
    />
    <span className="text-lg font-semibold text-gray-700 tracking-wide text-center">
      Conexão Prospera – Bingo
    </span>
  </a>
</header>


      <main className="min-h-screen bg-prospera-mist">
        <Component {...pageProps} />
      </main>
    </>
  );
}
