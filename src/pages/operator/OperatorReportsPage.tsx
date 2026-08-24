import React, { useState, useEffect, useCallback } from 'react';
import { BarChart3, Download, Printer, CreditCard, ClipboardPen } from 'lucide-react';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { DataTable } from '../../components/common/DataTable';
import { Tabs, TabItem } from '../../components/common/Tabs';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { useToast } from '../../context/ToastContext';
import { useSettings } from '../../context/SettingsContext';
import { api } from '../../services/api';
import { exportToCsv } from '../../utils/exportCsv';
import { formatRupiah, formatM3, formatDate, formatDateTime } from '../../utils/formatters';

export const OperatorReportsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('cashier');
  const [loading, setLoading] = useState<boolean>(true);
  const [payments, setPayments] = useState<any[]>([]);
  const [readings, setReadings] = useState<any[]>([]);

  const { success, error: toastError } = useToast();
  const { settings } = useSettings();

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [payData, readData] = await Promise.all([
        api.getPayments(),
        api.getReadings()
      ]);
      setPayments(payData);
      setReadings(readData);
    } catch (err: any) {
      toastError(err.message || 'Gagal memuat laporan harian.');
    } finally {
      setLoading(false);
    }
  }, [toastError]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalCollected = payments.reduce((acc, p) => acc + (p.amount_paid || 0), 0);
  const totalVolume = readings.reduce((acc, r) => acc + (r.usage_m3 || 0), 0);

  const handlePrint = () => window.print();

  const handleExport = () => {
    if (activeTab === 'cashier') {
      const headers = ['No. Bukti', 'Tanggal', 'Nama Pelanggan', 'Metode', 'Jumlah Bayar'];
      const rows = payments.map((p) => [
        p.payment_no, p.payment_date || p.created_at, p.customer_name, p.payment_method, p.amount_paid
      ]);
      exportToCsv('rekap-kasir-harian', headers, rows);
    } else {
      const headers = ['No. Catat', 'Tanggal', 'Nama Pelanggan', 'Meter Awal', 'Meter Akhir', 'Pemakaian (m3)'];
      const rows = readings.map((r) => [
        r.reading_no, r.reading_date, r.customer_name, r.prev_reading, r.current_reading, r.usage_m3
      ]);
      exportToCsv('rekap-pembacaan-meter', headers, rows);
    }
    success('Laporan berhasil diexport ke CSV.');
  };

  const tabs: TabItem[] = [
    { id: 'cashier', label: '1. Penerimaan Kas Loket', icon: <CreditCard size={16} /> },
    { id: 'meter', label: '2. Rekap Pembacaan Meter', icon: <ClipboardPen size={16} /> }
  ];

  return (
    <div>
      <PageHeader
        title="Laporan Operasional Petugas"
        subtitle="Rekapitulasi penerimaan uang kas loket desa dan pencatatan meteran lapangan."
        action={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }} className="no-print">
            <Button variant="secondary" icon={<Download size={16} />} onClick={handleExport}>
              Export CSV
            </Button>
            <Button variant="primary" icon={<Printer size={16} />} onClick={handlePrint}>
              Cetak Laporan
            </Button>
          </div>
        }
      />

      <div className="no-print" style={{ width: '100%', overflowX: 'auto' }}>
        <Tabs tabs={tabs} activeTab={activeTab} onChange={(t) => setActiveTab(t)} />
      </div>

      {/* ========================================================================= */}
      {/* SPREADSHEET-STYLE FORMAL REPORT VIEW (PRINT MODE ONLY)                     */}
      {/* ========================================================================= */}
      <div className="print-only">
        {/* Spreadsheet Header */}
        <div className="sheet-header-block">
          <div className="sheet-header-title">{settings.organization_name || 'BUMDes Tirta Sandmosquito'}</div>
          <div className="sheet-header-sub">{settings.village_name} - {settings.village_address}</div>
          <div className="sheet-doc-title">
            {activeTab === 'cashier'
              ? 'LAPORAN REKAPITULASI PENERIMAAN KAS HARIAN LOKET'
              : 'LAPORAN REKAPITULASI PENCATATAN STAND METERAN AIR'}
          </div>
        </div>

        {/* Spreadsheet Meta Information Bar */}
        <div className="sheet-meta-bar">
          <div><strong>Jenis Laporan:</strong> {activeTab === 'cashier' ? 'Kasir / Loket Pembayaran' : 'Pencatatan Meter Lapangan'}</div>
          <div><strong>Waktu Cetak:</strong> {formatDateTime(new Date().toISOString())}</div>
          <div><strong>Unit:</strong> Petugas Lapangan BUMDes</div>
        </div>

        {/* Spreadsheet Summary Table */}
        <table className="sheet-table" style={{ marginBottom: 12, fontSize: '9pt' }}>
          <tbody>
            <tr style={{ backgroundColor: '#f8fafc' }}>
              {activeTab === 'cashier' ? (
                <>
                  <td>Total Transaksi: <strong>{payments.length} Transaksi</strong></td>
                  <td>Total Uang Kas Diterima: <strong style={{ color: '#047857' }}>{formatRupiah(totalCollected)}</strong></td>
                </>
              ) : (
                <>
                  <td>Total Rumah Tercatat: <strong>{readings.length} Rumah Pelanggan</strong></td>
                  <td>Total Volume Air Tercatat: <strong style={{ color: '#0284c7' }}>{formatM3(totalVolume)}</strong></td>
                </>
              )}
            </tr>
          </tbody>
        </table>

        {/* Spreadsheet Master Table */}
        <table className="sheet-table">
          <thead>
            {activeTab === 'cashier' ? (
              <tr>
                <th style={{ width: '30px' }}>No</th>
                <th>No. Bukti Kas</th>
                <th>Waktu Transaksi</th>
                <th>No. Pel</th>
                <th>Nama Pelanggan</th>
                <th>Metode</th>
                <th style={{ textAlign: 'right' }}>Jumlah Bayar (Rp)</th>
              </tr>
            ) : (
              <tr>
                <th style={{ width: '30px' }}>No</th>
                <th>No. Catat</th>
                <th>No. Pel</th>
                <th>Nama Pelanggan</th>
                <th>RT/RW</th>
                <th style={{ textAlign: 'center' }}>Meter Lalu</th>
                <th style={{ textAlign: 'center' }}>Meter Kini</th>
                <th style={{ textAlign: 'center' }}>Pemakaian (m³)</th>
              </tr>
            )}
          </thead>
          <tbody>
            {activeTab === 'cashier'
              ? payments.map((p, idx) => (
                  <tr key={p.id || idx}>
                    <td style={{ textAlign: 'center' }}>{idx + 1}</td>
                    <td>{p.payment_no}</td>
                    <td>{formatDateTime(p.payment_date || p.created_at)}</td>
                    <td>{p.customer_no}</td>
                    <td><strong>{p.customer_name}</strong></td>
                    <td>{p.payment_method}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatRupiah(p.amount_paid)}</td>
                  </tr>
                ))
              : readings.map((r, idx) => (
                  <tr key={r.id || idx}>
                    <td style={{ textAlign: 'center' }}>{idx + 1}</td>
                    <td>{r.reading_no}</td>
                    <td>{r.customer_no}</td>
                    <td><strong>{r.customer_name}</strong></td>
                    <td>{r.rt_rw}</td>
                    <td style={{ textAlign: 'center' }}>{r.prev_reading}</td>
                    <td style={{ textAlign: 'center' }}>{r.current_reading}</td>
                    <td style={{ textAlign: 'center', fontWeight: 700 }}>{formatM3(r.usage_m3)}</td>
                  </tr>
                ))}
          </tbody>
          <tfoot>
            <tr className="sheet-total-row">
              {activeTab === 'cashier' ? (
                <>
                  <td colSpan={6} style={{ textAlign: 'right' }}>TOTAL KAS PENERIMAAN:</td>
                  <td style={{ textAlign: 'right' }}>{formatRupiah(totalCollected)}</td>
                </>
              ) : (
                <>
                  <td colSpan={7} style={{ textAlign: 'right' }}>TOTAL VOLUME PEMAKAIAN:</td>
                  <td style={{ textAlign: 'center' }}>{formatM3(totalVolume)}</td>
                </>
              )}
            </tr>
          </tfoot>
        </table>

        {/* Spreadsheet Signatures */}
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
            <div>Petugas Pelaksana,</div>
            <div className="sheet-sig-title">Kasir / Operator Lapangan</div>
            <div className="sheet-sig-space" />
            <div className="sheet-sig-name">( ________________________ )</div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SCREEN ONLY VIEW                                                          */}
      {/* ========================================================================= */}
      <div className="screen-only">
        {/* Summary Box */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))',
            gap: 14,
            marginBottom: 20
          }}
        >
          <div style={{ backgroundColor: 'var(--card-bg)', padding: 18, borderRadius: 'var(--radius-md)', border: '1px solid var(--slate-200)' }}>
            <div style={{ fontSize: 12, color: 'var(--slate-500)', fontWeight: 600 }}>
              {activeTab === 'cashier' ? 'TOTAL TRANSAKSI KAS' : 'TOTAL RUMAH TERCATAT'}
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--slate-900)' }}>
              {activeTab === 'cashier' ? `${payments.length} Transaksi` : `${readings.length} Rumah`}
            </div>
          </div>

          <div style={{ backgroundColor: 'var(--card-bg)', padding: 18, borderRadius: 'var(--radius-md)', border: '1px solid var(--slate-200)' }}>
            <div style={{ fontSize: 12, color: 'var(--slate-500)', fontWeight: 600 }}>
              {activeTab === 'cashier' ? 'TOTAL UANG DITERIMA' : 'TOTAL VOLUME AIR TERCATAT'}
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: activeTab === 'cashier' ? 'var(--success-700)' : 'var(--primary-700)' }}>
              {activeTab === 'cashier' ? formatRupiah(totalCollected) : formatM3(totalVolume)}
            </div>
          </div>
        </div>

        <Card>
          {loading ? (
            <LoadingSpinner text="Memuat laporan..." />
          ) : (
            <DataTable
              columns={
                activeTab === 'cashier'
                  ? [
                      { header: 'No. Bukti', render: (p: any) => <strong>{p.payment_no}</strong> },
                      { header: 'Waktu Transaksi', render: (p: any) => formatDateTime(p.payment_date || p.created_at) },
                      { header: 'Nama Pelanggan', render: (p: any) => `${p.customer_name} (${p.customer_no})` },
                      { header: 'Metode', render: (p: any) => p.payment_method },
                      { header: 'Jumlah Dibayar', render: (p: any) => <strong style={{ color: 'var(--success-700)' }}>{formatRupiah(p.amount_paid)}</strong> }
                    ]
                  : [
                      { header: 'No. Catat', render: (r: any) => <strong>{r.reading_no}</strong> },
                      { header: 'Nama Pelanggan', render: (r: any) => `${r.customer_name} (${r.customer_no})` },
                      { header: 'RT/RW', accessor: 'rt_rw' },
                      { header: 'Meter Lalu', render: (r: any) => `${r.prev_reading} m³` },
                      { header: 'Meter Kini', render: (r: any) => `${r.current_reading} m³` },
                      { header: 'Pemakaian Air', render: (r: any) => <strong style={{ color: 'var(--primary-700)' }}>{formatM3(r.usage_m3)}</strong> }
                    ]
              }
              data={activeTab === 'cashier' ? payments : readings}
            />
          )}
        </Card>
      </div>
    </div>
  );
};
