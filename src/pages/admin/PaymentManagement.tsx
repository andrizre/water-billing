import React, { useState, useEffect, useCallback } from 'react';
import {
  CreditCard,
  Plus,
  Search,
  Download,
  Printer,
  Calendar,
  CheckCircle2
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
import { PaymentReceiptModal } from '../../components/print/PaymentReceiptPrint';
import { useDebounce } from '../../hooks/useDebounce';
import { usePagination } from '../../hooks/usePagination';
import { useToast } from '../../context/ToastContext';
import { api } from '../../services/api';
import { exportToCsv } from '../../utils/exportCsv';
import { Payment, Bill, PaymentMethod } from '../../types';
import { formatRupiah, formatDateTime, formatPeriod } from '../../utils/formatters';

export const PaymentManagement: React.FC = () => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [unpaidBills, setUnpaidBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [methodFilter, setMethodFilter] = useState<string>('');

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState<boolean>(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [receiptModalOpen, setReceiptModalOpen] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);

  // Form State
  const [formData, setFormData] = useState({
    bill_id: '',
    amount_paid: '',
    payment_method: 'Tunai' as PaymentMethod,
    notes: '',
    payment_date: new Date().toISOString().substring(0, 10)
  });

  const debouncedSearch = useDebounce(search, 300);
  const { success, error: toastError } = useToast();

  const fetchUnpaidBills = useCallback(async () => {
    try {
      const allBills = await api.getBills();
      setUnpaidBills(allBills.filter((b: Bill) => b.status !== 'Lunas'));
    } catch (e) {
      console.error(e);
    }
  }, []);

  const fetchPayments = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getPayments({
        search: debouncedSearch,
        payment_method: methodFilter
      });
      setPayments(data);
    } catch (err: any) {
      toastError(err.message || 'Gagal memuat data pembayaran.');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, methodFilter, toastError]);

  useEffect(() => {
    fetchUnpaidBills();
  }, [fetchUnpaidBills]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const pagination = usePagination(payments, { initialPageSize: 10 });

  const handleOpenCreate = () => {
    const firstBill = unpaidBills[0];
    setFormData({
      bill_id: firstBill?.id || '',
      amount_paid: firstBill ? String(firstBill.balance_due || firstBill.total_amount) : '',
      payment_method: 'Tunai',
      notes: '',
      payment_date: new Date().toISOString().substring(0, 10)
    });
    setCreateModalOpen(true);
  };

  const handleBillSelectChange = (billId: string) => {
    const b = unpaidBills.find((bill) => bill.id === billId);
    setFormData({
      ...formData,
      bill_id: billId,
      amount_paid: b ? String(b.balance_due || b.total_amount) : ''
    });
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.bill_id || Number(formData.amount_paid) <= 0) {
      toastError('Pilih tagihan dan masukkan jumlah pembayaran yang valid.');
      return;
    }

    setSaving(true);
    try {
      const res = await api.recordPayment({
        bill_id: formData.bill_id,
        amount_paid: Number(formData.amount_paid),
        payment_method: formData.payment_method,
        notes: formData.notes,
        payment_date: formData.payment_date
      });

      success('Pembayaran berhasil dicatat.');
      setCreateModalOpen(false);
      fetchPayments();
      fetchUnpaidBills();

      // Show receipt modal
      if (res.payment) {
        setSelectedPayment(res.payment);
        setReceiptModalOpen(true);
      }
    } catch (err: any) {
      toastError(err.message || 'Gagal mencatat pembayaran.');
    } finally {
      setSaving(false);
    }
  };

  const handleExportCsv = () => {
    const headers = ['No. Transaksi', 'No. Tagihan', 'Nama Pelanggan', 'No. Pelanggan', 'Tanggal Bayar', 'Metode', 'Jumlah Bayar', 'Petugas Kasir', 'Catatan'];
    const rows = payments.map((p) => [
      p.payment_no,
      p.bill_no || '-',
      p.customer_name || '-',
      p.customer_no || '-',
      p.payment_date || p.created_at || '-',
      p.payment_method,
      p.amount_paid,
      p.cashier_name || '-',
      p.notes || '-'
    ]);
    exportToCsv(`laporan-transaksi-pembayaran-${new Date().toISOString().substring(0, 10)}`, headers, rows);
    success('Data pembayaran berhasil diexport ke CSV.');
  };

  const columns = [
    {
      header: 'No. Transaksi',
      render: (p: Payment) => (
        <div>
          <span style={{ fontWeight: 800, color: 'var(--primary-700)', fontSize: 13.5 }}>
            {p.payment_no}
          </span>
          <div style={{ fontSize: 11, color: 'var(--slate-500)' }}>
            Faktur: {p.bill_no || '-'}
          </div>
        </div>
      )
    },
    {
      header: 'Tanggal & Waktu',
      render: (p: Payment) => (
        <span style={{ fontSize: 13, color: 'var(--slate-700)' }}>
          {formatDateTime(p.payment_date || p.created_at)}
        </span>
      )
    },
    {
      header: 'Nama Pelanggan',
      render: (p: Payment) => (
        <div>
          <div style={{ fontWeight: 700, color: 'var(--slate-900)' }}>{p.customer_name}</div>
          <div style={{ fontSize: 11, color: 'var(--slate-500)' }}>
            {p.customer_no} ({p.rt_rw})
          </div>
        </div>
      )
    },
    {
      header: 'Metode Bayar',
      render: (p: Payment) => <Badge variant="neutral">{p.payment_method}</Badge>
    },
    {
      header: 'Jumlah Dibayar',
      render: (p: Payment) => (
        <span style={{ fontWeight: 800, color: 'var(--success-700)', fontSize: 14 }}>
          {formatRupiah(p.amount_paid)}
        </span>
      )
    },
    {
      header: 'Petugas Loket',
      render: (p: Payment) => (
        <span style={{ fontSize: 12.5, color: 'var(--slate-600)' }}>
          {p.cashier_name || 'Petugas'}
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
          Kuitansi
        </Button>
      )
    }
  ];

  return (
    <div>
      <PageHeader
        title="Manajemen Pembayaran & Kasir"
        subtitle="Riwayat transaksi pelunasan rekening air desa dan pencetakan kuitansi resmi."
        action={
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="secondary" icon={<Download size={16} />} onClick={handleExportCsv}>
              Export CSV
            </Button>
            <Button variant="primary" icon={<Plus size={16} />} onClick={handleOpenCreate}>
              Catat Pembayaran Baru
            </Button>
          </div>
        }
      />

      {/* Filter Bar */}
      <Card bodyClassName="p-4" style={{ marginBottom: 20 }}>
        <div className="filter-bar" style={{ margin: 0 }}>
          <div className="filter-group" style={{ flex: 1, minWidth: 260 }}>
            <div style={{ width: '100%', maxWidth: 360 }}>
              <Input
                placeholder="Cari no. bukti, no. faktur, atau nama..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                leftIcon={<Search size={16} />}
              />
            </div>
          </div>

          <div className="filter-group">
            <div style={{ width: 180 }}>
              <Select
                options={[
                  { label: 'Semua Metode', value: '' },
                  { label: 'Tunai', value: 'Tunai' },
                  { label: 'Transfer Bank', value: 'Transfer Bank' },
                  { label: 'QRIS', value: 'QRIS' },
                  { label: 'Loket Desa', value: 'Loket Desa' }
                ]}
                value={methodFilter}
                onChange={(e) => setMethodFilter(e.target.value)}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Payments Table */}
      <Card>
        <DataTable
          columns={columns}
          data={pagination.paginatedItems}
          loading={loading}
          emptyTitle="Belum Ada Pembayaran"
          emptyMessage="Belum ada transaksi pembayaran yang tercatat."
        />
        <Pagination
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          totalItems={pagination.totalItems}
          pageSize={pagination.pageSize}
          onPageChange={pagination.goToPage}
        />
      </Card>

      {/* Record Payment Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        size="md"
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CreditCard size={20} color="var(--primary-600)" />
            <span>Penerimaan Pembayaran Rekening Air</span>
          </div>
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateModalOpen(false)} disabled={saving}>
              Batal
            </Button>
            <Button variant="success" onClick={handleFormSubmit} loading={saving}>
              Simpan & Cetak Kuitansi
            </Button>
          </>
        }
      >
        <form onSubmit={handleFormSubmit}>
          <Select
            label="Pilih Tagihan Pelanggan yang Belum Lunas"
            options={unpaidBills.map((b) => ({
              label: `${b.bill_no} - ${b.customer_name} (${formatPeriod(b.period_month, b.period_year)}) - Sisa: ${formatRupiah(b.balance_due || b.total_amount)}`,
              value: b.id
            }))}
            value={formData.bill_id}
            onChange={(e) => handleBillSelectChange(e.target.value)}
            required
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Input
              type="number"
              label="Nominal Dibayar (Rp)"
              placeholder="Contoh: 65000"
              value={formData.amount_paid}
              onChange={(e) => setFormData({ ...formData, amount_paid: e.target.value })}
              required
            />
            <Select
              label="Metode Pembayaran"
              options={[
                { label: 'Tunai (Kas Loket)', value: 'Tunai' },
                { label: 'Transfer Bank BRI/BCA', value: 'Transfer Bank' },
                { label: 'QRIS Desa', value: 'QRIS' },
                { label: 'Loket Desa', value: 'Loket Desa' }
              ]}
              value={formData.payment_method}
              onChange={(e) => setFormData({ ...formData, payment_method: e.target.value as any })}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Input
              type="date"
              label="Tanggal Pembayaran"
              value={formData.payment_date}
              onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
              required
            />
            <Input
              label="Catatan Transaksi (Opsi)"
              placeholder="Contoh: Titipan tetangga / Lunas"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />
          </div>
        </form>
      </Modal>

      {/* Payment Receipt Modal */}
      <PaymentReceiptModal
        isOpen={receiptModalOpen}
        onClose={() => setReceiptModalOpen(false)}
        payment={selectedPayment}
      />
    </div>
  );
};
