import React, { useState, useEffect, useCallback } from 'react';
import { CreditCard, Printer, CheckCircle } from 'lucide-react';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { DataTable } from '../../components/common/DataTable';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { PaymentReceiptModal } from '../../components/print/PaymentReceiptPrint';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { api } from '../../services/api';
import { Payment } from '../../types';
import { formatRupiah, formatDateTime, formatPeriod } from '../../utils/formatters';

export const CustomerPaymentHistoryPage: React.FC = () => {
  const { user } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [receiptModalOpen, setReceiptModalOpen] = useState<boolean>(false);

  const { error: toastError } = useToast();

  const fetchPayments = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getPayments({ customer_id: user?.customerId });
      setPayments(data);
    } catch (err: any) {
      toastError(err.message || 'Gagal memuat riwayat pembayaran.');
    } finally {
      setLoading(false);
    }
  }, [user?.customerId, toastError]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const columns = [
    {
      header: 'No. Kuitansi',
      render: (p: Payment) => (
        <span style={{ fontWeight: 800, color: 'var(--primary-700)' }}>{p.payment_no}</span>
      )
    },
    {
      header: 'Waktu Pembayaran',
      render: (p: Payment) => formatDateTime(p.payment_date || p.created_at)
    },
    {
      header: 'Periode Tagihan',
      render: (p: Payment) => (
        p.period_month && p.period_year ? formatPeriod(p.period_month, p.period_year) : '-'
      )
    },
    {
      header: 'Metode Pembayaran',
      render: (p: Payment) => <Badge variant="neutral">{p.payment_method}</Badge>
    },
    {
      header: 'Nominal Lunas',
      render: (p: Payment) => (
        <span style={{ fontWeight: 800, color: 'var(--success-700)', fontSize: 14 }}>
          {formatRupiah(p.amount_paid)}
        </span>
      )
    },
    {
      header: 'Aksi',
      align: 'right' as const,
      render: (p: Payment) => (
        <Button
          size="sm"
          variant="secondary"
          icon={<Printer size={13} />}
          onClick={() => {
            setSelectedPayment(p);
            setReceiptModalOpen(true);
          }}
        >
          Lihat Kuitansi
        </Button>
      )
    }
  ];

  return (
    <div>
      <PageHeader
        title="Riwayat Pembayaran & Kuitansi"
        subtitle="Daftar setoran pembayaran rekening air yang telah diterima dan kuitansi pelunasan resmi."
      />

      <Card title="Riwayat Transaksi Pelunasan">
        {loading ? (
          <LoadingSpinner text="Memuat riwayat pembayaran..." />
        ) : (
          <DataTable
            columns={columns}
            data={payments}
            emptyTitle="Belum Ada Pembayaran"
            emptyMessage="Belum ada transaksi pembayaran yang tercatat untuk akun Anda."
          />
        )}
      </Card>

      <PaymentReceiptModal
        isOpen={receiptModalOpen}
        onClose={() => setReceiptModalOpen(false)}
        payment={selectedPayment}
      />
    </div>
  );
};
