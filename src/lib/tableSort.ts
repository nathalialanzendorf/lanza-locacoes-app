export type SortDirection = "asc" | "desc";

export type SortableValue = string | number | boolean | null | undefined;

const DATE_BR_RE = /^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?/;

export function parseSortableDate(value: string): number | null {
  const m = value.trim().match(DATE_BR_RE);
  if (!m) return null;
  const [, d, mo, y, h = "0", mi = "0", s = "0"] = m;
  const ts = new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s)).getTime();
  return Number.isNaN(ts) ? null : ts;
}

function isEmptySortValue(value: SortableValue): boolean {
  return value == null || value === "";
}

export function compareSortValues(a: SortableValue, b: SortableValue): number {
  if (isEmptySortValue(a) && isEmptySortValue(b)) return 0;
  if (isEmptySortValue(a)) return 1;
  if (isEmptySortValue(b)) return -1;

  if (typeof a === "boolean" && typeof b === "boolean") {
    return Number(a) - Number(b);
  }

  if (typeof a === "number" && typeof b === "number") {
    if (Number.isNaN(a) && Number.isNaN(b)) return 0;
    if (Number.isNaN(a)) return 1;
    if (Number.isNaN(b)) return -1;
    return a - b;
  }

  const aStr = String(a).trim();
  const bStr = String(b).trim();

  const aDate = parseSortableDate(aStr);
  const bDate = parseSortableDate(bStr);
  if (aDate != null && bDate != null) return aDate - bDate;

  const aIso = Date.parse(aStr);
  const bIso = Date.parse(bStr);
  if (!Number.isNaN(aIso) && !Number.isNaN(bIso) && /\d{4}-\d{2}-\d{2}/.test(aStr)) {
    return aIso - bIso;
  }

  return aStr.localeCompare(bStr, "pt-BR", { sensitivity: "base", numeric: true });
}

export function sortRows<T>(
  rows: T[],
  sortValue: (row: T) => SortableValue,
  direction: SortDirection,
): T[] {
  const factor = direction === "asc" ? 1 : -1;
  return [...rows].sort((left, right) => factor * compareSortValues(sortValue(left), sortValue(right)));
}

export function resolveRowSortValue<T extends object>(
  row: T,
  key: string,
): SortableValue {
  if (!(key in row)) return "";
  const value = (row as Record<string, unknown>)[key];
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (value == null) return "";
  return String(value);
}

export function columnSortable(key: string, header: string, sortable?: boolean): boolean {
  if (sortable === false) return false;
  if (sortable === true) return true;
  if (key === "acoes" || key === "sel") return false;
  if (!header.trim()) return false;
  return true;
}
