import React from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { Printer, Droplets } from 'lucide-react';
import { Bill, Customer, WaterMeter, Tariff } from '../../types';
import { formatRupiah, formatM3, formatDate, formatPeriod } from '../../utils/formatters';
import { calculateTieredBillBreakdown } from '../../utils/calculator';
import { useSettings } from '../../context/SettingsContext';

export interface BillInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  bill: Bill | null;
  customer?: Customer | null;
  meter?: WaterMeter | null;
  tariff?: Tariff | null;
}

export const BillInvoiceModal: React.FC<BillInvoiceModalProps> = ({
  isOpen,
  onClose,
  bill,
  customer,
  meter,
  tariff
}) => {
  const { settings } = useSettings();

  if (!bill) return null;

  const breakdown = calculateTieredBillBreakdown(bill.usage_m3, tariff);

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
          <Droplets size={20} color="var(--primary-600)" />
          <span>Faktur Tagihan Air ({bill.bill_no})</span>
        </div>
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Tutup
          </Button>
          <Button variant="primary" icon={<Printer size={16} />} onClick={handlePrint}>
            Cetak Faktur (Print)
          </Button>
        </>
      }
    >
      <div className="printable-area" style={{ padding: '8px' }}>
        {/* Invoice Header / Kop Surat Desa */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '2px solid var(--slate-800)',
            paddingBottom: 16,
            marginBottom: 20
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 8,
                backgroundColor: 'var(--primary-600)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Droplets size={28} />
            </div>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--slate-900)' }}>
                {settings.organization_name || 'BUMDes Tirta Sandmosquito'}
              </h2>
              <p style={{ fontSize: 13, color: 'var(--slate-600)' }}>
                {settings.village_name} - {settings.village_address}
              </p>
              <p style={{ fontSize: 12, color: 'var(--slate-500)' }}>
                Kontak: {settings.contact_phone} | {settings.contact_email}
              </p>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                textTransform: 'uppercase',
                color: 'var(--primary-700)',
                letterSpacing: 1
              }}
            >
              Surat Tagihan Rekening Air
            </span>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--slate-900)', marginTop: 2 }}>
              {bill.bill_no}
            </div>
            <div style={{ marginTop: 6 }}>
              <Badge status={bill.status} />
            </div>
          </div>
        </div>

        {/* Customer & Bill Details Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 16,
            backgroundColor: 'var(--slate-50)',
            padding: 16,
            borderRadius: 8,
            border: '1px solid var(--slate-200)',
            marginBottom: 20,
            fontSize: 13
          }}
        >
          <div>
            <div style={{ color: 'var(--slate-500)', fontSize: 11, fontWeight: 600 }}>NAMA PELANGGAN</div>
            <div style={{ fontWeight: 700, color: 'var(--slate-900)', fontSize: 14 }}>
              {bill.customer_name || customer?.full_name || '-'}
            </div>
            <div style={{ color: 'var(--slate-600)' }}>No. Pel: {bill.customer_no || customer?.customer_no}</div>
            <div style={{ color: 'var(--slate-600)' }}>{bill.rt_rw || customer?.rt_rw}</div>
          </div>

          <div>
            <div style={{ color: 'var(--slate-500)', fontSize: 11, fontWeight: 600 }}>DATA METER</div>
            <div style={{ fontWeight: 600, color: 'var(--slate-800)' }}>
              No. Meter: {meter?.meter_no || 'MTR-8801'}
            </div>
            <div style={{ color: 'var(--slate-600)' }}>Meter Awal: {bill.prev_reading} m³</div>
            <div style={{ color: 'var(--slate-600)' }}>Meter Akhir: {bill.current_reading} m³</div>
          </div>

          <div>
            <div style={{ color: 'var(--slate-500)', fontSize: 11, fontWeight: 600 }}>PERIODE & JATUH TEMPO</div>
            <div style={{ fontWeight: 700, color: 'var(--primary-700)', fontSize: 14 }}>
              {formatPeriod(bill.period_month, bill.period_year)}
            </div>
            <div style={{ color: 'var(--slate-600)' }}>
              Jatuh Tempo: <strong>{formatDate(bill.due_date)}</strong>
            </div>
            <div style={{ color: 'var(--slate-600)' }}>
              Total Pakai: <strong>{formatM3(bill.usage_m3)}</strong>
            </div>
          </div>
        </div>

        {/* Tiered Calculation Table */}
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: 13,
            marginBottom: 20
          }}
        >
          <thead>
            <tr style={{ backgroundColor: 'var(--slate-100)', borderBottom: '2px solid var(--slate-300)' }}>
              <th style={{ padding: '8px 12px', textAlign: 'left' }}>Rincian Biaya</th>
              <th style={{ padding: '8px 12px', textAlign: 'center' }}>Kubikasi</th>
              <th style={{ padding: '8px 12px', textAlign: 'right' }}>Tarif Satuan</th>
              <th style={{ padding: '8px 12px', textAlign: 'right' }}>Jumlah</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: '1px solid var(--slate-200)' }}>
              <td style={{ padding: '8px 12px' }}>Biaya Beban / Abodemen Tetap</td>
              <td style={{ padding: '8px 12px', textAlign: 'center' }}>-</td>
              <td style={{ padding: '8px 12px', textAlign: 'right' }}>-</td>
              <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }}>
                {formatRupiah(breakdown.base_fee)}
              </td>
            </tr>
            {breakdown.tier1_usage > 0 && (
              <tr style={{ borderBottom: '1px solid var(--slate-200)' }}>
                <td style={{ padding: '8px 12px' }}>Pemakaian Tier 1 (0 - {tariff?.tier1_max || 10} m³)</td>
                <td style={{ padding: '8px 12px', textAlign: 'center' }}>{breakdown.tier1_usage} m³</td>
                <td style={{ padding: '8px 12px', textAlign: 'right' }}>{formatRupiah(breakdown.tier1_rate)}/m³</td>
                <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }}>
                  {formatRupiah(breakdown.tier1_amount)}
                </td>
              </tr>
            )}
            {breakdown.tier2_usage > 0 && (
              <tr style={{ borderBottom: '1px solid var(--slate-200)' }}>
                <td style={{ padding: '8px 12px' }}>
                  Pemakaian Tier 2 ({(tariff?.tier1_max || 10) + 1} - {tariff?.tier2_max || 20} m³)
                </td>
                <td style={{ padding: '8px 12px', textAlign: 'center' }}>{breakdown.tier2_usage} m³</td>
                <td style={{ padding: '8px 12px', textAlign: 'right' }}>{formatRupiah(breakdown.tier2_rate)}/m³</td>
                <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }}>
                  {formatRupiah(breakdown.tier2_amount)}
                </td>
              </tr>
            )}
            {breakdown.tier3_usage > 0 && (
              <tr style={{ borderBottom: '1px solid var(--slate-200)' }}>
                <td style={{ padding: '8px 12px' }}>Pemakaian Tier 3 (&gt; {tariff?.tier2_max || 20} m³)</td>
                <td style={{ padding: '8px 12px', textAlign: 'center' }}>{breakdown.tier3_usage} m³</td>
                <td style={{ padding: '8px 12px', textAlign: 'right' }}>{formatRupiah(breakdown.tier3_rate)}/m³</td>
                <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }}>
                  {formatRupiah(breakdown.tier3_amount)}
                </td>
              </tr>
            )}
            {Number(bill.late_fee || 0) > 0 && (
              <tr style={{ borderBottom: '1px solid var(--slate-200)', color: 'var(--danger-600)' }}>
                <td style={{ padding: '8px 12px' }}>Denda Keterlambatan</td>
                <td style={{ padding: '8px 12px', textAlign: 'center' }}>-</td>
                <td style={{ padding: '8px 12px', textAlign: 'right' }}>-</td>
                <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }}>
                  {formatRupiah(bill.late_fee)}
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: '2px solid var(--slate-400)', backgroundColor: 'var(--slate-50)' }}>
              <td colSpan={3} style={{ padding: '10px 12px', fontWeight: 700, textAlign: 'right' }}>
                TOTAL TAGIHAN:
              </td>
              <td style={{ padding: '10px 12px', fontWeight: 800, textAlign: 'right', fontSize: 16, color: 'var(--slate-900)' }}>
                {formatRupiah(bill.total_amount)}
              </td>
            </tr>
            {bill.paid_amount > 0 && (
              <tr>
                <td colSpan={3} style={{ padding: '6px 12px', textAlign: 'right', color: 'var(--success-700)' }}>
                  Sudah Dibayar:
                </td>
                <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--success-700)' }}>
                  {formatRupiah(bill.paid_amount)}
                </td>
              </tr>
            )}
            {bill.balance_due > 0 && (
              <tr style={{ backgroundColor: 'var(--danger-50)' }}>
                <td colSpan={3} style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--danger-700)' }}>
                  SISA TUNGGAKAN:
                </td>
                <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800, fontSize: 15, color: 'var(--danger-700)' }}>
                  {formatRupiah(bill.balance_due)}
                </td>
              </tr>
            )}
          </tfoot>
        </table>

        {/* Footer & Payment Channel Info */}
        <div
          style={{
            borderTop: '1px dashed var(--slate-300)',
            paddingTop: 14,
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 12,
            color: 'var(--slate-600)'
          }}
        >
          <div style={{ maxWidth: '60%' }}>
            <div style={{ fontWeight: 600, color: 'var(--slate-800)', marginBottom: 2 }}>
              Informasi Pembayaran:
            </div>
            <div>{settings.bank_account_info}</div>
            <div>{settings.qris_info}</div>
            <div style={{ marginTop: 6, fontStyle: 'italic', color: 'var(--slate-500)' }}>
              *{settings.bill_footer_notes}
            </div>
          </div>
          <div style={{ textAlign: 'center', minWidth: 160 }}>
            <div>Pengelola Air Desa,</div>
            <div style={{ height: 44 }} />
            <div style={{ fontWeight: 700, textDecoration: 'underline' }}>{settings.organization_name}</div>
          </div>
        </div>
      </div>
    </Modal>
  );
};
