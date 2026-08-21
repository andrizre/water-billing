import React from 'react';
import { LoadingSpinner } from './LoadingSpinner';
import { EmptyState } from './EmptyState';

export interface Column<T> {
  header: string;
  accessor?: keyof T;
  render?: (item: T, index: number) => React.ReactNode;
  width?: string | number;
  align?: 'left' | 'center' | 'right';
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  emptyMessage?: string;
  emptyTitle?: string;
  keyExtractor?: (item: T, index: number) => string | number;
}

export function DataTable<T>({
  columns,
  data,
  loading = false,
  emptyMessage = 'Tidak ada data yang ditemukan.',
  emptyTitle = 'Belum Ada Data',
  keyExtractor
}: DataTableProps<T>) {
  if (loading) {
    return <LoadingSpinner text="Memuat data tabel..." />;
  }

  if (!data || data.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyMessage} />;
  }

  return (
    <div className="table-responsive">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((col, idx) => (
              <th
                key={idx}
                style={{
                  width: col.width,
                  textAlign: col.align || 'left'
                }}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((item, rowIdx) => {
            const rowKey = keyExtractor
              ? keyExtractor(item, rowIdx)
              : (item as any)?.id || rowIdx;

            return (
              <tr key={rowKey}>
                {columns.map((col, colIdx) => {
                  let cellContent: React.ReactNode;
                  if (col.render) {
                    cellContent = col.render(item, rowIdx);
                  } else if (col.accessor) {
                    cellContent = (item as any)[col.accessor] as React.ReactNode;
                  } else {
                    cellContent = null;
                  }

                  return (
                    <td
                      key={colIdx}
                      style={{ textAlign: col.align || 'left' }}
                    >
                      {cellContent ?? '-'}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
