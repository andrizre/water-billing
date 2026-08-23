import React, { useState, useEffect, useCallback } from 'react';
import {
  ClipboardPen,
  CreditCard,
  FileSpreadsheet,
  Users,
  Gauge,
  Clock,
  ArrowRight,
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
import { DataTable } from '../../components/common/DataTable';
import { PaymentReceiptModal } from '../../components/print/PaymentReceiptPrint';
import { AnnouncementBanner } from '../../components/common/AnnouncementBanner';
import { api } from '../../services/api';
import { AdminDashboardData, Payment } from '../../types';
import { formatRupiah, formatM3, formatDateTime, formatPeriod } from '../../utils/formatters';

export const OperatorDashboard: React.FC = () => {
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [receiptModalOpen, setReceiptModalOpen] = useState<boolean>(false);

  const fetchDashboardData = useCallback(async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true);
      else if (!data) setLoading(true);

      const res = await api.getDashboardSummary();
      setData(res);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to load operator dashboard:', err);
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
    return <LoadingSpinner text="Memuat dashboard operasional..." />;
  }

  if (!data) return null;

  const { stats, recent_payments, recent_readings } = data;

  return (
    <div className="fade-in">
      <PageHeader
        title="Dashboard Petugas Operasional & Loket"
        subtitle="Pencatatan meteran bulanan warga, kasir pembayaran rekening air, dan layanan pelanggan."
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
                backgroundColor: autoRefresh ? 'var(--primary-50)' : '#ffffff',
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

            <Link to="/operator/readings">
              <Button variant="primary" size="sm" icon={<ClipboardPen size={15} />}>
                Catat Meter Warga
              </Button>
            </Link>
            <Link to="/operator/payments">
              <Button variant="success" size="sm" icon={<CreditCard size={15} />}>
                Buka Kasir Loket
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

      {/* Quick Action Cards Banner */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 16,
          marginBottom: 24
        }}
      >
        <Link to="/operator/readings" style={{ textDecoration: 'none' }}>
          <div
            className="hover-card-action"
            style={{
              backgroundColor: '#ffffff',
              padding: 20,
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--slate-200)',
              boxShadow: 'var(--shadow-card)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              transition: 'all 0.2s ease',
              cursor: 'pointer',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--primary-50)',
                  color: 'var(--primary-600)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <ClipboardPen size={22} />
              </div>
              <div>
                <h4 style={{ fontSize: 15, fontWeight: 700, color: 'var(--slate-900)' }}>
                  Catat Angka Meter
                </h4>
                <p style={{ fontSize: 12, color: 'var(--slate-500)' }}>Input meteran bulanan</p>
              </div>
            </div>
            <ArrowRight size={18} color="var(--slate-400)" />
          </div>
        </Link>

        <Link to="/operator/payments" style={{ textDecoration: 'none' }}>
          <div
            className="hover-card-action"
            style={{
              backgroundColor: '#ffffff',
              padding: 20,
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--slate-200)',
              boxShadow: 'var(--shadow-card)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              transition: 'all 0.2s ease',
              cursor: 'pointer',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--success-50)',
                  color: 'var(--success-600)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <CreditCard size={22} />
              </div>
              <div>
                <h4 style={{ fontSize: 15, fontWeight: 700, color: 'var(--slate-900)' }}>
                  Kasir Pembayaran
                </h4>
                <p style={{ fontSize: 12, color: 'var(--slate-500)' }}>Terima kas & cetak struk</p>
              </div>
            </div>
            <ArrowRight size={18} color="var(--slate-400)" />
          </div>
        </Link>

        <Link to="/operator/bills" style={{ textDecoration: 'none' }}>
          <div
            className="hover-card-action"
            style={{
              backgroundColor: '#ffffff',
              padding: 20,
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--slate-200)',
              boxShadow: 'var(--shadow-card)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              transition: 'all 0.2s ease',
              cursor: 'pointer',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--primary-100)',
                  color: 'var(--primary-700)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <FileSpreadsheet size={22} />
              </div>
              <div>
                <h4 style={{ fontSize: 15, fontWeight: 700, color: 'var(--slate-900)' }}>
                  Generate Tagihan
                </h4>
                <p style={{ fontSize: 12, color: 'var(--slate-500)' }}>Buat faktur rekening air</p>
              </div>
            </div>
            <ArrowRight size={18} color="var(--slate-400)" />
          </div>
        </Link>
      </div>

      {/* Summary Cards */}
      <div className="stat-card-grid">
        <StatCard
          title="Pelanggan Terdaftar"
          value={stats.total_customers}
          subtitle={`${stats.active_customers} rumah tangga aktif`}
          icon={<Users size={24} />}
          color="var(--primary-600)"
          bg="var(--primary-50)"
        />
        <StatCard
          title="Kas Diterima Bulan Ini"
          value={formatRupiah(stats.total_collected_this_month)}
          subtitle="Penerimaan pembayaran air"
          icon={<CreditCard size={24} />}
          color="var(--success-600)"
          bg="var(--success-50)"
        />
        <StatCard
          title="Volume Pemakaian (Bulan Ini)"
          value={formatM3(stats.total_usage_this_month)}
          subtitle="Total konsumsi air desa"
          icon={<Gauge size={24} />}
          color="var(--primary-700)"
          bg="var(--primary-100)"
        />
      </div>

      {/* Tables Grid */}
      <div className="responsive-grid-2">
        {/* Recent Readings */}
        <Card
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ClipboardPen size={18} color="var(--primary-600)" />
              <span>Catatan Meter Terbaru</span>
            </div>
          }
          action={
            <Link to="/operator/readings">
              <Button size="sm" variant="secondary">Lihat Semua</Button>
            </Link>
          }
        >
          <DataTable
            columns={[
              {
                header: 'Nama Pelanggan',
                render: (r: any) => (
                  <div>
                    <div style={{ fontWeight: 700 }}>{r.customer_name}</div>
                    <div style={{ fontSize: 11, color: 'var(--slate-500)' }}>{r.customer_no}</div>
                  </div>
                )
              },
              {
                header: 'Periode',
                render: (r: any) => formatPeriod(r.period_month, r.period_year)
              },
              {
                header: 'Angka Meter',
                render: (r: any) => `${r.prev_reading} → ${r.current_reading}`
              },
              {
                header: 'Volume (m³)',
                render: (r: any) => (
                  <span style={{ fontWeight: 800, color: 'var(--primary-700)' }}>
                    {formatM3(r.usage_m3)}
                  </span>
                )
              }
            ]}
            data={recent_readings}
            emptyTitle="Belum Ada Catatan Meter"
            emptyMessage="Belum ada data pencatatan meter terbaru."
          />
        </Card>

        {/* Recent Cashier Receipts */}
        <Card
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Clock size={18} color="var(--success-600)" />
              <span>Penerimaan Kasir Terbaru</span>
            </div>
          }
          action={
            <Link to="/operator/payments">
              <Button size="sm" variant="secondary">Buka Kasir</Button>
            </Link>
          }
        >
          <DataTable
            columns={[
              {
                header: 'No. Transaksi',
                render: (p: Payment) => <span style={{ fontWeight: 700 }}>{p.payment_no}</span>
              },
              {
                header: 'Nama Pelanggan',
                render: (p: Payment) => p.customer_name
              },
              {
                header: 'Jumlah',
                render: (p: Payment) => (
                  <span style={{ fontWeight: 800, color: 'var(--success-700)' }}>
                    {formatRupiah(p.amount_paid)}
                  </span>
                )
              },
              {
                header: 'Kuitansi',
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
                    Cetak
                  </Button>
                )
              }
            ]}
            data={recent_payments}
            emptyTitle="Belum Ada Pembayaran"
            emptyMessage="Belum ada transaksi penerimaan kasir terbaru."
          />
        </Card>
      </div>

      <PaymentReceiptModal
        isOpen={receiptModalOpen}
        onClose={() => setReceiptModalOpen(false)}
        payment={selectedPayment}
      />
    </div>
  );
};
