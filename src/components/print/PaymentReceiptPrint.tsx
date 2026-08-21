import React from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Printer, CheckCircle, Droplets } from 'lucide-react';
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

  if (!payment) return null;

  const handlePrint = () => {
    window.print();
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
        <>
          <Button variant="secondary" onClick={onClose}>
            Tutup
          </Button>
          <Button variant="success" icon={<Printer size={16} />} onClick={handlePrint}>
            Cetak Kuitansi (Print)
          </Button>
        </>
      }
    >
      <div className="printable-area" style={{ padding: '8px' }}>
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
