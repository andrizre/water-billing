import React from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { Printer, Droplets, Share2 } from 'lucide-react';
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

  const adminFeeVal = Number(bill.admin_fee !== undefined ? bill.admin_fee : (settings.admin_fee_flat || 2500));
  const breakdown = calculateTieredBillBreakdown(bill.usage_m3, tariff, false, adminFeeVal);

  const handlePrint = () => {
    window.print();
  };

  const handleSendWhatsApp = () => {
    const custPhone = (customer?.phone || bill.phone || '').replace(/\D/g, '');
    let formattedPhone = custPhone;
    if (formattedPhone.startsWith('0')) {
      formattedPhone = '62' + formattedPhone.substring(1);
    }

    const message = `*TAGIHAN REKENING AIR MINUM DESA*\n` +
      `*${settings.organization_name || 'BUMDes Tirta Sandmosquito'}*\n` +
      `--------------------------------\n` +
      `• No. Tagihan  : ${bill.bill_no}\n` +
      `• No. Pelanggan: ${bill.customer_no || customer?.customer_no || '-'}\n` +
      `• Nama Warga   : ${bill.customer_name || customer?.full_name || '-'}\n` +
      `• Periode      : ${formatPeriod(bill.period_month, bill.period_year)}\n` +
      `• Stand Meter  : ${bill.prev_reading} m³ -> ${bill.current_reading} m³\n` +
      `• Total Pakai  : ${formatM3(bill.usage_m3)}\n` +
      `• *TOTAL TAGIHAN*: *${formatRupiah(bill.total_amount)}*\n` +
      (bill.balance_due ? `• *Sisa Tunggakan*: *${formatRupiah(bill.balance_due)}*\n` : '') +
      `• Jatuh Tempo  : ${formatDate(bill.due_date)}\n` +
      `--------------------------------\n` +
      `Pembayaran dapat via transfer:\n${settings.bank_account_info || 'Rekening BUMDes'}\natau loket kasir kantor desa.\n` +
      `_${settings.village_name || 'Kantor BUMDes'}_`;

    const waUrl = formattedPhone
      ? `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;

    window.open(waUrl, '_blank');
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
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
          <Button
            variant="success"
            size="sm"
            icon={<Share2 size={15} />}
            onClick={handleSendWhatsApp}
            title="Kirim rincian tagihan via WhatsApp ke pelanggan"
          >
            Kirim ke WhatsApp
          </Button>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="secondary" onClick={onClose}>
              Tutup
            </Button>
            <Button variant="primary" icon={<Printer size={16} />} onClick={handlePrint}>
              Cetak Faktur (Print)
            </Button>
          </div>
        </div>
      }
    >
      <div className="printable-area" style={{ padding: '4px' }}>
        {/* Invoice Header / Kop Surat Desa */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '2px solid var(--slate-800)',
            paddingBottom: 16,
            marginBottom: 20,
            flexWrap: 'wrap',
            gap: 14
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 200 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 8,
                backgroundColor: 'var(--primary-600)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <Droplets size={24} />
            </div>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--slate-900)' }}>
                {settings.organization_name || 'BUMDes Tirta Sandmosquito'}
              </h2>
              <p style={{ fontSize: 12, color: 'var(--slate-600)' }}>
                {settings.village_name} - {settings.village_address}
              </p>
              <p style={{ fontSize: 11, color: 'var(--slate-500)' }}>
                Kontak: {settings.contact_phone} | {settings.contact_email}
              </p>
            </div>
          </div>
          <div style={{ textAlign: 'right', minWidth: 160 }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: 'uppercase',
                color: 'var(--primary-700)',
                letterSpacing: 0.5
              }}
            >
              Surat Tagihan Rekening Air
            </span>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--slate-900)', marginTop: 2 }}>
              {bill.bill_no}
            </div>
            <div style={{ marginTop: 4 }}>
              <Badge status={bill.status} />
            </div>
          </div>
        </div>

        {/* Customer & Bill Details Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))',
            gap: 14,
            backgroundColor: 'var(--slate-50)',
            padding: 14,
            borderRadius: 8,
            border: '1px solid var(--slate-200)',
            marginBottom: 16,
            fontSize: 12.5
          }}
        >
          <div>
            <div style={{ color: 'var(--slate-500)', fontSize: 11, fontWeight: 600 }}>NAMA PELANGGAN</div>
            <div style={{ fontWeight: 700, color: 'var(--slate-900)', fontSize: 13.5 }}>
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
            <div style={{ fontWeight: 700, color: 'var(--primary-700)', fontSize: 13.5 }}>
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

        {/* Tiered Calculation Table with Responsive Overflow */}
        <div className="table-responsive" style={{ marginBottom: 16 }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: 12.5
            }}
          >
            <thead>
              <tr style={{ backgroundColor: 'var(--slate-100)', borderBottom: '2px solid var(--slate-300)' }}>
                <th style={{ padding: '8px 10px', textAlign: 'left' }}>Rincian Biaya</th>
                <th style={{ padding: '8px 10px', textAlign: 'center' }}>Kubikasi</th>
                <th style={{ padding: '8px 10px', textAlign: 'right' }}>Tarif Satuan</th>
                <th style={{ padding: '8px 10px', textAlign: 'right' }}>Jumlah</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid var(--slate-200)' }}>
                <td style={{ padding: '8px 10px' }}>Biaya Beban / Abodemen Tetap</td>
                <td style={{ padding: '8px 10px', textAlign: 'center' }}>-</td>
                <td style={{ padding: '8px 10px', textAlign: 'right' }}>-</td>
                <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600 }}>
                  {formatRupiah(breakdown.base_fee)}
                </td>
              </tr>
              {breakdown.tier1_usage > 0 && (
                <tr style={{ borderBottom: '1px solid var(--slate-200)' }}>
                  <td style={{ padding: '8px 10px' }}>Pemakaian Tier 1 (0 - {tariff?.tier1_max || 10} m³)</td>
                  <td style={{ padding: '8px 10px', textAlign: 'center' }}>{breakdown.tier1_usage} m³</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right' }}>{formatRupiah(breakdown.tier1_rate)}/m³</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600 }}>
                    {formatRupiah(breakdown.tier1_amount)}
                  </td>
                </tr>
              )}
              {breakdown.tier2_usage > 0 && (
                <tr style={{ borderBottom: '1px solid var(--slate-200)' }}>
                  <td style={{ padding: '8px 10px' }}>
                    Pemakaian Tier 2 ({(tariff?.tier1_max || 10) + 1} - {tariff?.tier2_max || 20} m³)
                  </td>
                  <td style={{ padding: '8px 10px', textAlign: 'center' }}>{breakdown.tier2_usage} m³</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right' }}>{formatRupiah(breakdown.tier2_rate)}/m³</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600 }}>
                    {formatRupiah(breakdown.tier2_amount)}
                  </td>
                </tr>
              )}
              {breakdown.tier3_usage > 0 && (
                <tr style={{ borderBottom: '1px solid var(--slate-200)' }}>
                  <td style={{ padding: '8px 10px' }}>Pemakaian Tier 3 (&gt; {tariff?.tier2_max || 20} m³)</td>
                  <td style={{ padding: '8px 10px', textAlign: 'center' }}>{breakdown.tier3_usage} m³</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right' }}>{formatRupiah(breakdown.tier3_rate)}/m³</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600 }}>
                    {formatRupiah(breakdown.tier3_amount)}
                  </td>
                </tr>
              )}
              {Number(bill.late_fee || 0) > 0 && (
                <tr style={{ borderBottom: '1px solid var(--slate-200)', color: 'var(--danger-600)' }}>
                  <td style={{ padding: '8px 10px' }}>Denda Keterlambatan</td>
                  <td style={{ padding: '8px 10px', textAlign: 'center' }}>-</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right' }}>-</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600 }}>
                    {formatRupiah(bill.late_fee)}
                  </td>
                </tr>
              )}
              {adminFeeVal > 0 && (
                <tr style={{ borderBottom: '1px solid var(--slate-200)' }}>
                  <td style={{ padding: '8px 10px' }}>Biaya Administrasi Tagihan</td>
                  <td style={{ padding: '8px 10px', textAlign: 'center' }}>-</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right' }}>-</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600 }}>
                    {formatRupiah(adminFeeVal)}
                  </td>
                </tr>
              )}
              {((bill.is_subsidized && (bill.subsidy_amount || 0) > 0) || (breakdown.subsidy_amount && breakdown.subsidy_amount > 0)) && (
                <tr style={{ borderBottom: '1px solid var(--slate-200)', color: 'var(--success-700)', backgroundColor: 'rgba(16, 185, 129, 0.08)' }}>
                  <td style={{ padding: '8px 10px', fontWeight: 700 }}>
                    Subsidi Air Desa BUMDes ({bill.subsidy_notes || customer?.subsidy_notes || (bill.subsidy_type === 'gratis' ? '100% Gratis' : 'Plafon Maksimal Bayar')})
                  </td>
                  <td style={{ padding: '8px 10px', textAlign: 'center' }}>-</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right' }}>Subsidi</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700 }}>
                    -{formatRupiah(bill.subsidy_amount || breakdown.subsidy_amount || 0)}
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '2px solid var(--slate-400)', backgroundColor: 'var(--slate-50)' }}>
                <td colSpan={3} style={{ padding: '10px', fontWeight: 700, textAlign: 'right' }}>
                  TOTAL TAGIHAN:
                </td>
                <td style={{ padding: '10px', fontWeight: 800, textAlign: 'right', fontSize: 15, color: bill.total_amount === 0 ? 'var(--success-700)' : 'var(--slate-900)' }}>
                  {bill.total_amount === 0 ? 'Rp 0 (Gratis)' : formatRupiah(bill.total_amount)}
                </td>
              </tr>
              {bill.paid_amount > 0 && (
                <tr>
                  <td colSpan={3} style={{ padding: '6px 10px', textAlign: 'right', color: 'var(--success-700)' }}>
                    Sudah Dibayar:
                  </td>
                  <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700, color: 'var(--success-700)' }}>
                    {formatRupiah(bill.paid_amount)}
                  </td>
                </tr>
              )}
              {bill.balance_due > 0 && (
                <tr style={{ backgroundColor: 'var(--danger-50)' }}>
                  <td colSpan={3} style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: 'var(--danger-700)' }}>
                    SISA TUNGGAKAN:
                  </td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, fontSize: 14, color: 'var(--danger-700)' }}>
                    {formatRupiah(bill.balance_due)}
                  </td>
                </tr>
              )}
            </tfoot>
          </table>
        </div>

        {/* Footer & Payment Channel Info */}
        <div
          style={{
            borderTop: '1px dashed var(--slate-300)',
            paddingTop: 14,
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 11.5,
            color: 'var(--slate-600)',
            flexWrap: 'wrap',
            gap: 16
          }}
        >
          <div style={{ flex: '1 1 200px', minWidth: 180 }}>
            <div style={{ fontWeight: 600, color: 'var(--slate-800)', marginBottom: 2 }}>
              Informasi Pembayaran:
            </div>
            <div>{settings.bank_account_info}</div>
            <div>{settings.qris_info}</div>
            <div style={{ marginTop: 6, fontStyle: 'italic', color: 'var(--slate-500)' }}>
              *{settings.bill_footer_notes}
            </div>
          </div>
          <div style={{ textAlign: 'center', flex: '0 0 auto', minWidth: 140 }}>
            <div>Pengelola Air Desa,</div>
            <div style={{ height: 36 }} />
            <div style={{ fontWeight: 700, textDecoration: 'underline' }}>{settings.organization_name}</div>
          </div>
        </div>
      </div>
    </Modal>
  );
};
