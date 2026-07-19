import { useMemo, useState, type ReactNode } from "react";

import {
  columnSortable,
  resolveRowSortValue,
  sortRows,
  type SortDirection,
  type SortableValue,
} from "@/lib/tableSort";

export type Column<T> = {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
  sortable?: boolean;
  sortValue?: (row: T) => SortableValue;
};

type Props<T> = {
  columns: Column<T>[];
  rows: T[];
  keyFn: (row: T) => string;
  emptyMessage?: string;
  loading?: boolean;
  selectedKey?: string | null;
  onRowClick?: (row: T) => void;
  rowClassName?: (row: T) => string | undefined;
  footer?: ReactNode;
  defaultSort?: { key: string; direction?: SortDirection };
};

function resolveColumnSortValue<T extends object>(col: Column<T>, row: T): SortableValue {
  if (col.sortValue) return col.sortValue(row);
  return resolveRowSortValue(row, col.key);
}

export function DataTable<T extends object>({
  columns,
  rows,
  keyFn,
  emptyMessage = "Nenhum registo encontrado.",
  loading,
  selectedKey,
  onRowClick,
  rowClassName,
  footer,
  defaultSort,
}: Props<T>) {
  const [sortKey, setSortKey] = useState<string | null>(defaultSort?.key ?? null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(defaultSort?.direction ?? "asc");

  const sortedRows = useMemo(() => {
    if (!sortKey) return rows;
    const col = columns.find((c) => c.key === sortKey);
    if (!col || !columnSortable(col.key, col.header, col.sortable)) return rows;
    return sortRows(rows, (row) => resolveColumnSortValue(col, row), sortDirection);
  }, [columns, rows, sortDirection, sortKey]);

  function toggleSort(col: Column<T>) {
    if (!columnSortable(col.key, col.header, col.sortable)) return;
    if (sortKey !== col.key) {
      setSortKey(col.key);
      setSortDirection("asc");
      return;
    }
    setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
  }

  if (loading) {
    return <div className="panel panel--loading">A carregar dados…</div>;
  }

  if (rows.length === 0) {
    return <div className="panel panel--empty">{emptyMessage}</div>;
  }

  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((col) => {
              const sortable = columnSortable(col.key, col.header, col.sortable);
              const isSorted = sortable && sortKey === col.key;
              return (
                <th
                  key={col.key}
                  className={[col.className, sortable ? "sortable" : undefined, isSorted ? "is-sorted" : undefined]
                    .filter(Boolean)
                    .join(" ")}
                  aria-sort={
                    isSorted ? (sortDirection === "asc" ? "ascending" : "descending") : sortable ? "none" : undefined
                  }
                >
                  {sortable ? (
                    <button
                      type="button"
                      className="data-table__sort-btn"
                      onClick={() => toggleSort(col)}
                    >
                      <span>{col.header}</span>
                      <span className="data-table__sort-indicator" aria-hidden>
                        {isSorted ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}
                      </span>
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row) => {
            const rowKey = keyFn(row);
            const selectable = Boolean(onRowClick);
            return (
              <tr
                key={rowKey}
                className={[selectedKey === rowKey ? "is-selected" : undefined, rowClassName?.(row)]
                  .filter(Boolean)
                  .join(" ")}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                tabIndex={selectable ? 0 : undefined}
                onKeyDown={
                  selectable
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onRowClick!(row);
                        }
                      }
                    : undefined
                }
                role={selectable ? "button" : undefined}
              >
                {columns.map((col) => (
                  <td key={col.key} className={col.className}>
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
        {footer ? <tfoot>{footer}</tfoot> : null}
      </table>
    </div>
  );
}
