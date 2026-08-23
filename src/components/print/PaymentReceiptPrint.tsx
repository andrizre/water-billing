import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Printer, CheckCircle, Droplets, Share2, Receipt } from 'lucide-react';
import { Payment, Bill, Customer } from '../../types';
import { formatRupiah, formatDateTime, formatPeriod } from '../../utils/formatters';
import { useSettings } from '../../context/SettingsContext';

export interface PaymentReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  payment: Payment | null;
  bill?: Bill | null;
  customer?: Customer | null;
}

export const PaymentReceiptModal: React.FC<PaymentReceiptModalProps> = ({
  isOpen,
  onClose,
  payment,
  bill,
  customer
}) => {
  const { settings } = useSettings();
  const [printMode, setPrintMode] = useState<'standard' | 'thermal'>('standard');

  if (!payment) return null;

  const handlePrint = (mode: 'standard' | 'thermal') => {
    setPrintMode(mode);
    setTimeout(() => {
      window.print();
    }, 100);
  };

  const handleSendWhatsApp = () => {
    const custPhone = (customer?.phone || (payment as any).phone || bill?.phone || '').replace(/\D/g, '');
    let formattedPhone = custPhone;
    if (formattedPhone.startsWith('0')) {
      formattedPhone = '62' + formattedPhone.substring(1);
    }

    const message = `*BUKTI PEMBAYARAN AIR MINUM DESA*\n` +
      `*${settings.organization_name || 'BUMDes Tirta Sandmosquito'}*\n` +
      `--------------------------------\n` +
      `• No. Kuitansi : ${payment.payment_no}\n` +
      `• No. Pelanggan: ${payment.customer_no || customer?.customer_no || '-'}\n` +
      `• Nama Warga   : ${payment.customer_name || customer?.full_name || '-'}\n` +
      `• Periode Tagihan: ${payment.period_month && payment.period_year ? formatPeriod(payment.period_month, payment.period_year) : '-'}\n` +
      `• Metode Bayar : ${payment.payment_method}\n` +
      `• Total Dibayar: *${formatRupiah(payment.amount_paid)}*\n` +
      `• Status       : *LUNAS*\n` +
      `• Tanggal/Waktu: ${formatDateTime(payment.payment_date || payment.created_at)}\n` +
      `--------------------------------\n` +
      `Terima kasih atas pembayaran rekening air tepat waktu.\n` +
      `_${settings.village_name || 'Kantor Desa'}_`;

    const waUrl = formattedPhone
      ? `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;

    window.open(waUrl, '_blank');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <CheckCircle size={20} color="var(--success-600)" />
          <span>Kuitansi Pembayaran ({payment.payment_no})</span>
        </div>
      }
      footer={
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
          <Button
            variant="success"
            size="sm"
            icon={<Share2 size={15} />}
            onClick={handleSendWhatsApp}
            title="Kirim bukti pembayaran ke WhatsApp warga"
          >
            Kirim ke WhatsApp
          </Button>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button
              variant="secondary"
              size="sm"
              icon={<Receipt size={15} />}
              onClick={() => handlePrint('thermal')}
              title="Cetak struk ukuran 58mm printer kasir thermal"
            >
              Struk Thermal (58mm)
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<Printer size={15} />}
              onClick={() => handlePrint('standard')}
            >
              Cetak Standar (A4)
            </Button>
          </div>
        </div>
      }
    >
      <div className={`printable-area ${printMode === 'thermal' ? 'thermal-receipt-mode' : ''}`} style={{ padding: '8px' }}>
        {/* Receipt Header */}
        <div
          style={{
            textAlign: 'center',
            borderBottom: '2px solid var(--slate-800)',
            paddingBottom: 12,
            marginBottom: 16
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 4 }}>
            <Droplets size={22} color="var(--primary-600)" />
            <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--slate-900)' }}>
              {settings.organization_name || 'BUMDes Tirta Sandmosquito'}
            </h2>
          </div>
          <p style={{ fontSize: 12, color: 'var(--slate-600)' }}>
            {settings.village_name} - Telp: {settings.contact_phone}
          </p>
          <div
            style={{
              fontSize: 13,
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: 1,
              marginTop: 6,
              color: 'var(--success-700)'
            }}
          >
            *** BUKTI PEMBAYARAN AIR MINUM DESA ***
          </div>
        </div>

        {/* Transaction Meta */}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 14 }}>
          <div>
            <div>No. Transaksi: <strong>{payment.payment_no}</strong></div>
            <div>No. Tagihan: <strong>{payment.bill_no || bill?.bill_no || '-'}</strong></div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div>Tanggal: {formatDateTime(payment.payment_date || payment.created_at)}</div>
            <div>Metode: <strong>{payment.payment_method}</strong></div>
          </div>
        </div>

        {/* Details Table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 16 }}>
          <tbody>
            <tr style={{ borderBottom: '1px dashed var(--slate-200)' }}>
              <td style={{ padding: '6px 0', color: 'var(--slate-500)' }}>No. Pelanggan</td>
              <td style={{ padding: '6px 0', textAlign: 'right', fontWeight: 600 }}>
                {payment.customer_no || customer?.customer_no || '-'}
              </td>
            </tr>
            <tr style={{ borderBottom: '1px dashed var(--slate-200)' }}>
              <td style={{ padding: '6px 0', color: 'var(--slate-500)' }}>Nama Pelanggan</td>
              <td style={{ padding: '6px 0', textAlign: 'right', fontWeight: 700 }}>
                {payment.customer_name || customer?.full_name || '-'}
              </td>
            </tr>
            <tr style={{ borderBottom: '1px dashed var(--slate-200)' }}>
              <td style={{ padding: '6px 0', color: 'var(--slate-500)' }}>Wilayah (RT/RW)</td>
              <td style={{ padding: '6px 0', textAlign: 'right' }}>
                {payment.rt_rw || customer?.rt_rw || '-'}
              </td>
            </tr>
            {payment.period_month && payment.period_year && (
              <tr style={{ borderBottom: '1px dashed var(--slate-200)' }}>
                <td style={{ padding: '6px 0', color: 'var(--slate-500)' }}>Periode Tagihan</td>
                <td style={{ padding: '6px 0', textAlign: 'right', fontWeight: 600 }}>
                  {formatPeriod(payment.period_month, payment.period_year)}
                </td>
              </tr>
            )}
            <tr style={{ borderBottom: '2px solid var(--slate-400)', backgroundColor: 'var(--success-50)' }}>
              <td style={{ padding: '10px 4px', fontWeight: 800, fontSize: 14 }}>JUMLAH DIBAYAR</td>
              <td style={{ padding: '10px 4px', textAlign: 'right', fontWeight: 800, fontSize: 16, color: 'var(--success-700)' }}>
                {formatRupiah(payment.amount_paid)}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Status Stamp & Signatures */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: 10 }}>
          <div
            style={{
              border: '2px dashed var(--success-600)',
              color: 'var(--success-700)',
              padding: '6px 14px',
              borderRadius: 6,
              fontWeight: 800,
              fontSize: 14,
              letterSpacing: 2,
              textTransform: 'uppercase'
            }}
          >
            LUNAS
          </div>

          <div style={{ textAlign: 'center', fontSize: 12 }}>
            <div>Petugas Loket,</div>
            <div style={{ height: 36 }} />
            <div style={{ fontWeight: 700 }}>{payment.cashier_name || 'Petugas BUMDes'}</div>
          </div>
        </div>

        <div
          style={{
            textAlign: 'center',
            fontSize: 11,
            color: 'var(--slate-500)',
            marginTop: 18,
            borderTop: '1px dotted var(--slate-300)',
            paddingTop: 8
          }}
        >
          Simpan struk ini sebagai bukti pembayaran yang sah. Terima kasih.
        </div>
      </div>
    </Modal>
  );
};
