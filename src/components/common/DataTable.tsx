import React from 'react';
import { LoadingSpinner } from './LoadingSpinner';
import { EmptyState } from './EmptyState';

export interface Column<T> {
  header: string;
  accessor?: keyof T;
  render?: (item: T, index: number) => React.ReactNode;
  width?: string | number;
  align?: 'left' | 'center' | 'right';
  hideOnMobile?: boolean;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  emptyMessage?: string;
  emptyTitle?: string;
  keyExtractor?: (item: T, index: number) => string | number;
  mobileCardView?: boolean;
}

export function DataTable<T>({
  columns,
  data,
  loading = false,
  emptyMessage = 'Tidak ada data yang ditemukan.',
  emptyTitle = 'Belum Ada Data',
  keyExtractor,
  mobileCardView = true
}: DataTableProps<T>) {
  if (loading) {
    return <LoadingSpinner text="Memuat data..." />;
  }

  if (!data || data.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyMessage} />;
  }

  return (
    <>
      {/* 1. Desktop & Tablet Standard Table View */}
      <div className="table-responsive desktop-only-table">
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
                <tr key={rowKey} className="row-hover-highlight">
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

      {/* 2. Mobile-First Card View (Auto-activates on screens <= 768px) */}
      {mobileCardView && (
        <div className="mobile-card-list">
          {data.map((item, rowIdx) => {
            const rowKey = keyExtractor
              ? keyExtractor(item, rowIdx)
              : (item as any)?.id || rowIdx;

            const primaryCol = columns[0];
            const actionCol = columns.find(c => c.header.toLowerCase().includes('aksi') || c.header.toLowerCase().includes('bayar'));
            const otherCols = columns.filter(c => c !== primaryCol && c !== actionCol && !c.hideOnMobile);

            return (
              <div key={rowKey} className="mobile-data-card">
                {/* Card Top: Primary Header & Action */}
                <div className="mobile-card-top">
                  <div className="mobile-card-primary">
                    {primaryCol?.render ? primaryCol.render(item, rowIdx) : (item as any)[primaryCol?.accessor || 'id']}
                  </div>
                  {actionCol && (
                    <div className="mobile-card-action">
                      {actionCol.render ? actionCol.render(item, rowIdx) : null}
                    </div>
                  )}
                </div>

                {/* Card Body: Key-Value pairs */}
                <div className="mobile-card-body">
                  {otherCols.map((col, cIdx) => {
                    let val = col.render ? col.render(item, rowIdx) : (item as any)[col.accessor || ''];
                    if (val === undefined || val === null) return null;

                    return (
                      <div key={cIdx} className="mobile-card-field">
                        <span className="mobile-field-label">{col.header}:</span>
                        <div className="mobile-field-value">{val}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
