import { useState, useMemo } from 'react';

export interface UsePaginationOptions {
  initialPage?: number;
  initialPageSize?: number;
}

export function usePagination<T>(items: T[], options: UsePaginationOptions = {}) {
  const [currentPage, setCurrentPage] = useState(options.initialPage || 1);
  const [pageSize, setPageSize] = useState(options.initialPageSize || 10);

  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  // Ensure current page doesn't exceed total pages
  const validPage = Math.min(currentPage, totalPages);

  const paginatedItems = useMemo(() => {
    const start = (validPage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, validPage, pageSize]);

  const goToPage = (page: number) => {
    const target = Math.max(1, Math.min(page, totalPages));
    setCurrentPage(target);
  };

  const nextPage = () => goToPage(validPage + 1);
  const prevPage = () => goToPage(validPage - 1);

  return {
    currentPage: validPage,
    pageSize,
    totalPages,
    totalItems,
    paginatedItems,
    goToPage,
    nextPage,
    prevPage,
    setPageSize
  };
}
