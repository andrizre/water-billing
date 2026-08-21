/**
 * Export data array to downloadable CSV file
 */
export function exportToCsv(filename: string, headers: string[], rows: (string | number)[][]): void {
  const sanitizeCell = (cell: string | number | null | undefined): string => {
    if (cell === null || cell === undefined) return '""';
    const str = String(cell).replace(/"/g, '""');
    return `"${str}"`;
  };

  const headerLine = headers.map(sanitizeCell).join(',');
  const rowLines = rows.map((row) => row.map(sanitizeCell).join(','));
  const csvContent = '\uFEFF' + [headerLine, ...rowLines].join('\r\n'); // Add BOM for Excel UTF-8 compatibility

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.setAttribute('href', url);
  link.setAttribute('download', `${filename.endsWith('.csv') ? filename : filename + '.csv'}`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
