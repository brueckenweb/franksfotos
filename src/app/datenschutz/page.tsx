export const metadata = {
  title: "Datenschutz",
};

export default function DatenschutzPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h1 className="text-3xl font-bold text-white mb-8">Datenschutzerklärung</h1>

        <div className="prose prose-invert max-w-none">
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-4">1. Datenschutz auf einen Blick</h2>
            <h3 className="text-lg font-medium text-white mb-2">Allgemeine Hinweise</h3>
            <p className="text-gray-300 mb-4">
              Die folgenden Hinweise geben einen einfachen Überblick darüber, was mit Ihren
              personenbezogenen Daten passiert, wenn Sie diese Website besuchen. Personenbezogene
              Daten sind alle Daten, mit denen Sie persönlich identifiziert werden können.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-4">2. Allgemeine Informationen</h2>
            <h3 className="text-lg font-medium text-white mb-2">Verantwortlicher</h3>
            <p className="text-gray-300 mb-4">
              Frank Beispiel<br />
              Musterstraße 123<br />
              12345 Musterstadt<br />
              Deutschland
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-4">3. Datenerfassung auf dieser Website</h2>
            <h3 className="text-lg font-medium text-white mb-2">Cookies</h3>
            <p className="text-gray-300 mb-4">
              Diese Website verwendet Cookies. Cookies sind kleine Textdateien, die auf Ihrem
              Endgerät gespeichert werden und die es ermöglichen, bestimmte Informationen zu
              speichern.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-4">4. Ihre Rechte</h2>
            <p className="text-gray-300 mb-4">
              Sie haben jederzeit das Recht unentgeltlich Auskunft über Herkunft, Empfänger und
              Zweck Ihrer gespeicherten personenbezogenen Daten zu erhalten. Sie haben außerdem
              ein Recht, die Berichtigung, Sperrung oder Löschung dieser Daten zu verlangen.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-4">5. Kontakt</h2>
            <p className="text-gray-300 mb-4">
              Bei Fragen zu dieser Datenschutzerklärung wenden Sie sich bitte an:<br />
              E-Mail: info@franksfotos.de
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}