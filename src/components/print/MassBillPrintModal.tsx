import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { Printer, Droplets, FileSpreadsheet, LayoutList, Layers } from 'lucide-react';
import { Bill } from '../../types';
import { formatRupiah, formatM3, formatDate, formatPeriod } from '../../utils/formatters';
import { useSettings } from '../../context/SettingsContext';

export interface MassBillPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  bills: Bill[];
  selectedMonth?: string;
  selectedYear?: string;
  selectedRt?: string;
}

export const MassBillPrintModal: React.FC<MassBillPrintModalProps> = ({
  isOpen,
  onClose,
  bills,
  selectedMonth = '8',
  selectedYear = '2026',
  selectedRt = ''
}) => {
  const { settings } = useSettings();
  const [printLayout, setPrintLayout] = useState<'2up' | 'ledger'>('2up');

  if (!isOpen) return null;

  const totalUsage = bills.reduce((sum, b) => sum + (b.usage_m3 || 0), 0);
  const totalAmount = bills.reduce((sum, b) => sum + (b.total_amount || 0), 0);
  const totalSubsidy = bills.reduce((sum, b) => sum + (b.subsidy_amount || 0), 0);
  const totalUnpaid = bills.filter(b => b.status !== 'Lunas').length;

  const handlePrint = () => {
    window.print();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Printer size={20} color="var(--primary-600)" />
          <span>Cetak Massal Tagihan Air ({bills.length} Pelanggan)</span>
        </div>
      }
      footer={
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--slate-600)' }}>Format Cetak:</span>
            <Button
              variant={printLayout === '2up' ? 'primary' : 'secondary'}
              size="sm"
              icon={<Layers size={14} />}
              onClick={() => setPrintLayout('2up')}
            >
              Faktur 2-Per-Halaman (A4)
            </Button>
            <Button
              variant={printLayout === 'ledger' ? 'primary' : 'secondary'}
              size="sm"
              icon={<FileSpreadsheet size={14} />}
              onClick={() => setPrintLayout('ledger')}
            >
              Rekap Buku Tagihan (Tabel)
            </Button>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="secondary" onClick={onClose}>
              Tutup
            </Button>
            <Button variant="primary" icon={<Printer size={16} />} onClick={handlePrint}>
              Cetak Dokumen ({bills.length} Data)
            </Button>
          </div>
        </div>
      }
    >
      <div className="printable-area" style={{ padding: '4px' }}>
        {/* Screen Summary Bar (Hidden during actual print) */}
        <div
          className="no-print"
          style={{
            backgroundColor: 'var(--primary-50)',
            border: '1px solid var(--primary-200)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 16px',
            marginBottom: 16,
            display: 'flex',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
            fontSize: 13
          }}
        >
          <div>
            <strong>Periode:</strong> {formatPeriod(Number(selectedMonth), Number(selectedYear))} | <strong>Wilayah:</strong> {selectedRt || 'Semua Wilayah'}
          </div>
          <div>
            <strong>Total Lembar:</strong> {bills.length} | <strong>Total Pemakaian:</strong> {formatM3(totalUsage)} | <strong>Total Tagihan:</strong> {formatRupiah(totalAmount)}
          </div>
        </div>

        {/* ==================== LAYOUT 1: 2-UP INVOICES (2 PER PAGE WITH PERFORATION) ==================== */}
        {printLayout === '2up' && (
          <div className="print-invoices-flow">
            {bills.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--slate-500)' }}>
                Tidak ada data tagihan yang sesuai filter untuk dicetak.
              </div>
            ) : (
              bills.map((bill, index) => {
                const isEven = (index + 1) % 2 === 0;
                return (
                  <React.Fragment key={bill.id}>
                    <div className="print-bill-card-2up" style={{ marginBottom: 14 }}>
                      {/* Kop Faktur */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          borderBottom: '2px solid #0f172a',
                          paddingBottom: 8,
                          marginBottom: 10
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Droplets size={20} color="var(--primary-600)" />
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>
                              {settings.organization_name || 'BUMDes Tirta Sandmosquito'}
                            </div>
                            <div style={{ fontSize: 10, color: '#475569' }}>
                              {settings.village_name} • Telp: {settings.contact_phone}
                            </div>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 11, fontWeight: 800, color: '#0284c7' }}>
                            FAKTUR TAGIHAN AIR
                          </div>
                          <div style={{ fontSize: 10, fontWeight: 700, color: '#334155' }}>
                            {bill.bill_no}
                          </div>
                        </div>
                      </div>

                      {/* Info Pelanggan & Meter */}
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(3, 1fr)',
                          gap: 8,
                          backgroundColor: '#f8fafc',
                          padding: 8,
                          borderRadius: 4,
                          fontSize: 11,
                          marginBottom: 8,
                          border: '1px solid #e2e8f0'
                        }}
                      >
                        <div>
                          <div style={{ color: '#64748b', fontSize: 9.5 }}>PELANGGAN:</div>
                          <div style={{ fontWeight: 800, color: '#0f172a' }}>{bill.customer_name}</div>
                          <div>No: {bill.customer_no} ({bill.rt_rw})</div>
                        </div>
                        <div>
                          <div style={{ color: '#64748b', fontSize: 9.5 }}>STAND METER:</div>
                          <div>Awal: <strong>{bill.prev_reading} m³</strong> → Akhir: <strong>{bill.current_reading} m³</strong></div>
                          <div>Pemakaian: <strong style={{ color: '#0284c7' }}>{formatM3(bill.usage_m3)}</strong></div>
                        </div>
                        <div>
                          <div style={{ color: '#64748b', fontSize: 9.5 }}>PERIODE & JATUH TEMPO:</div>
                          <div>Periode: <strong>{formatPeriod(bill.period_month, bill.period_year)}</strong></div>
                          <div>Jatuh Tempo: <strong>{formatDate(bill.due_date)}</strong></div>
                        </div>
                      </div>

                      {/* Rincian Ringkas Tagihan */}
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10.5, marginBottom: 8 }}>
                        <tbody>
                          <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                            <td style={{ padding: '3px 4px' }}>Beban Tetap & Pemakaian Air ({formatM3(bill.usage_m3)})</td>
                            <td style={{ padding: '3px 4px', textAlign: 'right', fontWeight: 600 }}>
                              {formatRupiah((bill.total_amount || 0) + (bill.subsidy_amount || 0) - (bill.admin_fee || 0) - (bill.late_fee || 0))}
                            </td>
                          </tr>
                          {Number(bill.late_fee || 0) > 0 && (
                            <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#b91c1c' }}>
                              <td style={{ padding: '3px 4px' }}>Denda Keterlambatan</td>
                              <td style={{ padding: '3px 4px', textAlign: 'right', fontWeight: 600 }}>{formatRupiah(bill.late_fee)}</td>
                            </tr>
                          )}
                          {Number(bill.admin_fee || 0) > 0 && (
                            <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                              <td style={{ padding: '3px 4px' }}>Biaya Administrasi Loket</td>
                              <td style={{ padding: '3px 4px', textAlign: 'right', fontWeight: 600 }}>{formatRupiah(bill.admin_fee)}</td>
                            </tr>
                          )}
                          {Number(bill.subsidy_amount || 0) > 0 && (
                            <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#047857', backgroundColor: 'rgba(16, 185, 129, 0.08)' }}>
                              <td style={{ padding: '3px 4px', fontWeight: 700 }}>Subsidi Air BUMDes ({bill.subsidy_notes || 'Program Subsidi Desa'})</td>
                              <td style={{ padding: '3px 4px', textAlign: 'right', fontWeight: 700 }}>-{formatRupiah(bill.subsidy_amount)}</td>
                            </tr>
                          )}
                          <tr style={{ borderTop: '2px solid #334155', backgroundColor: '#f1f5f9' }}>
                            <td style={{ padding: '5px 4px', fontWeight: 800 }}>TOTAL TAGIHAN BERSIH:</td>
                            <td style={{ padding: '5px 4px', textAlign: 'right', fontWeight: 900, fontSize: 12, color: bill.total_amount === 0 ? '#047857' : '#0f172a' }}>
                              {bill.total_amount === 0 ? 'Rp 0 (100% Gratis)' : formatRupiah(bill.total_amount)}
                            </td>
                          </tr>
                        </tbody>
                      </table>

                      {/* Footer Faktur */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 9.5, color: '#475569', borderTop: '1px dotted #94a3b8', paddingTop: 4 }}>
                        <div>Bayar via {settings.bank_account_info || 'Loket Desa'}</div>
                        <div>Status: <strong>{bill.status}</strong></div>
                        <div>Petugas: ___________________</div>
                      </div>
                    </div>

                    {/* Perforated separator or page break */}
                    {isEven ? (
                      <div className="print-page-break" style={{ marginBottom: 12 }} />
                    ) : (
                      index < bills.length - 1 && <div className="print-perforated-cut" />
                    )}
                  </React.Fragment>
                );
              })
            )}
          </div>
        )}

        {/* ==================== LAYOUT 2: MASTER BILLING LEDGER TABLE (BUKU REKAP) ==================== */}
        {printLayout === 'ledger' && (
          <div>
            {/* Kop Laporan Resmi */}
            <div className="official-print-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Droplets size={32} color="var(--primary-600)" />
                <div>
                  <h1 style={{ fontSize: 16, fontWeight: 900, color: '#0f172a' }}>
                    {settings.organization_name || 'BUMDes Tirta Sandmosquito'}
                  </h1>
                  <p style={{ fontSize: 11, color: '#475569' }}>
                    {settings.village_name} - {settings.village_address} | Telp: {settings.contact_phone}
                  </p>
                  <p style={{ fontSize: 12, fontWeight: 700, color: '#0284c7', marginTop: 4 }}>
                    BUKU REKAPITULASI TAGIHAN & PENAGIHAN AIR DESA (LEDGER KOLEKTOR)
                  </p>
                </div>
              </div>
              <div style={{ textAlign: 'right', fontSize: 11 }}>
                <div><strong>Periode:</strong> {formatPeriod(Number(selectedMonth), Number(selectedYear))}</div>
                <div><strong>Wilayah:</strong> {selectedRt || 'Semua RT/RW'}</div>
                <div><strong>Total Lembar:</strong> {bills.length} Warga</div>
              </div>
            </div>

            {/* Summary Box */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 8,
                backgroundColor: '#f8fafc',
                border: '1px solid #94a3b8',
                borderRadius: 4,
                padding: '8px 12px',
                marginBottom: 12,
                fontSize: 11
              }}
            >
              <div>Total Pelanggan: <strong>{bills.length}</strong></div>
              <div>Total Pemakaian: <strong>{formatM3(totalUsage)}</strong></div>
              <div>Total Nilai Tagihan: <strong style={{ color: '#0284c7' }}>{formatRupiah(totalAmount)}</strong></div>
              <div>Total Subsidi Desa: <strong style={{ color: '#047857' }}>{formatRupiah(totalSubsidy)}</strong></div>
            </div>

            {/* Master Table */}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 9.5 }}>
              <thead>
                <tr style={{ backgroundColor: '#f1f5f9' }}>
                  <th style={{ width: '30px', textAlign: 'center' }}>No</th>
                  <th>No. Tagihan</th>
                  <th>No. Pel / NIK</th>
                  <th>Nama Pelanggan</th>
                  <th>RT/RW</th>
                  <th style={{ textAlign: 'center' }}>Awal</th>
                  <th style={{ textAlign: 'center' }}>Akhir</th>
                  <th style={{ textAlign: 'center' }}>Pakai (m³)</th>
                  <th style={{ textAlign: 'right' }}>Subsidi</th>
                  <th style={{ textAlign: 'right' }}>Total Tagihan</th>
                  <th style={{ textAlign: 'center' }}>Status</th>
                  <th style={{ width: '80px', textAlign: 'center' }}>Paraf / Tgl</th>
                </tr>
              </thead>
              <tbody>
                {bills.map((b, idx) => (
                  <tr key={b.id}>
                    <td style={{ textAlign: 'center' }}>{idx + 1}</td>
                    <td><strong>{b.bill_no}</strong></td>
                    <td>{b.customer_no}</td>
                    <td><strong>{b.customer_name}</strong></td>
                    <td>{b.rt_rw}</td>
                    <td style={{ textAlign: 'center' }}>{b.prev_reading}</td>
                    <td style={{ textAlign: 'center' }}>{b.current_reading}</td>
                    <td style={{ textAlign: 'center', fontWeight: 700 }}>{formatM3(b.usage_m3)}</td>
                    <td style={{ textAlign: 'right', color: '#047857' }}>
                      {b.subsidy_amount ? `-${formatRupiah(b.subsidy_amount)}` : '-'}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 800 }}>{formatRupiah(b.total_amount)}</td>
                    <td style={{ textAlign: 'center' }}>
                      <Badge status={b.status} />
                    </td>
                    <td style={{ borderBottom: '1px dotted #94a3b8' }}></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ backgroundColor: '#f8fafc', fontWeight: 800, borderTop: '2px solid #0f172a' }}>
                  <td colSpan={7} style={{ textAlign: 'right', padding: '6px 8px' }}>TOTAL REKAPITULASI:</td>
                  <td style={{ textAlign: 'center', color: '#0284c7' }}>{formatM3(totalUsage)}</td>
                  <td style={{ textAlign: 'right', color: '#047857' }}>-{formatRupiah(totalSubsidy)}</td>
                  <td style={{ textAlign: 'right', fontSize: 11 }}>{formatRupiah(totalAmount)}</td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>

            {/* Official Signatures Block */}
            <div className="official-print-signatures">
              <div className="sig-col">
                <div>Mengetahui,</div>
                <div className="sig-title">Kepala Desa {settings.village_name || ''}</div>
                <div className="sig-space" />
                <div className="sig-name">( ________________________ )</div>
              </div>
              <div className="sig-col">
                <div>Penanggung Jawab,</div>
                <div className="sig-title">Direktur {settings.organization_name || 'BUMDes'}</div>
                <div className="sig-space" />
                <div className="sig-name">( ________________________ )</div>
              </div>
              <div className="sig-col">
                <div>Petugas Kolektor / Loket,</div>
                <div className="sig-title">Kasir BUMDes</div>
                <div className="sig-space" />
                <div className="sig-name">( ________________________ )</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
