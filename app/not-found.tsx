import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-8">
      <div className="max-w-md w-full text-center">
        <h1 className="text-6xl font-bold text-amber-400 mb-4">404</h1>
        <h2 className="text-2xl font-semibold text-white mb-2">Seite nicht gefunden</h2>
        <p className="text-gray-400 mb-8">
          Die angeforderte Seite existiert nicht oder wurde verschoben.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-white rounded-lg px-6 py-3 font-medium transition-colors"
        >
          ← Zur Startseite
        </Link>
      </div>
    </div>
  );
}
