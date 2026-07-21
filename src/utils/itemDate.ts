export type FormattedItemTimestamp = {
  display: string;
  tooltip: string;
};

function parseZoteroTimestamp(value: string): Date | null {
  const trimmed = value.trim();
  const sqlMatch =
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?$/.exec(
      trimmed,
    );

  if (sqlMatch) {
    const milliseconds = Number(`0.${sqlMatch[7] || "0"}`) * 1000;
    const date = new Date(
      Date.UTC(
        Number(sqlMatch[1]),
        Number(sqlMatch[2]) - 1,
        Number(sqlMatch[3]),
        Number(sqlMatch[4]),
        Number(sqlMatch[5]),
        Number(sqlMatch[6]),
        milliseconds,
      ),
    );
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatItemTimestamp(
  value: string,
  locale: string,
): FormattedItemTimestamp {
  const date = parseZoteroTimestamp(value);
  if (!date) {
    return {
      display: value.trim().slice(0, 10),
      tooltip: value,
    };
  }

  return {
    display: date.toLocaleDateString(locale, {
      year: "2-digit",
      month: "2-digit",
      day: "2-digit",
    }),
    tooltip: date.toLocaleString(locale, {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }),
  };
}
