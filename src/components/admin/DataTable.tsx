'use client';

import { useMemo, useState } from 'react';
import { Download, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface DataTableColumn<T> {
  key: string;
  header: string;
  align?: 'left' | 'right' | 'center';
  render: (row: T) => React.ReactNode;
  csvValue?: (row: T) => string | number;
  searchValue?: (row: T) => string;
}

interface DataTableProps<T> {
  rows: T[];
  columns: DataTableColumn<T>[];
  rowKey: (row: T) => string;
  searchPlaceholder?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  csvFilename?: string;
  actions?: React.ReactNode;
}

function escapeCsv(val: string | number): string {
  const str = String(val ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  searchPlaceholder = 'Search…',
  emptyTitle = 'No records found',
  emptyDescription = 'Try adjusting your search or add a new record.',
  csvFilename,
  actions,
}: DataTableProps<T>) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      columns.some((col) => {
        const val = col.searchValue
          ? col.searchValue(row)
          : col.csvValue
            ? String(col.csvValue(row))
            : '';
        return val.toLowerCase().includes(q);
      })
    );
  }, [rows, columns, query]);

  const handleExportCsv = () => {
    if (!csvFilename) return;
    const headers = columns.map((c) => escapeCsv(c.header)).join(',');
    const body = filtered
      .map((row) =>
        columns
          .map((c) => {
            const raw = c.csvValue ? c.csvValue(row) : c.searchValue ? c.searchValue(row) : '';
            return escapeCsv(raw);
          })
          .join(',')
      )
      .join('\n');
    const blob = new Blob([`${headers}\n${body}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = csvFilename.endsWith('.csv') ? csvFilename : `${csvFilename}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="rounded-2xl border border-border-warm bg-white shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-warm px-4 py-3">
        <div className="relative min-w-[220px] flex-1 max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-smoke" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full rounded-xl border border-border-warm bg-cream py-2 pl-9 pr-3 text-sm text-char placeholder:text-smoke/70 focus:border-ember focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-smoke tabular-nums">
            {filtered.length} {filtered.length === 1 ? 'row' : 'rows'}
          </span>
          {csvFilename && (
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border-warm bg-cream px-3 py-2 text-xs font-semibold text-char transition hover:bg-cream-deep"
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </button>
          )}
          {actions}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <p className="font-display text-base font-semibold text-char">{emptyTitle}</p>
          <p className="mt-1 text-sm text-smoke">{emptyDescription}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border-warm bg-cream/70 text-xs font-semibold uppercase tracking-wider text-smoke">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={cn(
                      'px-4 py-3 whitespace-nowrap',
                      col.align === 'right' && 'text-right',
                      col.align === 'center' && 'text-center'
                    )}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border-warm/60">
              {filtered.map((row) => (
                <tr key={rowKey(row)} className="transition hover:bg-cream/40">
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        'px-4 py-3 align-middle',
                        col.align === 'right' && 'text-right',
                        col.align === 'center' && 'text-center'
                      )}
                    >
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
