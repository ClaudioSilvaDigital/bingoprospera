import type { AppProps } from "next/app";
import Image from "next/image";
import "../styles/globals.css";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <header className="flex items-center justify-center gap-3 py-4 bg-white shadow-sm">
        <a href="/" className="flex items-center gap-3">
          <Image
            src="/logo-prospera.png"   // coloque o arquivo em web/public/logo-prospera.svg
            alt="Prospera"
            width={300}
            height={92}
            priority
          />
          <span className="text-lg font-semibold text-gray-700 tracking-wide">
            <br>Conexão Prospera - Bingo</br>
          </span>
        </a>
      </header>

      <main className="min-h-screen bg-prospera-mist">
        <Component {...pageProps} />
      </main>
    </>
  );
}
