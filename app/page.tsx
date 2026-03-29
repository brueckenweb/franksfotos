export default function HomePage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
      <div className="text-center p-8 border border-amber-500/30 rounded-2xl bg-gray-900">
        <h1 className="text-4xl font-bold text-amber-400 mb-4">Hello World 👋</h1>
        <p className="text-gray-400 text-lg">
          Diese Seite ist nur ein Test – das Routing funktioniert!
        </p>
        <p className="text-gray-600 text-sm mt-4">
          (Temporäre Testseite – Startseite wird gleich wiederhergestellt)
        </p>
      </div>
    </div>
  );
}
