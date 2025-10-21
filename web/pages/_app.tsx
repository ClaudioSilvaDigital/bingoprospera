import Image from "next/image";
import "../styles/globals.css";

export default function App({ Component, pageProps }) {
  return (
    <>
      <header className="flex items-center justify-center gap-3 py-4 bg-green-50 border-b border-green-200">
        <Image
          src="/logo-prospera.svg"
          alt="Prospera"
          width={40}
          height={40}
          className="rounded"
          priority
        />
        <h1 className="text-lg font-semibold text-gray-700 tracking-wide">
          Prospera Bingo Corporativo
        </h1>
      </header>

      <main className="min-h-screen bg-gray-50">
        <Component {...pageProps} />
      </main>
    </>
  );
}

