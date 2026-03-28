export const metadata = {
  title: "Impressum",
};

export default function ImpressumPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h1 className="text-3xl font-bold text-white mb-8">Impressum</h1>

        <div className="prose prose-invert max-w-none">
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-4">Angaben gemäß § 5 TMG</h2>
            <p className="text-gray-300 mb-4">
              Frank Sellke<br />
              Am Schleitershof 15<br />
              47803 Krefeld<br />
              Deutschland
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-4">Kontakt</h2>
            <p className="text-gray-300 mb-4">
              Telefon: +49 (0) 1512 8717333<br />
              E-Mail: post@frank-sellke.de
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-4">Haftung für Inhalte</h2>
            <p className="text-gray-300 mb-4">
              Als Diensteanbieter sind wir gemäß § 7 Abs.1 TMG für eigene Inhalte auf diesen Seiten
              nach den allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis 10 TMG sind wir als
              Diensteanbieter jedoch nicht verpflichtet, übermittelte oder gespeicherte fremde
              Informationen zu überwachen oder nach Umständen zu forschen, die auf eine rechtswidrige
              Tätigkeit hinweisen.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-4">Urheberrecht</h2>
            <p className="text-gray-300 mb-4">
              Die durch die Seitenbetreiber erstellten Inhalte und Werke auf diesen Seiten
              unterliegen dem deutschen Urheberrecht. Die Vervielfältigung, Bearbeitung, Verbreitung
              und jede Art der Verwertung außerhalb der Grenzen des Urheberrechtes bedürfen der
              schriftlichen Zustimmung des jeweiligen Autors bzw. Erstellers.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}