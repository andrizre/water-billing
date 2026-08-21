/**
 * Indonesian Localization and Formatting Utilities
 */

/**
 * Format number to Indonesian Rupiah currency string (e.g. Rp 25.000)
 */
export function formatRupiah(amount: number | string | null | undefined): string {
  const num = Number(amount || 0);
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(num);
}

/**
 * Format cubic meters (e.g. 15 m³)
 */
export function formatM3(usage: number | string | null | undefined): string {
  const num = Number(usage || 0);
  return `${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(num)} m³`;
}

/**
 * Month names in Indonesian
 */
export const INDONESIAN_MONTHS = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember'
];

/**
 * Get Indonesian month name (1 = Januari)
 */
export function getIndonesianMonth(month: number): string {
  if (month < 1 || month > 12) return '';
  return INDONESIAN_MONTHS[month - 1];
}

/**
 * Format period as "Agustus 2026"
 */
export function formatPeriod(month: number | string, year: number | string): string {
  const m = Number(month);
  const y = Number(year);
  return `${getIndonesianMonth(m)} ${y}`;
}

/**
 * Format date string into Indonesian readable format (e.g. 21 Agustus 2026)
 */
export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '-';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return String(dateString);
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(d);
  } catch {
    return String(dateString);
  }
}

/**
 * Format date & time into Indonesian readable format (e.g. 21 Agustus 2026, 14:30 WIB)
 */
export function formatDateTime(dateString: string | null | undefined): string {
  if (!dateString) return '-';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return String(dateString);
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(d) + ' WIB';
  } catch {
    return String(dateString);
  }
}
