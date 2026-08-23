import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Users,
  Gauge,
  Receipt,
  CreditCard,
  AlertTriangle,
  TrendingUp,
  FileSpreadsheet,
  PlusCircle,
  Clock,
  Printer,
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
import { RevenueLineChart } from '../../components/charts/RevenueLineChart';
import { DataTable } from '../../components/common/DataTable';
import { BillInvoiceModal } from '../../components/print/BillInvoicePrint';
import { PaymentReceiptModal } from '../../components/print/PaymentReceiptPrint';
import { AnnouncementBanner } from '../../components/common/AnnouncementBanner';
import { api } from '../../services/api';
import { AdminDashboardData, Bill, Payment } from '../../types';
import { formatRupiah, formatM3, formatDateTime, formatPeriod } from '../../utils/formatters';
import { usePageTitle } from '../../hooks/usePageTitle';

export const AdminDashboard: React.FC = () => {
  usePageTitle('Dashboard Administrator', 'Ringkasan performa sistem penagihan air desa, statistik pelanggan, pendapatan, dan konsumsi air.');
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [billModalOpen, setBillModalOpen] = useState<boolean>(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState<boolean>(false);

  const fetchDashboardData = useCallback(async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true);
      else if (!data) setLoading(true);

      const res = await api.getDashboardSummary();
      setData(res);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [data]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Auto refresh every 15 seconds when enabled
  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(() => {
      fetchDashboardData(false);
    }, 15000);
    return () => clearInterval(timer);
  }, [autoRefresh, fetchDashboardData]);

  if (loading && !data) {
    return <LoadingSpinner text="Memuat data statistik dashboard..." />;
  }

  if (!data) return null;

  const { stats, monthly_trends, recent_payments } = data;

  const usageChartData = monthly_trends.map((t) => ({
    period_name: t.period_name,
    usage_m3: t.usage_m3
  }));

  return (
    <div className="fade-in">
      <PageHeader
        title="Dashboard Utama Administrator"
        subtitle="Ringkasan operasional air minum desa, keuangan, dan status pelanggan terkini."
        action={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {/* Auto-Refresh Toggle */}
            <button
              type="button"
              onClick={() => setAutoRefresh(!autoRefresh)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 12,
                fontWeight: 600,
                padding: '6px 12px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--slate-200)',
                backgroundColor: autoRefresh ? 'var(--primary-50)' : 'var(--slate-50)',
                color: autoRefresh ? 'var(--primary-700)' : 'var(--slate-600)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              title="Aktifkan/nonaktifkan pembaruan otomatis setiap 15 detik"
            >
              <Activity size={13} className={autoRefresh ? 'text-primary-600 animate-pulse' : ''} />
              <span>Live: {autoRefresh ? 'ON' : 'OFF'}</span>
            </button>

            {/* Manual Refresh */}
            <Button
              variant="secondary"
              size="sm"
              icon={<RefreshCw size={14} className={refreshing ? 'spin-anim' : ''} />}
              onClick={() => fetchDashboardData(true)}
              disabled={refreshing}
            >
              Segarkan
            </Button>

            <Link to="/admin/bills">
              <Button variant="primary" size="sm" icon={<PlusCircle size={15} />}>
                Kelola Tagihan
              </Button>
            </Link>
            <Link to="/admin/reports">
              <Button variant="secondary" size="sm" icon={<FileSpreadsheet size={15} />}>
                Lihat Laporan
              </Button>
            </Link>
          </div>
        }
      />

      {/* Broadcast Announcements Banner */}
      <AnnouncementBanner />

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
          Terhubung ke backend cloud &middot; Terakhir diperbarui: {lastUpdated.toLocaleTimeString('id-ID')}
        </span>
        {autoRefresh && (
          <span style={{ fontSize: 11, color: 'var(--success-600)', fontWeight: 600 }}>
            ● Auto-sync aktif (15s)
          </span>
        )}
      </div>

      {/* 5 Core Statistics Cards */}
      <div className="stat-card-grid">
        <StatCard
          title="Total Pelanggan"
          value={stats.total_customers}
          subtitle={`${stats.active_customers} pelanggan aktif`}
          icon={<Users size={24} />}
          color="var(--primary-600)"
          bg="var(--primary-50)"
        />
        <StatCard
          title="Meter Air Terpasang"
          value={stats.total_meters}
          subtitle="Unit terdata di sistem"
          icon={<Gauge size={24} />}
          color="var(--accent-600)"
          bg="var(--primary-50)"
        />
        <StatCard
          title="Tagihan Bulan Ini"
          value={formatRupiah(stats.total_billed_this_month)}
          subtitle={`Pemakaian: ${formatM3(stats.total_usage_this_month)}`}
          icon={<Receipt size={24} />}
          color="var(--primary-700)"
          bg="var(--primary-100)"
        />
        <StatCard
          title="Penerimaan Kas (Bulan Ini)"
          value={formatRupiah(stats.total_collected_this_month)}
          subtitle="Tercatat dari pembayaran lunas"
          icon={<CreditCard size={24} />}
          color="var(--success-600)"
          bg="var(--success-50)"
        />
        <StatCard
          title="Total Tunggakan Warga"
          value={formatRupiah(stats.total_arrears)}
          subtitle="Tagihan belum terbayar"
          icon={<AlertTriangle size={24} />}
          color="var(--danger-600)"
          bg="var(--danger-50)"
        />
      </div>

      {/* Analytics Charts Grid */}
      <div className="responsive-grid-2" style={{ marginBottom: 24 }}>
        <Card
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <TrendingUp size={18} color="var(--primary-600)" />
              <span>Tren Keuangan 6 Bulan Terakhir</span>
            </div>
          }
          subtitle="Perbandingan tagihan diterbitkan vs penerimaan kas lunas"
        >
          <RevenueLineChart data={monthly_trends} height={260} />
        </Card>

        <Card
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Gauge size={18} color="var(--accent-600)" />
              <span>Tren Konsumsi Air Desa (m³)</span>
            </div>
          }
          subtitle="Total volume kubikasi air yang digunakan warga per bulan"
        >
          <UsageBarChart data={usageChartData} height={260} />
        </Card>
      </div>

      {/* Recent Payments Table Card */}
      <Card
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Clock size={18} color="var(--success-600)" />
            <span>Transaksi Pembayaran Terbaru</span>
          </div>
        }
        subtitle="Daftar penerimaan uang air yang dicatat petugas loket"
        action={
          <Link to="/admin/payments">
            <Button variant="secondary" size="sm">
              Lihat Semua Pembayaran
            </Button>
          </Link>
        }
      >
        <DataTable
          columns={[
            {
              header: 'No. Pembayaran',
              render: (p: Payment) => <span style={{ fontWeight: 700, color: 'var(--primary-700)' }}>{p.payment_no}</span>
            },
            {
              header: 'Tanggal & Waktu',
              render: (p: Payment) => formatDateTime(p.payment_date || p.created_at)
            },
            {
              header: 'Nama Pelanggan',
              render: (p: Payment) => (
                <div>
                  <div style={{ fontWeight: 600 }}>{p.customer_name}</div>
                  <div style={{ fontSize: 11, color: 'var(--slate-500)' }}>{p.customer_no}</div>
                </div>
              )
            },
            {
              header: 'Periode',
              render: (p: Payment) => p.period_month && p.period_year ? formatPeriod(p.period_month, p.period_year) : '-'
            },
            {
              header: 'Metode',
              render: (p: Payment) => <Badge variant="neutral">{p.payment_method}</Badge>
            },
            {
              header: 'Nominal',
              render: (p: Payment) => (
                <span style={{ fontWeight: 800, color: 'var(--success-700)' }}>
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
                    setPaymentModalOpen(true);
                  }}
                >
                  Kuitansi
                </Button>
              )
            }
          ]}
          data={recent_payments}
          emptyTitle="Belum Ada Transaksi"
          emptyMessage="Belum ada transaksi pembayaran air yang tercatat."
        />
      </Card>

      {/* Modals for Invoices and Receipts */}
      <BillInvoiceModal
        isOpen={billModalOpen}
        onClose={() => setBillModalOpen(false)}
        bill={selectedBill}
      />
      <PaymentReceiptModal
        isOpen={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        payment={selectedPayment}
      />
    </div>
  );
};
