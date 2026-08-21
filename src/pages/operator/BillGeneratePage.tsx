import React, { useState, useEffect, useCallback } from 'react';
import {
  FileSpreadsheet,
  Sparkles,
  Search,
  Printer,
  CheckCircle2
} from 'lucide-react';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Select } from '../../components/common/Select';
import { Input } from '../../components/common/Input';
import { Badge } from '../../components/common/Badge';
import { DataTable } from '../../components/common/DataTable';
import { Pagination } from '../../components/common/Pagination';
import { BillInvoiceModal } from '../../components/print/BillInvoicePrint';
import { usePagination } from '../../hooks/usePagination';
import { useToast } from '../../context/ToastContext';
import { api } from '../../services/api';
import { Bill } from '../../types';
import { formatRupiah, formatM3, formatDate, formatPeriod, INDONESIAN_MONTHS } from '../../utils/formatters';

export const BillGeneratePage: React.FC = () => {
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [batchMonth, setBatchMonth] = useState<string>('8');
  const [batchYear, setBatchYear] = useState<string>('2026');
  const [generating, setGenerating] = useState<boolean>(false);

  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [invoiceModalOpen, setInvoiceModalOpen] = useState<boolean>(false);

  const { success, error: toastError } = useToast();

  const fetchBills = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getBills({
        period_month: batchMonth,
        period_year: batchYear
      });
      setBills(data);
    } catch (err: any) {
      toastError(err.message || 'Gagal memuat tagihan.');
    } finally {
      setLoading(false);
    }
  }, [batchMonth, batchYear, toastError]);

  useEffect(() => {
    fetchBills();
  }, [fetchBills]);

  const handleGenerateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenerating(true);
    try {
      const res = await api.generateBatchBills(Number(batchMonth), Number(batchYear));
      success(`Selesai! ${res.generated_count || 0} tagihan baru berhasil dibuat.`);
      fetchBills();
    } catch (err: any) {
      toastError(err.message || 'Gagal melakukan generate tagihan.');
    } finally {
      setGenerating(false);
    }
  };

  const pagination = usePagination(bills, { initialPageSize: 10 });

  const columns = [
    {
      header: 'No. Faktur',
      render: (b: Bill) => <strong>{b.bill_no}</strong>
    },
    {
      header: 'Nama Pelanggan',
      render: (b: Bill) => (
        <div>
          <div style={{ fontWeight: 700 }}>{b.customer_name}</div>
          <div style={{ fontSize: 11, color: 'var(--slate-500)' }}>{b.customer_no} ({b.rt_rw})</div>
        </div>
      )
    },
    {
      header: 'Volume Air',
      render: (b: Bill) => (
        <div>
          <span style={{ fontWeight: 700 }}>{formatM3(b.usage_m3)}</span>
          <div style={{ fontSize: 11, color: 'var(--slate-500)' }}>{b.prev_reading} → {b.current_reading} m³</div>
        </div>
      )
    },
    {
      header: 'Total Tagihan',
      render: (b: Bill) => (
        <span style={{ fontWeight: 800, color: 'var(--slate-900)', fontSize: 14 }}>
          {formatRupiah(b.total_amount)}
        </span>
      )
    },
    {
      header: 'Jatuh Tempo',
      render: (b: Bill) => formatDate(b.due_date)
    },
    {
      header: 'Status',
      render: (b: Bill) => <Badge status={b.status} />
    },
    {
      header: 'Aksi',
      align: 'right' as const,
      render: (b: Bill) => (
        <Button
          size="sm"
          variant="secondary"
          icon={<Printer size={13} />}
          onClick={() => {
            setSelectedBill(b);
            setInvoiceModalOpen(true);
          }}
        >
          Cetak Faktur
        </Button>
      )
    }
  ];

  return (
    <div>
      <PageHeader
        title="Pembuatan & Generate Tagihan Air"
        subtitle="Pembuatan faktur rekening air bulanan berdasarkan angka pencatatan meter yang telah terinput."
      />

      {/* Generator Control Card */}
      <Card
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sparkles size={18} color="var(--primary-600)" />
            <span>Generate Tagihan Massal Per Periode</span>
          </div>
        }
        subtitle="Sistem akan memeriksa semua pelanggan yang telah memiliki angka meter dan belum memiliki faktur tagihan"
        style={{ marginBottom: 24 }}
      >
        <form onSubmit={handleGenerateBatch}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 14 }}>
            <div style={{ width: 160 }}>
              <Select
                label="Bulan Tagihan"
                options={INDONESIAN_MONTHS.map((m, idx) => ({ label: m, value: String(idx + 1) }))}
                value={batchMonth}
                onChange={(e) => setBatchMonth(e.target.value)}
                required
              />
            </div>

            <div style={{ width: 120 }}>
              <Select
                label="Tahun"
                options={[
                  { label: '2026', value: '2026' },
                  { label: '2025', value: '2025' }
                ]}
                value={batchYear}
                onChange={(e) => setBatchYear(e.target.value)}
                required
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              icon={<Sparkles size={16} />}
              loading={generating}
              style={{ marginBottom: 16 }}
            >
              Generate Tagihan Periode Ini
            </Button>
          </div>
        </form>
      </Card>

      {/* Result Bills Table */}
      <Card title={`Daftar Tagihan Periode ${formatPeriod(batchMonth, batchYear)} (${bills.length} Tagihan)`}>
        <DataTable
          columns={columns}
          data={pagination.paginatedItems}
          loading={loading}
          emptyTitle="Belum Ada Tagihan"
          emptyMessage="Klik tombol Generate Tagihan di atas untuk membuat faktur periode ini."
        />
        <Pagination
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          totalItems={pagination.totalItems}
          pageSize={pagination.pageSize}
          onPageChange={pagination.goToPage}
        />
      </Card>

      <BillInvoiceModal
        isOpen={invoiceModalOpen}
        onClose={() => setInvoiceModalOpen(false)}
        bill={selectedBill}
      />
    </div>
  );
};
