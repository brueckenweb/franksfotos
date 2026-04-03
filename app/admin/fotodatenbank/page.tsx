/**
 * Redirect: /admin/fotodatenbank → /fotodatenbank
 * Die Fotodatenbank-Eingabe ist nun eine eigenständige Seite.
 */

import { redirect } from "next/navigation";

export default function FotodatenbankRedirect() {
  redirect("/fotodatenbank");
}
