import React, { useState, useEffect, useCallback } from 'react';
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
  Printer
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
import { BillInvoiceModal } from '../../components/print/BillInvoicePrint';
import { PaymentReceiptModal } from '../../components/print/PaymentReceiptPrint';
import { api } from '../../services/api';
import { AdminDashboardData, Bill, Payment } from '../../types';
import { formatRupiah, formatM3, formatDateTime, formatPeriod } from '../../utils/formatters';

export const AdminDashboard: React.FC = () => {
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [billModalOpen, setBillModalOpen] = useState<boolean>(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState<boolean>(false);

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.getDashboardSummary();
      setData(res);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  if (loading || !data) {
    return <LoadingSpinner text="Memuat data statistik dashboard..." />;
  }

  const { stats, monthly_trends, recent_payments } = data;

  const usageChartData = monthly_trends.map((t) => ({
    period_name: t.period_name,
    usage_m3: t.usage_m3
  }));

  return (
    <div>
      <PageHeader
        title="Dashboard Utama Administrator"
        subtitle="Ringkasan operasional air minum desa, keuangan, dan status pelanggan terkini."
        action={
          <div style={{ display: 'flex', gap: 8 }}>
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
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
          gap: 20,
          marginBottom: 24
        }}
      >
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
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>No. Pembayaran</th>
                <th>Tanggal & Waktu</th>
                <th>Nama Pelanggan</th>
                <th>Periode</th>
                <th>Metode</th>
                <th>Nominal</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {recent_payments.map((p) => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 700 }}>{p.payment_no}</td>
                  <td>{formatDateTime(p.payment_date || p.created_at)}</td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{p.customer_name}</div>
                    <div style={{ fontSize: 11, color: 'var(--slate-500)' }}>{p.customer_no}</div>
                  </td>
                  <td>
                    {p.period_month && p.period_year ? formatPeriod(p.period_month, p.period_year) : '-'}
                  </td>
                  <td>
                    <Badge variant="neutral">{p.payment_method}</Badge>
                  </td>
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
                        setPaymentModalOpen(true);
                      }}
                    >
                      Kuitansi
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
