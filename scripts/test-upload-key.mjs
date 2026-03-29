/**
 * Testet ob der API-Key vom PHP-Upload-Server akzeptiert wird.
 * Sendet eine minimale Anfrage ohne echte Datei (nur apiKey + path).
 * Ausführen: node scripts/test-upload-key.mjs
 */

const API_KEY = "eb79f197cb6766d3a889e69ccf5eea0ecfe550ce3d61b043e2e2d9777d62d2a9";
const PHP_ENDPOINT = "https://pics.frank-sellke.de/upload.php";

console.log("🔑 Teste API-Key:", API_KEY.substring(0, 12) + "...");
console.log("🌐 Endpoint:", PHP_ENDPOINT);
console.log("");

// Test 1: Nur apiKey + path senden (kein file) → Erwartung: "Keine Datei" oder "Ungültiger API-Key"
const formData = new FormData();
formData.append("apiKey", API_KEY);
formData.append("path", "fotos");

try {
  const res = await fetch(PHP_ENDPOINT, {
    method: "POST",
    body: formData,
  });

  const text = await res.text();
  console.log("HTTP Status:", res.status);
  console.log("Antwort:", text);

  let json;
  try { json = JSON.parse(text); } catch { json = null; }

  if (json?.error === "Ungültiger API-Key") {
    console.log("\n❌ API-Key wird ABGELEHNT – PHP-Datei auf Server hat anderen Key!");
    console.log("   → Bitte upload.php neu auf pics.frank-sellke.de hochladen.");
  } else if (json?.error === "Keine Datei übermittelt") {
    console.log("\n✅ API-Key wird AKZEPTIERT! Upload-Endpoint funktioniert korrekt.");
  } else {
    console.log("\n⚠️  Unerwartete Antwort – prüfe den Server.");
  }
} catch (err) {
  console.error("❌ Verbindungsfehler:", err.message);
}
