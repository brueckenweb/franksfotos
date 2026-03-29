// SMTP-Verbindungstest – direkt mit Node.js ausführen:
// node scripts/test-smtp.mjs

import nodemailer from "nodemailer";

const CONFIG = {
  host: "server.brueckenweb.de",
  port: 587,
  user: "fotogalerie@brueckenweb.de",
  pass: "HIER_RICHTIGES_PASSWORT_EINTRAGEN", // Passwort aus Plesk eintragen
};

console.log("=== SMTP Test ===");
console.log(`Host:  ${CONFIG.host}:${CONFIG.port}`);
console.log(`User:  ${CONFIG.user}`);
console.log(`Pass:  ${CONFIG.pass.substring(0, 3)}***\n`);

async function testConfig(label, options) {
  process.stdout.write(`[${label}] Teste... `);
  try {
    const transporter = nodemailer.createTransport(options);
    await transporter.verify();
    console.log("✅ ERFOLGREICH");
    return true;
  } catch (err) {
    console.log(`❌ FEHLER: ${err.message}`);
    return false;
  }
}

const base = {
  host: CONFIG.host,
  auth: { user: CONFIG.user, pass: CONFIG.pass },
  tls: { rejectUnauthorized: false },
};

let success = false;

// Test 1: PORT 587, STARTTLS, kein authMethod
success = await testConfig("Port 587 STARTTLS auto", {
  ...base, port: 587, secure: false,
});

// Test 2: PORT 587, STARTTLS, AUTH LOGIN
if (!success) {
  success = await testConfig("Port 587 STARTTLS LOGIN", {
    ...base, port: 587, secure: false, authMethod: "LOGIN",
  });
}

// Test 3: PORT 587, STARTTLS, AUTH PLAIN
if (!success) {
  success = await testConfig("Port 587 STARTTLS PLAIN", {
    ...base, port: 587, secure: false, authMethod: "PLAIN",
  });
}

// Test 4: PORT 465, SSL
if (!success) {
  success = await testConfig("Port 465 SSL", {
    ...base, port: 465, secure: true,
  });
}

// Test 5: PORT 25 (ohne Auth)
if (!success) {
  await testConfig("Port 25 kein Auth", {
    host: CONFIG.host, port: 25, secure: false,
    tls: { rejectUnauthorized: false },
  });
}

if (!success) {
  console.log("\n⚠️  Alle Tests fehlgeschlagen.");
  console.log("   Bitte überprüfe in Plesk/cPanel:");
  console.log(`   → Existiert das Postfach '${CONFIG.user}'?`);
  console.log(`   → Ist das Passwort korrekt?`);
  console.log("   → Eventuell benötigt das Konto ein App-Passwort?");
}
