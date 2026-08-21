import React, { useState, useEffect, useCallback } from 'react';
import {
  ClipboardPen,
  CreditCard,
  FileSpreadsheet,
  Users,
  Gauge,
  Clock,
  ArrowRight,
  Printer
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../../components/layout/PageHeader';
import { StatCard } from '../../components/common/StatCard';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { PaymentReceiptModal } from '../../components/print/PaymentReceiptPrint';
import { api } from '../../services/api';
import { AdminDashboardData, Payment } from '../../types';
import { formatRupiah, formatM3, formatDateTime, formatPeriod } from '../../utils/formatters';

export const OperatorDashboard: React.FC = () => {
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [receiptModalOpen, setReceiptModalOpen] = useState<boolean>(false);

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.getDashboardSummary();
      setData(res);
    } catch (err) {
      console.error('Failed to load operator dashboard:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  if (loading || !data) {
    return <LoadingSpinner text="Memuat dashboard operasional..." />;
  }

  const { stats, recent_payments, recent_readings } = data;

  return (
    <div>
      <PageHeader
        title="Dashboard Petugas Operasional & Loket"
        subtitle="Pencatatan meteran bulanan warga, kasir pembayaran rekening air, dan layanan pelanggan."
        action={
          <div style={{ display: 'flex', gap: 8 }}>
            <Link to="/operator/readings">
              <Button variant="primary" icon={<ClipboardPen size={16} />}>
                Catat Meter Warga
              </Button>
            </Link>
            <Link to="/operator/payments">
              <Button variant="success" icon={<CreditCard size={16} />}>
                Buka Kasir Loket
              </Button>
            </Link>
          </div>
        }
      />

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
            style={{
              backgroundColor: '#ffffff',
              padding: 20,
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--slate-200)',
              boxShadow: 'var(--shadow-card)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              transition: 'transform var(--transition-fast)'
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
            style={{
              backgroundColor: '#ffffff',
              padding: 20,
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--slate-200)',
              boxShadow: 'var(--shadow-card)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
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
            style={{
              backgroundColor: '#ffffff',
              padding: 20,
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--slate-200)',
              boxShadow: 'var(--shadow-card)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 20 }}>
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
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nama Pelanggan</th>
                  <th>Periode</th>
                  <th>Angka Meter</th>
                  <th>Volume (m³)</th>
                </tr>
              </thead>
              <tbody>
                {recent_readings.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <div style={{ fontWeight: 700 }}>{r.customer_name}</div>
                      <div style={{ fontSize: 11, color: 'var(--slate-500)' }}>{r.customer_no}</div>
                    </td>
                    <td>{formatPeriod(r.period_month, r.period_year)}</td>
                    <td>{r.prev_reading} → {r.current_reading}</td>
                    <td style={{ fontWeight: 800, color: 'var(--primary-700)' }}>
                      {formatM3(r.usage_m3)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>No. Transaksi</th>
                  <th>Nama Pelanggan</th>
                  <th>Jumlah</th>
                  <th>Kuitansi</th>
                </tr>
              </thead>
              <tbody>
                {recent_payments.map((p) => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 700 }}>{p.payment_no}</td>
                    <td>{p.customer_name}</td>
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
                        Cetak
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
