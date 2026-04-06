"use client";

/**
 * Rendert ein Datum in der lokalen Browser-Zeitzone.
 * Kann in Server-Komponenten verwendet werden, da es ein Client-Component ist.
 * Normalisiert MySQL-Zeitstempel ohne Timezone-Suffix (behandelt sie als UTC).
 */
export default function LocalDate({
  dateStr,
  options,
}: {
  dateStr: string;
  options?: Intl.DateTimeFormatOptions;
}) {
  // MySQL-Timestamps kommen manchmal ohne "Z"-Suffix → als UTC behandeln
  const normalized =
    dateStr && !dateStr.includes("Z") && !dateStr.includes("+")
      ? dateStr.replace(" ", "T") + "Z"
      : dateStr;

  const defaultOptions: Intl.DateTimeFormatOptions = {
    day: "2-digit",
    month: "long",
    year: "numeric",
  };

  try {
    return (
      <>
        {new Date(normalized).toLocaleString("de-DE", options ?? defaultOptions)}
      </>
    );
  } catch {
    return <>{dateStr}</>;
  }
}
