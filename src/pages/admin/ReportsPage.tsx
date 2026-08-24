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
  DollarSign,
  Droplets
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
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }} className="no-print">
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
      <div className="no-print" style={{ width: '100%', overflowX: 'auto' }}>
        <Tabs tabs={tabs} activeTab={activeTab} onChange={(t) => setActiveTab(t)} />
      </div>

      {/* ========================================================================= */}
      {/* SPREADSHEET-STYLE FORMAL REPORT (VISIBLE ONLY WHEN PRINTING)              */}
      {/* ========================================================================= */}
      <div className="print-only">
        {/* Spreadsheet Document Header */}
        <div className="sheet-header-block">
          <div className="sheet-header-title">{settings.organization_name || 'BUMDes Tirta Sandmosquito'}</div>
          <div className="sheet-header-sub">
            {settings.village_name} - {settings.village_address} | Telp: {settings.contact_phone}
          </div>
          <div className="sheet-doc-title">
            {activeTab === 'billing' && `LAPORAN REKAPITULASI TAGIHAN AIR BULANAN`}
            {activeTab === 'payment' && `LAPORAN PENERIMAAN KAS PEMBAYARAN AIR`}
            {activeTab === 'arrears' && `LAPORAN DAFTAR TUNGGAKAN & PIUTANG PELANGGAN`}
            {activeTab === 'usage' && `LAPORAN REKAPITULASI KONSUMSI VOLUME AIR`}
            {activeTab === 'profit_loss' && `LAPORAN NERACA KEUANGAN & PEMELIHARAAN AIR`}
          </div>
        </div>

        {/* Spreadsheet Meta Information Bar */}
        <div className="sheet-meta-bar">
          <div><strong>Periode:</strong> {formatPeriod(Number(periodMonth), Number(periodYear))}</div>
          <div><strong>Kriteria:</strong> {paymentMethod ? `Metode: ${paymentMethod}` : 'Seluruh Data'}</div>
          <div><strong>Waktu Cetak:</strong> {formatDateTime(new Date().toISOString())}</div>
          <div><strong>Unit:</strong> Pengelola Air Desa</div>
        </div>

        {/* Spreadsheet KPI Summary Table */}
        {reportData?.summary && (
          <table className="sheet-table" style={{ marginBottom: 12, fontSize: '9pt' }}>
            <tbody>
              {activeTab === 'billing' && (
                <tr style={{ backgroundColor: '#f8fafc' }}>
                  <td>Total Lembar: <strong>{reportData.summary.total_bills || reportData.items.length} Faktur</strong></td>
                  <td>Total Pemakaian: <strong>{formatM3(reportData.summary.total_usage_m3)}</strong></td>
                  <td>Total Tagihan: <strong>{formatRupiah(reportData.summary.total_billed)}</strong></td>
                  <td>Terbayar: <strong style={{ color: '#047857' }}>{formatRupiah(reportData.summary.total_paid)}</strong></td>
                  <td>Sisa Piutang: <strong style={{ color: '#b91c1c' }}>{formatRupiah(reportData.summary.total_balance_due)}</strong></td>
                </tr>
              )}
              {activeTab === 'payment' && (
                <tr style={{ backgroundColor: '#f8fafc' }}>
                  <td>Total Transaksi: <strong>{reportData.summary.total_transactions || reportData.items.length} Transaksi</strong></td>
                  <td>Total Kas Diterima: <strong style={{ color: '#047857' }}>{formatRupiah(reportData.summary.total_revenue)}</strong></td>
                </tr>
              )}
              {activeTab === 'arrears' && (
                <tr style={{ backgroundColor: '#f8fafc' }}>
                  <td>Jumlah Warga Menunggak: <strong>{reportData.summary.total_defaulters || reportData.items.length} Pelanggan</strong></td>
                  <td>Total Piutang Air: <strong style={{ color: '#b91c1c' }}>{formatRupiah(reportData.summary.total_arrears_amount)}</strong></td>
                </tr>
              )}
              {activeTab === 'usage' && (
                <tr style={{ backgroundColor: '#f8fafc' }}>
                  <td>Total Rumah Tercatat: <strong>{reportData.summary.total_readings || reportData.items.length} Rumah</strong></td>
                  <td>Total Volume Pemakaian: <strong>{formatM3(reportData.summary.total_usage_m3)}</strong></td>
                </tr>
              )}
              {activeTab === 'profit_loss' && (
                <tr style={{ backgroundColor: '#f8fafc' }}>
                  <td>Pendapatan Kas Air: <strong style={{ color: '#047857' }}>{formatRupiah(reportData.summary.total_revenue)}</strong></td>
                  <td>Biaya Pemeliharaan: <strong style={{ color: '#b91c1c' }}>{formatRupiah(reportData.summary.total_expense)}</strong></td>
                  <td>Laba Bersih Air (SHU): <strong>{formatRupiah(reportData.summary.net_profit)}</strong></td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        {/* Spreadsheet Data Grid */}
        <table className="sheet-table">
          <thead>
            {activeTab === 'billing' && (
              <tr>
                <th style={{ width: '30px' }}>No</th>
                <th>No. Faktur</th>
                <th>No. Pel</th>
                <th>Nama Pelanggan</th>
                <th>RT/RW</th>
                <th style={{ textAlign: 'center' }}>Pakai (m³)</th>
                <th style={{ textAlign: 'right' }}>Tagihan (Rp)</th>
                <th style={{ textAlign: 'right' }}>Terbayar (Rp)</th>
                <th style={{ textAlign: 'right' }}>Sisa (Rp)</th>
                <th style={{ textAlign: 'center' }}>Status</th>
              </tr>
            )}
            {activeTab === 'payment' && (
              <tr>
                <th style={{ width: '30px' }}>No</th>
                <th>No. Bukti Kas</th>
                <th>Waktu Transaksi</th>
                <th>No. Pel</th>
                <th>Nama Pelanggan</th>
                <th>Metode</th>
                <th style={{ textAlign: 'right' }}>Kas Diterima (Rp)</th>
              </tr>
            )}
            {activeTab === 'arrears' && (
              <tr>
                <th style={{ width: '30px' }}>No</th>
                <th>No. Pel</th>
                <th>Nama Pelanggan</th>
                <th>RT/RW</th>
                <th>Kontak HP</th>
                <th style={{ textAlign: 'center' }}>Lama Tunggakan</th>
                <th style={{ textAlign: 'right' }}>Total Piutang (Rp)</th>
              </tr>
            )}
            {activeTab === 'usage' && (
              <tr>
                <th style={{ width: '30px' }}>No</th>
                <th>No. Catat</th>
                <th>No. Pel</th>
                <th>Nama Pelanggan</th>
                <th>RT/RW</th>
                <th style={{ textAlign: 'center' }}>Meter Awal</th>
                <th style={{ textAlign: 'center' }}>Meter Akhir</th>
                <th style={{ textAlign: 'center' }}>Volume (m³)</th>
              </tr>
            )}
            {activeTab === 'profit_loss' && (
              <tr>
                <th style={{ width: '30px' }}>No</th>
                <th>No. Transaksi</th>
                <th>Tanggal</th>
                <th>Kategori</th>
                <th>Keperluan / Rincian Biaya</th>
                <th style={{ textAlign: 'right' }}>Pengeluaran (Rp)</th>
              </tr>
            )}
          </thead>
          <tbody>
            {(reportData?.items || []).map((row: any, idx: number) => {
              if (activeTab === 'billing') {
                return (
                  <tr key={row.id || idx}>
                    <td style={{ textAlign: 'center' }}>{idx + 1}</td>
                    <td>{row.bill_no}</td>
                    <td>{row.customer_no}</td>
                    <td><strong>{row.customer_name}</strong></td>
                    <td>{row.rt_rw}</td>
                    <td style={{ textAlign: 'center' }}>{formatM3(row.usage_m3)}</td>
                    <td style={{ textAlign: 'right' }}>{formatRupiah(row.total_amount)}</td>
                    <td style={{ textAlign: 'right' }}>{formatRupiah(row.paid_amount)}</td>
                    <td style={{ textAlign: 'right', fontWeight: row.balance_due > 0 ? 700 : 400 }}>
                      {formatRupiah(row.balance_due)}
                    </td>
                    <td style={{ textAlign: 'center', fontSize: '8.5pt' }}>
                      {row.status === 'Lunas' ? 'LUNAS' : row.status === 'Jatuh Tempo' ? 'JATUH TEMPO' : 'BELUM LUNAS'}
                    </td>
                  </tr>
                );
              }
              if (activeTab === 'payment') {
                return (
                  <tr key={row.id || idx}>
                    <td style={{ textAlign: 'center' }}>{idx + 1}</td>
                    <td>{row.payment_no}</td>
                    <td>{formatDateTime(row.payment_date || row.created_at)}</td>
                    <td>{row.customer_no}</td>
                    <td><strong>{row.customer_name}</strong></td>
                    <td>{row.payment_method}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatRupiah(row.amount_paid)}</td>
                  </tr>
                );
              }
              if (activeTab === 'arrears') {
                return (
                  <tr key={row.customer_id || idx}>
                    <td style={{ textAlign: 'center' }}>{idx + 1}</td>
                    <td>{row.customer_no}</td>
                    <td><strong>{row.customer_name}</strong></td>
                    <td>{row.rt_rw}</td>
                    <td>{row.phone || '-'}</td>
                    <td style={{ textAlign: 'center' }}>{row.unpaid_months_count} Bulan</td>
                    <td style={{ textAlign: 'right', fontWeight: 800 }}>{formatRupiah(row.total_arrears)}</td>
                  </tr>
                );
              }
              if (activeTab === 'usage') {
                return (
                  <tr key={row.id || idx}>
                    <td style={{ textAlign: 'center' }}>{idx + 1}</td>
                    <td>{row.reading_no}</td>
                    <td>{row.customer_no}</td>
                    <td><strong>{row.customer_name}</strong></td>
                    <td>{row.rt_rw}</td>
                    <td style={{ textAlign: 'center' }}>{row.prev_reading}</td>
                    <td style={{ textAlign: 'center' }}>{row.current_reading}</td>
                    <td style={{ textAlign: 'center', fontWeight: 700 }}>{formatM3(row.usage_m3)}</td>
                  </tr>
                );
              }
              return (
                <tr key={row.id || idx}>
                  <td style={{ textAlign: 'center' }}>{idx + 1}</td>
                  <td>{row.expense_no}</td>
                  <td>{formatDate(row.expense_date)}</td>
                  <td>{row.category}</td>
                  <td>
                    <strong>{row.title}</strong>
                    {row.description ? ` - ${row.description}` : ''}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatRupiah(row.amount)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            {activeTab === 'billing' && (
              <tr className="sheet-total-row">
                <td colSpan={5} style={{ textAlign: 'right' }}>TOTAL REKAPITULASI:</td>
                <td style={{ textAlign: 'center' }}>{formatM3(reportData?.summary?.total_usage_m3)}</td>
                <td style={{ textAlign: 'right' }}>{formatRupiah(reportData?.summary?.total_billed)}</td>
                <td style={{ textAlign: 'right' }}>{formatRupiah(reportData?.summary?.total_paid)}</td>
                <td style={{ textAlign: 'right' }}>{formatRupiah(reportData?.summary?.total_balance_due)}</td>
                <td></td>
              </tr>
            )}
            {activeTab === 'payment' && (
              <tr className="sheet-total-row">
                <td colSpan={6} style={{ textAlign: 'right' }}>TOTAL KAS PENERIMAAN:</td>
                <td style={{ textAlign: 'right' }}>{formatRupiah(reportData?.summary?.total_revenue)}</td>
              </tr>
            )}
            {activeTab === 'arrears' && (
              <tr className="sheet-total-row">
                <td colSpan={6} style={{ textAlign: 'right' }}>TOTAL PIUTANG WARGA:</td>
                <td style={{ textAlign: 'right' }}>{formatRupiah(reportData?.summary?.total_arrears_amount)}</td>
              </tr>
            )}
            {activeTab === 'usage' && (
              <tr className="sheet-total-row">
                <td colSpan={7} style={{ textAlign: 'right' }}>TOTAL VOLUME PEMAKAIAN:</td>
                <td style={{ textAlign: 'center' }}>{formatM3(reportData?.summary?.total_usage_m3)}</td>
              </tr>
            )}
            {activeTab === 'profit_loss' && (
              <tr className="sheet-total-row">
                <td colSpan={5} style={{ textAlign: 'right' }}>TOTAL BIAYA PEMELIHARAAN:</td>
                <td style={{ textAlign: 'right' }}>{formatRupiah(reportData?.summary?.total_expense)}</td>
              </tr>
            )}
          </tfoot>
        </table>

        {/* Spreadsheet Formal Signatures Block */}
        <div className="sheet-signatures">
          <div className="sheet-sig-col">
            <div>Mengetahui,</div>
            <div className="sheet-sig-title">Kepala Desa {settings.village_name || ''}</div>
            <div className="sheet-sig-space" />
            <div className="sheet-sig-name">( ________________________ )</div>
          </div>
          <div className="sheet-sig-col">
            <div>Penanggung Jawab,</div>
            <div className="sheet-sig-title">Direktur {settings.organization_name || 'BUMDes'}</div>
            <div className="sheet-sig-space" />
            <div className="sheet-sig-name">( ________________________ )</div>
          </div>
          <div className="sheet-sig-col">
            <div>Dibuat Oleh,</div>
            <div className="sheet-sig-title">Bendahara / Petugas Loket</div>
            <div className="sheet-sig-space" />
            <div className="sheet-sig-name">( ________________________ )</div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SCREEN VIEW (CARDS, TABS, INTERACTIVE TABLES) - HIDDEN ON PRINT           */}
      {/* ========================================================================= */}
      <div className="screen-only">
        {/* Filters */}
        <Card bodyClassName="p-3" style={{ marginBottom: 14 }}>
          <div className="filter-bar" style={{ margin: 0 }}>
            <div className="filter-group" style={{ flexWrap: 'wrap' }}>
              {(activeTab === 'billing' || activeTab === 'usage') && (
                <>
                  <div style={{ minWidth: 120, flex: 1 }}>
                    <Select
                      label="Bulan"
                      options={INDONESIAN_MONTHS.map((m, idx) => ({ label: m, value: String(idx + 1) }))}
                      value={periodMonth}
                      onChange={(e) => setPeriodMonth(e.target.value)}
                    />
                  </div>
                  <div style={{ minWidth: 100, flex: 1 }}>
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
                <div style={{ minWidth: 160, flex: 1 }}>
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
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))',
              gap: 10,
              marginBottom: 14
            }}
          >
            {activeTab === 'billing' && (
              <>
                <div style={{ backgroundColor: 'var(--card-bg)', padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--slate-200)' }}>
                  <div style={{ fontSize: 11, color: 'var(--slate-500)', fontWeight: 600 }}>TOTAL LEMBAR TAGIHAN</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--slate-900)' }}>{reportData.summary.total_bills || reportData.items.length}</div>
                </div>
                <div style={{ backgroundColor: 'var(--card-bg)', padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--slate-200)' }}>
                  <div style={{ fontSize: 11, color: 'var(--slate-500)', fontWeight: 600 }}>TOTAL NILAI TAGIHAN</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--primary-700)' }}>{formatRupiah(reportData.summary.total_billed)}</div>
                </div>
                <div style={{ backgroundColor: 'var(--card-bg)', padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--slate-200)' }}>
                  <div style={{ fontSize: 11, color: 'var(--slate-500)', fontWeight: 600 }}>SUDAH TERBAYAR</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--success-700)' }}>{formatRupiah(reportData.summary.total_paid)}</div>
                </div>
                <div style={{ backgroundColor: 'var(--card-bg)', padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--slate-200)' }}>
                  <div style={{ fontSize: 11, color: 'var(--slate-500)', fontWeight: 600 }}>BELUM LUNAS / TUNGGAKAN</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--danger-700)' }}>{formatRupiah(reportData.summary.total_balance_due)}</div>
                </div>
              </>
            )}

            {activeTab === 'payment' && (
              <>
                <div style={{ backgroundColor: 'var(--card-bg)', padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--slate-200)' }}>
                  <div style={{ fontSize: 11, color: 'var(--slate-500)', fontWeight: 600 }}>TOTAL TRANSAKSI</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--slate-900)' }}>{reportData.summary.total_transactions || reportData.items.length}</div>
                </div>
                <div style={{ backgroundColor: 'var(--card-bg)', padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--slate-200)' }}>
                  <div style={{ fontSize: 11, color: 'var(--slate-500)', fontWeight: 600 }}>TOTAL PENDAPATAN DITERIMA</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--success-700)' }}>{formatRupiah(reportData.summary.total_revenue)}</div>
                </div>
              </>
            )}

            {activeTab === 'arrears' && (
              <>
                <div style={{ backgroundColor: 'var(--card-bg)', padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--slate-200)' }}>
                  <div style={{ fontSize: 11, color: 'var(--slate-500)', fontWeight: 600 }}>JUMLAH WARGA MENUNGGAK</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--danger-700)' }}>{reportData.summary.total_defaulters || reportData.items.length} Pelanggan</div>
                </div>
                <div style={{ backgroundColor: 'var(--card-bg)', padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--slate-200)' }}>
                  <div style={{ fontSize: 11, color: 'var(--slate-500)', fontWeight: 600 }}>TOTAL PIUTANG AIR DESA</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--danger-700)' }}>{formatRupiah(reportData.summary.total_arrears_amount)}</div>
                </div>
              </>
            )}

            {activeTab === 'profit_loss' && (
              <>
                <div style={{ backgroundColor: 'var(--card-bg)', padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--slate-200)' }}>
                  <div style={{ fontSize: 11, color: 'var(--slate-500)', fontWeight: 600 }}>TOTAL PENDAPATAN KAS AIR</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--success-700)' }}>{formatRupiah(reportData.summary.total_revenue)}</div>
                </div>
                <div style={{ backgroundColor: 'var(--card-bg)', padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--slate-200)' }}>
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
    </div>
  );
};
