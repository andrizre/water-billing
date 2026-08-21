import React, { useState, useEffect, useCallback } from 'react';
import { Receipt, Printer, AlertTriangle, CheckCircle } from 'lucide-react';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { DataTable } from '../../components/common/DataTable';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { BillInvoiceModal } from '../../components/print/BillInvoicePrint';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { api } from '../../services/api';
import { Bill } from '../../types';
import { formatRupiah, formatM3, formatDate, formatPeriod } from '../../utils/formatters';

export const CustomerBillsPage: React.FC = () => {
  const { user } = useAuth();
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [invoiceModalOpen, setInvoiceModalOpen] = useState<boolean>(false);

  const { error: toastError } = useToast();

  const fetchBills = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getBills({ customer_id: user?.customerId });
      setBills(data);
    } catch (err: any) {
      toastError(err.message || 'Gagal memuat daftar tagihan.');
    } finally {
      setLoading(false);
    }
  }, [user?.customerId, toastError]);

  useEffect(() => {
    fetchBills();
  }, [fetchBills]);

  const totalUnpaid = bills
    .filter((b) => b.status !== 'Lunas')
    .reduce((acc, b) => acc + (b.balance_due || b.total_amount), 0);

  const columns = [
    {
      header: 'No. Faktur',
      render: (b: Bill) => (
        <span style={{ fontWeight: 800, color: 'var(--primary-700)' }}>{b.bill_no}</span>
      )
    },
    {
      header: 'Periode Tagihan',
      render: (b: Bill) => (
        <div>
          <div style={{ fontWeight: 700 }}>{formatPeriod(b.period_month, b.period_year)}</div>
          <div style={{ fontSize: 11, color: 'var(--slate-500)' }}>
            Jatuh Tempo: {formatDate(b.due_date)}
          </div>
        </div>
      )
    },
    {
      header: 'Pemakaian Air',
      render: (b: Bill) => (
        <div>
          <span style={{ fontWeight: 700 }}>{formatM3(b.usage_m3)}</span>
          <div style={{ fontSize: 11, color: 'var(--slate-500)' }}>
            {b.prev_reading} → {b.current_reading} m³
          </div>
        </div>
      )
    },
    {
      header: 'Total Tagihan',
      render: (b: Bill) => (
        <span style={{ fontWeight: 800, color: 'var(--slate-900)' }}>
          {formatRupiah(b.total_amount)}
        </span>
      )
    },
    {
      header: 'Status & Sisa',
      render: (b: Bill) => (
        <div>
          <Badge status={b.status} />
          {b.balance_due > 0 && b.status !== 'Lunas' && (
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--danger-700)', marginTop: 2 }}>
              Sisa: {formatRupiah(b.balance_due)}
            </div>
          )}
        </div>
      )
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
          Rincian & Cetak
        </Button>
      )
    }
  ];

  return (
    <div>
      <PageHeader
        title="Tagihan & Rekening Air Saya"
        subtitle="Daftar faktur tagihan bulanan pemakaian air, rincian biaya bertingkat, dan status pembayaran."
      />

      {/* Summary Banner */}
      <div
        style={{
          backgroundColor: totalUnpaid > 0 ? 'var(--danger-50)' : 'var(--success-50)',
          border: `1px solid ${totalUnpaid > 0 ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
          borderRadius: 'var(--radius-lg)',
          padding: 20,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 24
        }}
      >
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: totalUnpaid > 0 ? 'var(--danger-700)' : 'var(--success-700)' }}>
            STATUS TUNGGAKAN SAAT INI
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, color: totalUnpaid > 0 ? 'var(--danger-700)' : 'var(--success-700)', marginTop: 2 }}>
            {totalUnpaid > 0 ? formatRupiah(totalUnpaid) : 'LUNAS (NIHIL)'}
          </div>
        </div>

        <div style={{ textAlign: 'right', fontSize: 13, color: 'var(--slate-600)' }}>
          {totalUnpaid > 0 ? (
            <span>Harap lakukan pelunasan di loket desa sebelum jatuh tempo.</span>
          ) : (
            <span>Semua tagihan rekening air Anda telah lunas.</span>
          )}
        </div>
      </div>

      <Card title="Daftar Faktur Tagihan">
        {loading ? (
          <LoadingSpinner text="Memuat tagihan..." />
        ) : (
          <DataTable
            columns={columns}
            data={bills}
            emptyTitle="Belum Ada Tagihan"
            emptyMessage="Belum ada data tagihan yang diterbitkan untuk akun Anda."
          />
        )}
      </Card>

      <BillInvoiceModal
        isOpen={invoiceModalOpen}
        onClose={() => setInvoiceModalOpen(false)}
        bill={selectedBill}
      />
    </div>
  );
};
