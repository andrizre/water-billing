import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart3,
  Receipt,
  CreditCard,
  AlertTriangle,
  Gauge,
  Download,
  Printer,
  Calendar,
  Filter,
  Wrench,
  DollarSign
} from 'lucide-react';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Select } from '../../components/common/Select';
import { Input } from '../../components/common/Input';
import { Tabs, TabItem } from '../../components/common/Tabs';
import { DataTable } from '../../components/common/DataTable';
import { Badge } from '../../components/common/Badge';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { useToast } from '../../context/ToastContext';
import { useSettings } from '../../context/SettingsContext';
import { api } from '../../services/api';
import { exportToCsv } from '../../utils/exportCsv';
import { formatRupiah, formatM3, formatDate, formatDateTime, formatPeriod, INDONESIAN_MONTHS } from '../../utils/formatters';
import { usePageTitle } from '../../hooks/usePageTitle';

export const ReportsPage: React.FC = () => {
  usePageTitle('Laporan & Rekapitulasi Keuangan', 'Rekapitulasi terpadu penerimaan kas, piutang, kubikasi air, dan laba pemeliharaan.');
  const [activeTab, setActiveTab] = useState<string>('billing');
  const [loading, setLoading] = useState<boolean>(true);
  const [reportData, setReportData] = useState<any>(null);

  // Filters
  const [periodMonth, setPeriodMonth] = useState<string>('8');
  const [periodYear, setPeriodYear] = useState<string>('2026');
  const [paymentMethod, setPaymentMethod] = useState<string>('');

  const { success, error: toastError } = useToast();
  const { settings } = useSettings();

  const fetchReport = useCallback(async () => {
    try {
      setLoading(true);
      let data: any = null;

      if (activeTab === 'billing') {
        data = await api.getBillingReport({ period_month: periodMonth, period_year: periodYear });
      } else if (activeTab === 'payment') {
        data = await api.getPaymentReport({ payment_method: paymentMethod });
      } else if (activeTab === 'arrears') {
        data = await api.getArrearsReport();
      } else if (activeTab === 'usage') {
        data = await api.getUsageReport({ period_month: periodMonth, period_year: periodYear });
      } else if (activeTab === 'profit_loss') {
        const [paymentRep, expenses] = await Promise.all([
          api.getPaymentReport({}),
          api.getMaintenanceExpenses({})
        ]);
        const totalRevenue = paymentRep?.summary?.total_revenue || (paymentRep?.items || []).reduce((acc: number, curr: any) => acc + (curr.amount_paid || 0), 0);
        const totalExpense = (expenses || []).reduce((acc: number, curr: any) => acc + (curr.amount || 0), 0);
        const netProfit = totalRevenue - totalExpense;

        data = {
          summary: {
            total_revenue: totalRevenue,
            total_expense: totalExpense,
            net_profit: netProfit,
            expense_count: expenses.length
          },
          items: expenses || []
        };
      }

      setReportData(data);
    } catch (err: any) {
      toastError(err.message || 'Gagal memuat laporan.');
    } finally {
      setLoading(false);
    }
  }, [activeTab, periodMonth, periodYear, paymentMethod, toastError]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportCsv = () => {
    if (!reportData || !reportData.items || reportData.items.length === 0) {
      toastError('Tidak ada data untuk diexport.');
      return;
    }

    if (activeTab === 'billing') {
      const headers = ['No. Tagihan', 'ID Pelanggan', 'Nama Pelanggan', 'RT/RW', 'Periode', 'Pakai (m3)', 'Total Tagihan', 'Dibayar', 'Sisa', 'Status'];
      const rows = reportData.items.map((i: any) => [
        i.bill_no, i.customer_no, i.customer_name, i.rt_rw, i.period, i.usage_m3, i.total_amount, i.paid_amount, i.balance_due, i.status
      ]);
      exportToCsv(`laporan-tagihan-${periodMonth}-${periodYear}`, headers, rows);
    } else if (activeTab === 'payment') {
      const headers = ['No. Transaksi', 'Tanggal', 'Nama Pelanggan', 'ID Pelanggan', 'Jumlah Bayar', 'Metode'];
      const rows = reportData.items.map((i: any) => [
        i.payment_no, i.payment_date, i.customer_name, i.customer_no, i.amount_paid, i.payment_method
      ]);
      exportToCsv(`laporan-penerimaan-kas`, headers, rows);
    } else if (activeTab === 'arrears') {
      const headers = ['ID Pelanggan', 'Nama Pelanggan', 'RT/RW', 'No. HP', 'Bulan Nunggak', 'Total Tunggakan (Rp)'];
      const rows = reportData.items.map((i: any) => [
        i.customer_no, i.customer_name, i.rt_rw, i.phone || '-', i.unpaid_months_count, i.total_arrears
      ]);
      exportToCsv(`laporan-tunggakan-pelanggan`, headers, rows);
    } else if (activeTab === 'usage') {
      const headers = ['No. Pencatatan', 'ID Pelanggan', 'Nama Pelanggan', 'RT/RW', 'Periode', 'Meter Lalu', 'Meter Kini', 'Pemakaian (m3)'];
      const rows = reportData.items.map((i: any) => [
        i.reading_no, i.customer_no, i.customer_name, i.rt_rw, i.period, i.prev_reading, i.current_reading, i.usage_m3
      ]);
      exportToCsv(`laporan-pemakaian-air-${periodMonth}-${periodYear}`, headers, rows);
    } else if (activeTab === 'profit_loss') {
      const headers = ['No. Biaya', 'Tanggal', 'Kategori', 'Keperluan', 'Biaya (Rp)'];
      const rows = reportData.items.map((i: any) => [
        i.expense_no, i.expense_date, i.category, i.title, i.amount
      ]);
      exportToCsv(`laporan-laba-rugi-maintenance`, headers, rows);
    }

    success('Laporan berhasil diexport ke CSV.');
  };

  const tabs: TabItem[] = [
    { id: 'billing', label: '1. Rekap Tagihan Air', icon: <Receipt size={16} /> },
    { id: 'payment', label: '2. Penerimaan Pembayaran Kas', icon: <CreditCard size={16} /> },
    { id: 'arrears', label: '3. Daftar Tunggakan Warga', icon: <AlertTriangle size={16} /> },
    { id: 'usage', label: '4. Rekap Pemakaian Kubikasi (m³)', icon: <Gauge size={16} /> },
    { id: 'profit_loss', label: '5. Laba Bersih & Pemeliharaan', icon: <DollarSign size={16} /> }
  ];

  return (
    <div>
      <PageHeader
        title="Laporan & Rekapitulasi Keuangan Air"
        subtitle="Laporan terpadu penerimaan pendapatan, penagihan rekening air, audit tunggakan, dan volume kubikasi."
        action={
          <div style={{ display: 'flex', gap: 8 }} className="no-print">
            <Button variant="secondary" icon={<Download size={16} />} onClick={handleExportCsv}>
              Export CSV
            </Button>
            <Button variant="primary" icon={<Printer size={16} />} onClick={handlePrint}>
              Cetak Laporan (Print)
            </Button>
          </div>
        }
      />

      {/* Tabs Navigation */}
      <div className="no-print">
        <Tabs tabs={tabs} activeTab={activeTab} onChange={(t) => setActiveTab(t)} />
      </div>

      {/* Printable Report Header for Official Export */}
      <div
        className="printable-header"
        style={{
          display: 'none',
          textAlign: 'center',
          borderBottom: '2px solid #000',
          paddingBottom: 14,
          marginBottom: 20
        }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 800 }}>{settings.organization_name}</h2>
        <p style={{ fontSize: 13 }}>{settings.village_name} - {settings.village_address}</p>
        <h3 style={{ fontSize: 15, fontWeight: 700, marginTop: 10, textTransform: 'uppercase' }}>
          {activeTab === 'billing' && `LAPORAN REKAPITULASI TAGIHAN AIR (${formatPeriod(periodMonth, periodYear)})`}
          {activeTab === 'payment' && 'LAPORAN REKAPITULASI PENERIMAAN KAS PEMBAYARAN'}
          {activeTab === 'arrears' && 'LAPORAN DAFTAR TUNGGAKAN & PIUTANG PELANGGAN'}
          {activeTab === 'usage' && `LAPORAN VOLUME KONSUMSI AIR MINUM (${formatPeriod(periodMonth, periodYear)})`}
        </h3>
      </div>

      {/* Filters (No-print) */}
      <Card bodyClassName="p-3" style={{ marginBottom: 14 }} className="no-print">
        <div className="filter-bar" style={{ margin: 0 }}>
          <div className="filter-group">
            {(activeTab === 'billing' || activeTab === 'usage') && (
              <>
                <div style={{ width: 140 }}>
                  <Select
                    label="Bulan"
                    options={INDONESIAN_MONTHS.map((m, idx) => ({ label: m, value: String(idx + 1) }))}
                    value={periodMonth}
                    onChange={(e) => setPeriodMonth(e.target.value)}
                  />
                </div>
                <div style={{ width: 110 }}>
                  <Select
                    label="Tahun"
                    options={[
                      { label: '2026', value: '2026' },
                      { label: '2025', value: '2025' }
                    ]}
                    value={periodYear}
                    onChange={(e) => setPeriodYear(e.target.value)}
                  />
                </div>
              </>
            )}

            {activeTab === 'payment' && (
              <div style={{ width: 180 }}>
                <Select
                  label="Metode Bayar"
                  options={[
                    { label: 'Semua Metode', value: '' },
                    { label: 'Tunai', value: 'Tunai' },
                    { label: 'Transfer Bank', value: 'Transfer Bank' },
                    { label: 'QRIS', value: 'QRIS' }
                  ]}
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                />
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Report Summary Cards */}
      {reportData?.summary && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
            gap: 10,
            marginBottom: 14
          }}
        >
          {activeTab === 'billing' && (
            <>
              <div style={{ backgroundColor: 'var(--slate-50)', padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--slate-200)' }}>
                <div style={{ fontSize: 11, color: 'var(--slate-500)', fontWeight: 600 }}>TOTAL LEMBAR TAGIHAN</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--slate-900)' }}>{reportData.summary.total_bills || reportData.items.length}</div>
              </div>
              <div style={{ backgroundColor: 'var(--slate-50)', padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--slate-200)' }}>
                <div style={{ fontSize: 11, color: 'var(--slate-500)', fontWeight: 600 }}>TOTAL NILAI TAGIHAN</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--primary-700)' }}>{formatRupiah(reportData.summary.total_billed)}</div>
              </div>
              <div style={{ backgroundColor: 'var(--slate-50)', padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--slate-200)' }}>
                <div style={{ fontSize: 11, color: 'var(--slate-500)', fontWeight: 600 }}>SUDAH TERBAYAR</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--success-700)' }}>{formatRupiah(reportData.summary.total_paid)}</div>
              </div>
              <div style={{ backgroundColor: 'var(--slate-50)', padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--slate-200)' }}>
                <div style={{ fontSize: 11, color: 'var(--slate-500)', fontWeight: 600 }}>BELUM LUNAS / TUNGGAKAN</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--danger-700)' }}>{formatRupiah(reportData.summary.total_balance_due)}</div>
              </div>
            </>
          )}

          {activeTab === 'payment' && (
            <>
              <div style={{ backgroundColor: 'var(--slate-50)', padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--slate-200)' }}>
                <div style={{ fontSize: 11, color: 'var(--slate-500)', fontWeight: 600 }}>TOTAL TRANSAKSI</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--slate-900)' }}>{reportData.summary.total_transactions || reportData.items.length}</div>
              </div>
              <div style={{ backgroundColor: 'var(--slate-50)', padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--slate-200)' }}>
                <div style={{ fontSize: 11, color: 'var(--slate-500)', fontWeight: 600 }}>TOTAL PENDAPATAN DITERIMA</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--success-700)' }}>{formatRupiah(reportData.summary.total_revenue)}</div>
              </div>
            </>
          )}

          {activeTab === 'arrears' && (
            <>
              <div style={{ backgroundColor: 'var(--slate-50)', padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--slate-200)' }}>
                <div style={{ fontSize: 11, color: 'var(--slate-500)', fontWeight: 600 }}>JUMLAH WARGA MENUNGGAK</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--danger-700)' }}>{reportData.summary.total_defaulters || reportData.items.length} Pelanggan</div>
              </div>
              <div style={{ backgroundColor: 'var(--slate-50)', padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--slate-200)' }}>
                <div style={{ fontSize: 11, color: 'var(--slate-500)', fontWeight: 600 }}>TOTAL PIUTANG AIR DESA</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--danger-700)' }}>{formatRupiah(reportData.summary.total_arrears_amount)}</div>
              </div>
            </>
          )}

          {activeTab === 'profit_loss' && (
            <>
              <div style={{ backgroundColor: 'var(--slate-50)', padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--slate-200)' }}>
                <div style={{ fontSize: 11, color: 'var(--slate-500)', fontWeight: 600 }}>TOTAL PENDAPATAN KAS AIR</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--success-700)' }}>{formatRupiah(reportData.summary.total_revenue)}</div>
              </div>
              <div style={{ backgroundColor: 'var(--slate-50)', padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--slate-200)' }}>
                <div style={{ fontSize: 11, color: 'var(--slate-500)', fontWeight: 600 }}>TOTAL BIAYA PEMELIHARAAN</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--danger-700)' }}>{formatRupiah(reportData.summary.total_expense)}</div>
              </div>
              <div style={{ backgroundColor: reportData.summary.net_profit >= 0 ? 'var(--primary-50)' : 'var(--danger-50)', padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--primary-200)' }}>
                <div style={{ fontSize: 11, color: 'var(--primary-800)', fontWeight: 700 }}>LABA BERSIH (SHU AIR BUMDES)</div>
                <div style={{ fontSize: 19, fontWeight: 900, color: reportData.summary.net_profit >= 0 ? 'var(--primary-700)' : 'var(--danger-700)' }}>
                  {formatRupiah(reportData.summary.net_profit)}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Main Table Content */}
      <Card>
        {loading ? (
          <LoadingSpinner text="Menghitung rekapitulasi data laporan..." />
        ) : (
          <DataTable
            columns={
              activeTab === 'billing'
                ? [
                    { header: 'No. Tagihan', render: (i: any) => <strong>{i.bill_no}</strong> },
                    { header: 'Nama Pelanggan', render: (i: any) => `${i.customer_name} (${i.customer_no})` },
                    { header: 'RT/RW', accessor: 'rt_rw' },
                    { header: 'Pemakaian', render: (i: any) => formatM3(i.usage_m3) },
                    { header: 'Total Tagihan', render: (i: any) => <strong>{formatRupiah(i.total_amount)}</strong> },
                    { header: 'Terbayar', render: (i: any) => <span style={{ color: 'var(--success-700)' }}>{formatRupiah(i.paid_amount)}</span> },
                    { header: 'Sisa', render: (i: any) => <span style={{ color: i.balance_due > 0 ? 'var(--danger-700)' : 'inherit', fontWeight: 600 }}>{formatRupiah(i.balance_due)}</span> },
                    { header: 'Status', render: (i: any) => <Badge status={i.status} /> }
                  ]
                : activeTab === 'payment'
                ? [
                    { header: 'No. Transaksi', render: (i: any) => <strong>{i.payment_no}</strong> },
                    { header: 'Tanggal', render: (i: any) => formatDateTime(i.payment_date || i.created_at) },
                    { header: 'Nama Pelanggan', render: (i: any) => `${i.customer_name} (${i.customer_no})` },
                    { header: 'Metode', render: (i: any) => <Badge variant="neutral">{i.payment_method}</Badge> },
                    { header: 'Jumlah Penerimaan', render: (i: any) => <strong style={{ color: 'var(--success-700)' }}>{formatRupiah(i.amount_paid)}</strong> }
                  ]
                : activeTab === 'arrears'
                ? [
                    { header: 'ID Pelanggan', render: (i: any) => <strong>{i.customer_no}</strong> },
                    { header: 'Nama Pelanggan', render: (i: any) => <strong>{i.customer_name}</strong> },
                    { header: 'RT/RW', accessor: 'rt_rw' },
                    { header: 'Kontak HP', accessor: 'phone' },
                    { header: 'Lama Menunggak', render: (i: any) => `${i.unpaid_months_count} Bulan` },
                    { header: 'Total Tunggakan', render: (i: any) => <strong style={{ color: 'var(--danger-700)', fontSize: 14 }}>{formatRupiah(i.total_arrears)}</strong> }
                  ]
                : activeTab === 'usage'
                ? [
                    { header: 'No. Pencatatan', render: (i: any) => <strong>{i.reading_no}</strong> },
                    { header: 'Nama Pelanggan', render: (i: any) => `${i.customer_name} (${i.customer_no})` },
                    { header: 'RT/RW', accessor: 'rt_rw' },
                    { header: 'Meter Awal', render: (i: any) => `${i.prev_reading} m³` },
                    { header: 'Meter Akhir', render: (i: any) => `${i.current_reading} m³` },
                    { header: 'Volume Pemakaian', render: (i: any) => <strong style={{ color: 'var(--primary-700)' }}>{formatM3(i.usage_m3)}</strong> }
                  ]
                : [
                    { header: 'No. Biaya', render: (i: any) => <strong>{i.expense_no}</strong> },
                    { header: 'Tanggal', render: (i: any) => formatDate(i.expense_date) },
                    { header: 'Kategori', render: (i: any) => <Badge variant="neutral">{i.category}</Badge> },
                    { header: 'Keperluan & Rincian', render: (i: any) => (
                      <div>
                        <strong>{i.title}</strong>
                        {i.description && <div style={{ fontSize: 11, color: 'var(--slate-500)' }}>{i.description}</div>}
                      </div>
                    )},
                    { header: 'Biaya Pengeluaran', render: (i: any) => <strong style={{ color: 'var(--danger-700)', fontSize: 14 }}>{formatRupiah(i.amount)}</strong> }
                  ]
            }
            data={reportData?.items || []}
            emptyTitle="Data Kosong"
            emptyMessage="Tidak ada data laporan yang ditemukan untuk kriteria ini."
          />
        )}
      </Card>
    </div>
  );
};
