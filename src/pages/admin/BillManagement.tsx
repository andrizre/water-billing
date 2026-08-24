import React, { useState, useEffect, useCallback } from 'react';
import {
  Receipt,
  Plus,
  Search,
  Download,
  Printer,
  Sparkles,
  FileSpreadsheet,
  Share2,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Layers
} from 'lucide-react';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { DataTable } from '../../components/common/DataTable';
import { Pagination } from '../../components/common/Pagination';
import { BillInvoiceModal } from '../../components/print/BillInvoicePrint';
import { MassBillPrintModal } from '../../components/print/MassBillPrintModal';
import { useDebounce } from '../../hooks/useDebounce';
import { usePagination } from '../../hooks/usePagination';
import { useToast } from '../../context/ToastContext';
import { useSettings } from '../../context/SettingsContext';
import { api } from '../../services/api';
import { exportToCsv } from '../../utils/exportCsv';
import { Bill } from '../../types';
import { formatRupiah, formatM3, formatDate, formatPeriod, INDONESIAN_MONTHS } from '../../utils/formatters';
import { usePageTitle } from '../../hooks/usePageTitle';

export const BillManagement: React.FC = () => {
  usePageTitle('Manajemen Tagihan Air', 'Kelola rekening tagihan air warga, status pembayaran, denda, dan pencetakan faktur massal.');
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [monthFilter, setMonthFilter] = useState<string>('8');
  const [yearFilter, setYearFilter] = useState<string>('2026');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [rtFilter, setRtFilter] = useState<string>('');

  // Modals
  const [batchModalOpen, setBatchModalOpen] = useState<boolean>(false);
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [invoiceModalOpen, setInvoiceModalOpen] = useState<boolean>(false);
  const [batchGenerating, setBatchGenerating] = useState<boolean>(false);
  const [massPrintModalOpen, setMassPrintModalOpen] = useState<boolean>(false);

  // Batch Generator Form
  const [batchMonth, setBatchMonth] = useState<string>('8');
  const [batchYear, setBatchYear] = useState<string>('2026');

  const debouncedSearch = useDebounce(search, 300);
  const { success, error: toastError } = useToast();
  const { settings } = useSettings();

  const fetchBills = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getBills({
        search: debouncedSearch,
        period_month: monthFilter,
        period_year: yearFilter,
        status: statusFilter
      });
      let filtered = data || [];
      if (rtFilter) {
        filtered = filtered.filter((b: Bill) => b.rt_rw === rtFilter);
      }
      setBills(filtered);
    } catch (err: any) {
      toastError(err.message || 'Gagal memuat daftar tagihan.');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, monthFilter, yearFilter, statusFilter, rtFilter, toastError]);

  useEffect(() => {
    fetchBills();
  }, [fetchBills]);

  const pagination = usePagination(bills, { initialPageSize: 10 });

  const handleGenerateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setBatchGenerating(true);
    try {
      const res = await api.generateBatchBills(Number(batchMonth), Number(batchYear));
      success(`Berhasil membuat ${res.generated_count || 0} tagihan baru.`);
      setBatchModalOpen(false);
      fetchBills();
    } catch (err: any) {
      toastError(err.message || 'Gagal melakukan generate tagihan massal.');
    } finally {
      setBatchGenerating(false);
    }
  };

  const handleExportCsv = () => {
    const headers = ['No. Tagihan', 'No. Pelanggan', 'Nama Pelanggan', 'RT/RW', 'Periode', 'Pakai (m3)', 'Total Tagihan', 'Dibayar', 'Sisa', 'Jatuh Tempo', 'Status'];
    const rows = bills.map((b) => [
      b.bill_no,
      b.customer_no || '-',
      b.customer_name || '-',
      b.rt_rw || '-',
      `${b.period_month}/${b.period_year}`,
      b.usage_m3,
      b.total_amount,
      b.paid_amount,
      b.balance_due,
      b.due_date,
      b.status
    ]);
    exportToCsv(`laporan-tagihan-${monthFilter}-${yearFilter}`, headers, rows);
    success('Data tagihan berhasil diexport ke CSV.');
  };

  const handleSendSingleWhatsApp = (b: Bill) => {
    const custPhone = (b.phone || '').replace(/\D/g, '');
    let formattedPhone = custPhone;
    if (formattedPhone.startsWith('0')) {
      formattedPhone = '62' + formattedPhone.substring(1);
    }

    const message = `*PEMBERITAHUAN TAGIHAN AIR DESA*\n` +
      `*${settings.organization_name || 'BUMDes Tirta Sandmosquito'}*\n` +
      `--------------------------------\n` +
      `• No. Tagihan : ${b.bill_no}\n` +
      `• No. Pelanggan: ${b.customer_no || '-'}\n` +
      `• Nama Warga   : ${b.customer_name || '-'}\n` +
      `• Periode      : ${formatPeriod(b.period_month, b.period_year)}\n` +
      `• Total Pakai  : ${formatM3(b.usage_m3)}\n` +
      `• *TOTAL TAGIHAN*: *${formatRupiah(b.total_amount)}*\n` +
      `• Jatuh Tempo  : ${formatDate(b.due_date)}\n` +
      `--------------------------------\n` +
      `Mohon lakukan pembayaran sebelum tanggal jatuh tempo. Terima kasih.`;

    const waUrl = formattedPhone
      ? `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;

    window.open(waUrl, '_blank');
  };

  const monthOptions = [
    { label: 'Semua Bulan', value: '' },
    ...INDONESIAN_MONTHS.map((name, idx) => ({ label: name, value: String(idx + 1) }))
  ];

  const columns = [
    {
      header: 'No. Faktur Tagihan',
      render: (b: Bill) => (
        <div>
          <span style={{ fontWeight: 800, color: 'var(--primary-700)', fontSize: 13.5 }}>
            {b.bill_no}
          </span>
          <div style={{ fontSize: 11, color: 'var(--slate-500)' }}>
            Periode: <strong>{formatPeriod(b.period_month, b.period_year)}</strong>
          </div>
        </div>
      )
    },
    {
      header: 'Nama Pelanggan',
      render: (b: Bill) => (
        <div>
          <div style={{ fontWeight: 700, color: 'var(--slate-900)' }}>{b.customer_name}</div>
          <div style={{ fontSize: 11, color: 'var(--slate-500)' }}>
            {b.customer_no} ({b.rt_rw})
          </div>
        </div>
      )
    },
    {
      header: 'Pemakaian Air',
      render: (b: Bill) => (
        <div>
          <span style={{ fontWeight: 700, color: 'var(--slate-800)' }}>
            {formatM3(b.usage_m3)}
          </span>
          <div style={{ fontSize: 11, color: 'var(--slate-500)' }}>
            {b.prev_reading} → {b.current_reading} m³
          </div>
        </div>
      )
    },
    {
      header: 'Total Tagihan',
      render: (b: Bill) => (
        <div>
          {b.is_subsidized && b.original_amount && b.original_amount > b.total_amount && (
            <div style={{ fontSize: 11, color: 'var(--slate-400)', textDecoration: 'line-through' }}>
              {formatRupiah(b.original_amount)}
            </div>
          )}
          <div style={{ fontWeight: 800, color: b.total_amount === 0 ? 'var(--success-700)' : 'var(--slate-900)' }}>
            {b.total_amount === 0 ? 'Gratis (Rp 0)' : formatRupiah(b.total_amount)}
          </div>
          {b.is_subsidized && (
            <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--success-700)' }}>
              {b.subsidy_type === 'gratis' ? '★ Subsidi 100%' : `★ Subsidi: -${formatRupiah(b.subsidy_amount || 0)}`}
            </div>
          )}
          {b.balance_due > 0 && b.status !== 'Lunas' && (
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--danger-600)' }}>
              Sisa: {formatRupiah(b.balance_due)}
            </div>
          )}
        </div>
      )
    },
    {
      header: 'Jatuh Tempo',
      render: (b: Bill) => (
        <span style={{ fontSize: 12.5, color: 'var(--slate-600)' }}>
          {formatDate(b.due_date)}
        </span>
      )
    },
    {
      header: 'Status',
      render: (b: Bill) => <Badge status={b.status} />
    },
    {
      header: 'Aksi',
      align: 'right' as const,
      render: (b: Bill) => (
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={() => handleSendSingleWhatsApp(b)}
            title="Kirim pemberitahuan tagihan ke WhatsApp warga"
            style={{
              padding: '6px 8px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--success-500)',
              backgroundColor: 'var(--success-50)',
              color: 'var(--success-700)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center'
            }}
          >
            <Share2 size={13} />
          </button>
          <Button
            size="sm"
            variant="secondary"
            icon={<Printer size={13} />}
            onClick={() => {
              setSelectedBill(b);
              setInvoiceModalOpen(true);
            }}
          >
            Faktur
          </Button>
        </div>
      )
    }
  ];

  return (
    <div>
      <PageHeader
        title="Manajemen Tagihan Air (Billing)"
        subtitle="Daftar rekening air warga, status pembayaran, denda keterlambatan, dan pencetakan faktur tagihan."
        action={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button variant="secondary" icon={<Printer size={16} />} onClick={() => setMassPrintModalOpen(true)}>
              Cetak Massal Faktur
            </Button>
            <Button variant="secondary" icon={<Download size={16} />} onClick={handleExportCsv}>
              Export CSV
            </Button>
            <Button
              variant="primary"
              icon={<Sparkles size={16} />}
              onClick={() => setBatchModalOpen(true)}
            >
              Generate Massal Bulanan
            </Button>
          </div>
        }
      />

      {/* Quick Status Filter Tabs */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {[
          { label: 'Semua Status', value: '' },
          { label: 'Belum Dibayar', value: 'Belum Dibayar' },
          { label: 'Jatuh Tempo (Menunggak)', value: 'Jatuh Tempo' },
          { label: 'Sebagian Dibayar', value: 'Sebagian Dibayar' },
          { label: 'Lunas', value: 'Lunas' }
        ].map((tab) => {
          const isActive = statusFilter === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => setStatusFilter(tab.value)}
              className={`filter-pill ${isActive ? 'active' : ''}`}
              style={{
                padding: '6px 14px',
                borderRadius: 9999,
                fontSize: 12.5,
                fontWeight: 600,
                cursor: 'pointer',
                border: isActive ? '1px solid var(--primary-600)' : '1px solid var(--slate-300)',
                backgroundColor: isActive ? 'var(--primary-600)' : 'var(--slate-50)',
                color: isActive ? '#ffffff' : 'var(--slate-700)',
                transition: 'all 0.15s ease'
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Filter Bar */}
      <Card bodyClassName="p-4" style={{ marginBottom: 20 }}>
        <div className="filter-bar" style={{ margin: 0 }}>
          <div className="filter-group" style={{ flex: 1, minWidth: 260 }}>
            <div style={{ width: '100%', maxWidth: 360 }}>
              <Input
                placeholder="Cari nomor tagihan atau nama pelanggan..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                leftIcon={<Search size={16} />}
              />
            </div>
          </div>

          <div className="filter-group">
            <div style={{ width: 140 }}>
              <Select
                options={monthOptions}
                value={monthFilter}
                onChange={(e) => setMonthFilter(e.target.value)}
              />
            </div>

            <div style={{ width: 110 }}>
              <Select
                options={[
                  { label: '2026', value: '2026' },
                  { label: '2025', value: '2025' }
                ]}
                value={yearFilter}
                onChange={(e) => setYearFilter(e.target.value)}
              />
            </div>

            <div style={{ width: 160 }}>
              <Select
                options={[
                  { label: 'Semua RT / Wilayah', value: '' },
                  { label: 'RT 01 / RW 01', value: 'RT 01 / RW 01' },
                  { label: 'RT 02 / RW 01', value: 'RT 02 / RW 01' },
                  { label: 'RT 03 / RW 02', value: 'RT 03 / RW 02' },
                  { label: 'RT 04 / RW 02', value: 'RT 04 / RW 02' }
                ]}
                value={rtFilter}
                onChange={(e) => setRtFilter(e.target.value)}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Bills Table */}
      <Card>
        <DataTable
          columns={columns}
          data={pagination.paginatedItems}
          loading={loading}
          emptyTitle="Tidak Ada Tagihan"
          emptyMessage="Belum ada tagihan yang dibuat untuk periode filter yang dipilih."
        />
        <Pagination
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          totalItems={pagination.totalItems}
          pageSize={pagination.pageSize}
          onPageChange={pagination.goToPage}
        />
      </Card>

      {/* Batch Bill Generation Modal */}
      <Modal
        isOpen={batchModalOpen}
        onClose={() => setBatchModalOpen(false)}
        size="md"
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sparkles size={20} color="var(--primary-600)" />
            <span>Generate Tagihan Massal Otomatis</span>
          </div>
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setBatchModalOpen(false)} disabled={batchGenerating}>
              Batal
            </Button>
            <Button variant="primary" onClick={handleGenerateBatch} loading={batchGenerating}>
              Mulai Generate Tagihan
            </Button>
          </>
        }
      >
        <form onSubmit={handleGenerateBatch}>
          <p style={{ fontSize: 13.5, color: 'var(--slate-600)', marginBottom: 16, lineHeight: 1.6 }}>
            Fitur ini akan secara otomatis menghitung volume pemakaian air dan membuatkan faktur tagihan untuk <strong>seluruh pelanggan aktif</strong> yang telah memiliki data pencatatan meter pada periode yang dipilih.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Select
              label="Periode Bulan"
              options={INDONESIAN_MONTHS.map((name, idx) => ({ label: name, value: String(idx + 1) }))}
              value={batchMonth}
              onChange={(e) => setBatchMonth(e.target.value)}
              required
            />
            <Select
              label="Periode Tahun"
              options={[
                { label: '2026', value: '2026' },
                { label: '2025', value: '2025' }
              ]}
              value={batchYear}
              onChange={(e) => setBatchYear(e.target.value)}
              required
            />
          </div>

          <div
            style={{
              padding: 12,
              backgroundColor: 'var(--slate-50)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--slate-200)',
              marginTop: 14,
              fontSize: 12,
              color: 'var(--slate-600)'
            }}
          >
            💡 <em>Pelanggan yang sudah memiliki tagihan pada periode ini tidak akan diduplikasi.</em>
          </div>
        </form>
      </Modal>

      {/* Bill Invoice Modal for Single Printing */}
      <BillInvoiceModal
        isOpen={invoiceModalOpen}
        onClose={() => setInvoiceModalOpen(false)}
        bill={selectedBill}
      />

      {/* Advanced Mass Print Modal (2-Up Invoices & Master Ledger Table) */}
      <MassBillPrintModal
        isOpen={massPrintModalOpen}
        onClose={() => setMassPrintModalOpen(false)}
        bills={bills}
        selectedMonth={monthFilter}
        selectedYear={yearFilter}
        selectedRt={rtFilter}
      />
    </div>
  );
};
