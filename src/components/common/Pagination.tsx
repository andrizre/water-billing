import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange
}) => {
  if (totalPages <= 1 && totalItems <= pageSize) return null;

  const startItem = Math.min((currentPage - 1) * pageSize + 1, totalItems);
  const endItem = Math.min(currentPage * pageSize, totalItems);

  return (
    <div className="pagination-container">
      <div className="pagination-info">
        Menampilkan <strong>{startItem}</strong> - <strong>{endItem}</strong> dari{' '}
        <strong>{totalItems}</strong> data
      </div>
      <div className="pagination-controls">
        <button
          type="button"
          className="pagination-btn"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          aria-label="Halaman Sebelumnya"
        >
          <ChevronLeft size={16} />
        </button>

        {Array.from({ length: totalPages }, (_, i) => i + 1)
          .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
          .map((page, idx, arr) => {
            const showEllipsis = idx > 0 && page - arr[idx - 1] > 1;
            return (
              <React.Fragment key={page}>
                {showEllipsis && <span className="pagination-ellipsis">...</span>}
                <button
                  type="button"
                  className={`pagination-btn ${currentPage === page ? 'active' : ''}`}
                  onClick={() => onPageChange(page)}
                >
                  {page}
                </button>
              </React.Fragment>
            );
          })}

        <button
          type="button"
          className="pagination-btn"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          aria-label="Halaman Selanjutnya"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
};
