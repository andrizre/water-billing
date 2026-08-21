import React, { useState, useEffect, useCallback } from 'react';
import {
  Gauge,
  Receipt,
  CreditCard,
  AlertCircle,
  FileText,
  Printer,
  Droplets,
  CheckCircle2,
  RefreshCw,
  Zap,
  Activity
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../../components/layout/PageHeader';
import { StatCard } from '../../components/common/StatCard';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { UsageBarChart } from '../../components/charts/UsageBarChart';
import { BillInvoiceModal } from '../../components/print/BillInvoicePrint';
import { PaymentReceiptModal } from '../../components/print/PaymentReceiptPrint';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { api } from '../../services/api';
import { CustomerDashboardData, Bill, Payment } from '../../types';
import { formatRupiah, formatM3, formatDate, formatDateTime, formatPeriod } from '../../utils/formatters';

export const CustomerDashboard: React.FC = () => {
  const { user } = useAuth();
  const { settings } = useSettings();
  const [data, setData] = useState<CustomerDashboardData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Modals
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [billModalOpen, setBillModalOpen] = useState<boolean>(false);
  const [receiptModalOpen, setReceiptModalOpen] = useState<boolean>(false);

  const fetchCustomerData = useCallback(async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true);
      else if (!data) setLoading(true);

      const res = await api.getDashboardSummary();
      setData(res);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to load customer dashboard:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [data]);

  useEffect(() => {
    fetchCustomerData();
  }, [fetchCustomerData]);

  if (loading && !data) {
    return <LoadingSpinner text="Memuat data tagihan dan pemakaian air Anda..." />;
  }

  if (!data) return null;

  const { customer, meter, total_unpaid, active_bill, recent_payments, usage_history } = data;

  return (
    <div className="fade-in">
      <PageHeader
        title={`Halo, ${customer?.full_name || user?.fullName || 'Warga'}`}
        subtitle={`Nomor Pelanggan: ${customer?.customer_no || user?.username} | Wilayah: ${customer?.rt_rw || 'Dusun Krajan'}`}
        action={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Button
              variant="secondary"
              size="sm"
              icon={<RefreshCw size={14} className={refreshing ? 'spin-anim' : ''} />}
              onClick={() => fetchCustomerData(true)}
              disabled={refreshing}
            >
              Segarkan
            </Button>
          </div>
        }
      />

      {/* Real-time sync timestamp */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: 12,
          color: 'var(--slate-500)',
          marginBottom: 16,
          padding: '0 4px',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Zap size={13} color="var(--primary-500)" />
          Terhubung ke data cloud &middot; Terakhir diperbarui: {lastUpdated.toLocaleTimeString('id-ID')}
        </span>
      </div>

      {/* Active Unpaid Bill Alert Banner if Any */}
      {total_unpaid > 0 ? (
        <div
          style={{
            backgroundColor: 'var(--danger-50)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 'var(--radius-lg)',
            padding: '18px 24px',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            marginBottom: 24
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                color: 'var(--danger-700)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <AlertCircle size={26} />
            </div>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--danger-700)' }}>
                Tagihan Air Anda Perlu Dilunasi
              </h3>
              <p style={{ fontSize: 13, color: 'var(--slate-600)', marginTop: 2 }}>
                Total tagihan & tunggakan saat ini: <strong>{formatRupiah(total_unpaid)}</strong>
              </p>
            </div>
          </div>
          {active_bill && (
            <Button
              variant="danger"
              icon={<Printer size={16} />}
              onClick={() => {
                setSelectedBill(active_bill);
                setBillModalOpen(true);
              }}
            >
              Lihat Faktur & Cara Bayar
            </Button>
          )}
        </div>
      ) : (
        <div
          style={{
            backgroundColor: 'var(--success-50)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: 'var(--radius-lg)',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 24
          }}
        >
          <CheckCircle2 size={24} color="var(--success-600)" />
          <div>
            <div style={{ fontWeight: 700, color: 'var(--success-700)', fontSize: 14 }}>
              Status Tagihan: LUNAS
            </div>
            <div style={{ fontSize: 12, color: 'var(--slate-600)' }}>
              Tidak ada tunggakan air yang belum dibayar. Terima kasih atas ketertiban Anda.
            </div>
          </div>
        </div>
      )}

      {/* 3 Quick Stat Cards */}
      <div className="stat-card-grid">
        <StatCard
          title="Nomor Seri Meter"
          value={meter?.meter_no || 'MTR-8801'}
          subtitle={`Kondisi: ${meter?.status || 'Aktif (Normal)'}`}
          icon={<Gauge size={24} />}
          color="var(--primary-600)"
          bg="var(--primary-50)"
        />
        <StatCard
          title="Angka Meter Terakhir"
          value={formatM3(meter?.current_reading || customer?.current_reading || 0)}
          subtitle="Posisi angka kubikasi saat ini"
          icon={<Droplets size={24} />}
          color="var(--accent-600)"
          bg="var(--primary-50)"
        />
        <StatCard
          title="Tagihan Bulan Ini"
          value={active_bill ? formatRupiah(active_bill.total_amount) : 'Rp 0'}
          subtitle={active_bill ? `Status: ${active_bill.status}` : 'Belum terbit'}
          icon={<Receipt size={24} />}
          color={active_bill?.status === 'Lunas' ? 'var(--success-600)' : 'var(--danger-600)'}
          bg={active_bill?.status === 'Lunas' ? 'var(--success-50)' : 'var(--danger-50)'}
        />
      </div>

      {/* Usage Chart & Payment Details Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 20, marginBottom: 24 }}>
        {/* Usage Bar Chart */}
        <Card
          title="Grafik Pemakaian Air (6 Bulan Terakhir)"
          subtitle="Volume air bersih yang dikonsumsi rumah Anda setiap bulan"
          action={
            <Link to="/customer/usage">
              <Button size="sm" variant="secondary">Detail Pemakaian</Button>
            </Link>
          }
        >
          <UsageBarChart data={usage_history} height={240} />
        </Card>

        {/* Bank & Payment Instructions Card */}
        <Card title="Petunjuk Pembayaran Air Desa">
          <div style={{ fontSize: 13, color: 'var(--slate-600)', lineHeight: 1.7 }}>
            <p>
              Warga dapat melakukan pembayaran rekening air melalui salah satu metode berikut:
            </p>
            <div style={{ marginTop: 10, padding: 12, backgroundColor: 'var(--slate-50)', borderRadius: 'var(--radius-md)', border: '1px solid var(--slate-200)' }}>
              <div style={{ fontWeight: 700, color: 'var(--slate-900)' }}>1. Tunai di Kantor Desa / Loket BUMDes</div>
              <div>Buka setiap hari kerja pukul 08:00 - 15:00 WIB.</div>
            </div>
            <div style={{ marginTop: 8, padding: 12, backgroundColor: 'var(--slate-50)', borderRadius: 'var(--radius-md)', border: '1px solid var(--slate-200)' }}>
              <div style={{ fontWeight: 700, color: 'var(--slate-900)' }}>2. Transfer Bank Resmi</div>
              <div style={{ fontWeight: 600, color: 'var(--primary-800)' }}>{settings.bank_account_info}</div>
            </div>
            <div style={{ marginTop: 10, fontSize: 12, color: 'var(--slate-500)' }}>
              *Konfirmasi bukti transfer ke WhatsApp Pengelola: <strong>{settings.contact_phone}</strong>.
            </div>
          </div>
        </Card>
      </div>

      {/* Recent Payments Table */}
      <Card
        title="Riwayat Pembayaran Terbaru"
        subtitle="Daftar pembayaran yang telah disetorkan dan diverifikasi petugas"
        action={
          <Link to="/customer/payments">
            <Button size="sm" variant="secondary">Lihat Semua Riwayat</Button>
          </Link>
        }
      >
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>No. Bukti Kuitansi</th>
                <th>Tanggal Bayar</th>
                <th>Periode Rekening</th>
                <th>Metode</th>
                <th>Jumlah Lunas</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {recent_payments.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: 24, color: 'var(--slate-400)' }}>
                    Belum ada riwayat pembayaran yang tercatat.
                  </td>
                </tr>
              ) : (
                recent_payments.map((p) => (
                  <tr key={p.id} className="row-hover-highlight">
                    <td style={{ fontWeight: 700 }}>{p.payment_no}</td>
                    <td>{formatDateTime(p.payment_date || p.created_at)}</td>
                    <td>{p.period_month && p.period_year ? formatPeriod(p.period_month, p.period_year) : '-'}</td>
                    <td><Badge variant="neutral">{p.payment_method}</Badge></td>
                    <td style={{ fontWeight: 800, color: 'var(--success-700)' }}>
                      {formatRupiah(p.amount_paid)}
                    </td>
                    <td>
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
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <BillInvoiceModal
        isOpen={billModalOpen}
        onClose={() => setBillModalOpen(false)}
        bill={selectedBill}
        customer={customer}
        meter={meter}
      />
      <PaymentReceiptModal
        isOpen={receiptModalOpen}
        onClose={() => setReceiptModalOpen(false)}
        payment={selectedPayment}
        customer={customer}
      />
    </div>
  );
};
