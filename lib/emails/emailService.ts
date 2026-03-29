import { mailer } from "./mailer";

const FROM = process.env.EMAIL_FROM || "FranksFotos <fotogalerie@frank-sellke.de>";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "fotogalerie@frank-sellke.de";

// ─────────────────────────────────────────────────────────────────────────────
// 1. Admin-Benachrichtigung: Neuer Nutzer hat sich registriert
// ─────────────────────────────────────────────────────────────────────────────
export async function sendNewUserNotificationToAdmin(
  userName: string,
  userEmail: string
) {
  try {
    await mailer.sendMail({
      from: FROM,
      to: ADMIN_EMAIL,
      subject: "🆕 Neuer Nutzer registriert – FranksFotos",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #1a1a2e; padding: 24px; border-radius: 8px 8px 0 0;">
            <h1 style="color: #f59e0b; margin: 0; font-size: 20px;">📸 FranksFotos</h1>
          </div>
          <div style="background: #f9fafb; padding: 24px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb;">
            <h2 style="color: #111827; font-size: 18px;">Neuer Nutzer registriert</h2>
            <p style="color: #374151;">Ein neuer Nutzer hat sich soeben auf FranksFotos angemeldet:</p>
            <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
              <tr>
                <td style="padding: 8px; font-weight: bold; color: #6b7280; width: 120px;">Name:</td>
                <td style="padding: 8px; color: #111827;">${userName}</td>
              </tr>
              <tr style="background: #f3f4f6;">
                <td style="padding: 8px; font-weight: bold; color: #6b7280;">E-Mail:</td>
                <td style="padding: 8px; color: #111827;">${userEmail}</td>
              </tr>
              <tr>
                <td style="padding: 8px; font-weight: bold; color: #6b7280;">Zeitpunkt:</td>
                <td style="padding: 8px; color: #111827;">${new Date().toLocaleString("de-DE", { timeZone: "Europe/Berlin" })}</td>
              </tr>
            </table>
            <a href="${process.env.NEXTAUTH_URL || "https://www.frank-sellke.de"}/admin/benutzer"
               style="display: inline-block; background: #f59e0b; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: bold;">
              Zur Benutzerverwaltung
            </a>
          </div>
          <p style="color: #9ca3af; font-size: 12px; margin-top: 16px; text-align: center;">
            Diese Nachricht wurde automatisch von FranksFotos generiert.
          </p>
        </div>
      `,
    });
    console.log(`[Email] Admin-Benachrichtigung gesendet für neuen Nutzer: ${userEmail}`);
  } catch (error) {
    console.error("[Email] Fehler beim Senden der Admin-Benachrichtigung:", error);
    // Fehler nicht weiterwerfen – Registrierung soll trotzdem klappen
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Bestätigungsmail an neuen Nutzer
// ─────────────────────────────────────────────────────────────────────────────
export async function sendWelcomeEmailToUser(
  userName: string,
  userEmail: string
) {
  try {
    await mailer.sendMail({
      from: FROM,
      to: userEmail,
      subject: "Willkommen bei FranksFotos! 📸",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #1a1a2e; padding: 24px; border-radius: 8px 8px 0 0;">
            <h1 style="color: #f59e0b; margin: 0; font-size: 20px;">📸 FranksFotos</h1>
          </div>
          <div style="background: #f9fafb; padding: 24px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb;">
            <h2 style="color: #111827; font-size: 22px;">Willkommen, ${userName}! 🎉</h2>
            <p style="color: #374151; font-size: 15px; line-height: 1.6;">
              Schön, dass du dabei bist! Deine Registrierung auf <strong>FranksFotos</strong> war erfolgreich.
            </p>
            <p style="color: #374151; font-size: 15px; line-height: 1.6;">
              Du kannst dich ab sofort mit deiner E-Mail-Adresse und deinem Passwort anmelden und 
              die Fotogalerie in vollem Umfang nutzen.
            </p>
            <div style="margin: 24px 0; text-align: center;">
              <a href="${process.env.NEXTAUTH_URL || "https://www.frank-sellke.de"}/login"
                 style="display: inline-block; background: #f59e0b; color: white; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 16px;">
                Jetzt anmelden
              </a>
            </div>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
            <p style="color: #6b7280; font-size: 13px;">
              Falls du dich nicht registriert hast, kannst du diese E-Mail ignorieren.
            </p>
          </div>
          <p style="color: #9ca3af; font-size: 12px; margin-top: 16px; text-align: center;">
            FranksFotos · <a href="${process.env.NEXTAUTH_URL || "https://www.frank-sellke.de"}" style="color: #9ca3af;">www.frank-sellke.de</a>
          </p>
        </div>
      `,
    });
    console.log(`[Email] Willkommensmail gesendet an: ${userEmail}`);
  } catch (error) {
    console.error("[Email] Fehler beim Senden der Willkommensmail:", error);
    // Fehler nicht weiterwerfen – Registrierung soll trotzdem klappen
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Massen-Email an mehrere Empfänger (vom Admin)
// ─────────────────────────────────────────────────────────────────────────────
export interface BroadcastResult {
  sent: number;
  failed: number;
  errors: string[];
}

export async function sendBroadcastEmail(
  subject: string,
  htmlContent: string,
  recipients: { name: string; email: string }[]
): Promise<BroadcastResult> {
  const result: BroadcastResult = { sent: 0, failed: 0, errors: [] };

  for (const recipient of recipients) {
    try {
      await mailer.sendMail({
        from: FROM,
        to: recipient.email,
        subject,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #1a1a2e; padding: 24px; border-radius: 8px 8px 0 0;">
              <h1 style="color: #f59e0b; margin: 0; font-size: 20px;">📸 FranksFotos</h1>
            </div>
            <div style="background: #f9fafb; padding: 24px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb;">
              ${htmlContent}
            </div>
            <p style="color: #9ca3af; font-size: 12px; margin-top: 16px; text-align: center;">
              FranksFotos · <a href="${process.env.NEXTAUTH_URL || "https://www.frank-sellke.de"}" style="color: #9ca3af;">www.frank-sellke.de</a>
            </p>
          </div>
        `,
      });
      result.sent++;
    } catch (error) {
      result.failed++;
      result.errors.push(`${recipient.email}: ${error instanceof Error ? error.message : String(error)}`);
      console.error(`[Email] Fehler beim Senden an ${recipient.email}:`, error);
    }
  }

  console.log(`[Email] Broadcast abgeschlossen: ${result.sent} gesendet, ${result.failed} fehlgeschlagen`);
  return result;
}
