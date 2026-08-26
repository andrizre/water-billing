import React, { useState, useEffect, useCallback } from 'react';
import {
  CreditCard,
  Search,
  Printer,
  CheckCircle,
  Banknote,
  AlertCircle
} from 'lucide-react';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { PaymentReceiptModal } from '../../components/print/PaymentReceiptPrint';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useSettings } from '../../context/SettingsContext';
import { notifyDataUpdated } from '../../hooks/useNotificationCounts';
import { api } from '../../services/api';
import { Bill, Payment, PaymentMethod } from '../../types';
import { formatRupiah, formatM3, formatPeriod } from '../../utils/formatters';

export const PaymentEntryPage: React.FC = () => {
  const { user, role } = useAuth();
  const [unpaidBills, setUnpaidBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);

  // Cashier Input Form
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [cashTendered, setCashTendered] = useState<string>(''); // Uang yang diserahkan pembeli
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Tunai');
  const [notes, setNotes] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);

  // Receipt Modal & Confirmation Dialog
  const [confirmModalOpen, setConfirmModalOpen] = useState<boolean>(false);
  const [receiptModalOpen, setReceiptModalOpen] = useState<boolean>(false);
  const [recordedPayment, setRecordedPayment] = useState<Payment | null>(null);

  const { success, error: toastError } = useToast();
  const { settings } = useSettings();

  const fetchUnpaidBills = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getBills();
      let unpaid = data.filter((b: Bill) => b.status !== 'Lunas');
      if (role === 'operator' && user?.assigned_rt && user.assigned_rt !== 'Semua RT') {
        unpaid = unpaid.filter((b: Bill) => b.rt_rw && b.rt_rw.includes(user.assigned_rt!));
      }
      setUnpaidBills(unpaid);
      if (unpaid.length > 0 && !selectedBill) {
        handleSelectBill(unpaid[0]);
      }
    } catch (err: any) {
      toastError(err.message || 'Gagal memuat tagihan.');
    } finally {
      setLoading(false);
    }
  }, [toastError, selectedBill, role, user?.assigned_rt]);

  useEffect(() => {
    fetchUnpaidBills();
  }, [fetchUnpaidBills]);

  const handleSelectBill = (b: Bill) => {
    setSelectedBill(b);
    const amountDue = b.balance_due || b.total_amount;
    setPaymentAmount(String(amountDue));
    setCashTendered(String(amountDue));
  };

  const filteredBills = unpaidBills.filter((b) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      b.bill_no.toLowerCase().includes(q) ||
      (b.customer_name && b.customer_name.toLowerCase().includes(q)) ||
      (b.customer_no && b.customer_no.toLowerCase().includes(q))
    );
  });

  const dueAmount = selectedBill ? (selectedBill.balance_due || selectedBill.total_amount) : 0;
  const payAmountNum = Number(paymentAmount || 0);
  const tenderedNum = Number(cashTendered || 0);
  const changeAmount = Math.max(0, tenderedNum - payAmountNum);

  const handleOpenConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBill) {
      toastError('Pilih tagihan terlebih dahulu.');
      return;
    }
    if (payAmountNum <= 0) {
      toastError('Jumlah pembayaran harus lebih dari Rp 0.');
      return;
    }
    if (dueAmount > 0 && payAmountNum > dueAmount) {
      toastError(`Jumlah pembayaran melebihi sisa tagihan (${formatRupiah(dueAmount)}).`);
      return;
    }
    if (paymentMethod === 'Tunai' && tenderedNum < payAmountNum) {
      toastError('Uang tunai yang diterima kurang dari jumlah pembayaran.');
      return;
    }
    setConfirmModalOpen(true);
  };

  const handleExecutePayment = async () => {
    if (!selectedBill) return;

    setSaving(true);
    try {
      const res = await api.recordPayment({
        bill_id: selectedBill.id,
        amount_paid: payAmountNum,
        payment_method: paymentMethod,
        notes
      });

      success(`Pembayaran ${selectedBill.customer_name} berhasil dicatat! Status: ${res.status}`);
      setConfirmModalOpen(false);

      if (res.payment) {
        setRecordedPayment(res.payment);
        setReceiptModalOpen(true);
      }

      setSelectedBill(null);
      fetchUnpaidBills();
      notifyDataUpdated();
    } catch (err: any) {
      toastError(err.message || 'Gagal memproses pembayaran.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Loket Kasir Pembayaran Rekening Air (POS)"
        subtitle="Pencatatan pembayaran tagihan warga secara langsung, kalkulator kembalian uang tunai, dan cetak kuitansi."
        action={
          user?.assigned_rt && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, backgroundColor: 'var(--primary-50)', border: '1px solid var(--primary-200)', padding: '6px 12px', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 700, color: 'var(--primary-700)' }}>
              <span>Wilayah Tugas:</span>
              <span style={{ backgroundColor: 'var(--primary-600)', color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 12 }}>
                {user.assigned_rt}
              </span>
            </div>
          )
        }
      />

      <div className="responsive-grid-2">
        {/* Left Side: Select Unpaid Bill List */}
        <Card title="Pilih Tagihan Pelanggan">
          <Input
            placeholder="Cari nama, no. pelanggan, atau no. faktur..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<Search size={16} />}
          />

          <div
            style={{
              maxHeight: 450,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              marginTop: 12
            }}
          >
            {filteredBills.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 24, color: 'var(--slate-500)' }}>
                Tidak ada tagihan tertunggak yang sesuai pencarian.
              </div>
            ) : (
              filteredBills.map((b) => {
                const isSelected = selectedBill?.id === b.id;
                return (
                  <div
                    key={b.id}
                    onClick={() => handleSelectBill(b)}
                    style={{
                      padding: 12,
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: isSelected ? 'var(--primary-50)' : 'var(--slate-50)',
                      border: isSelected ? '2px solid var(--primary-600)' : '1px solid var(--slate-200)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 800, color: isSelected ? 'var(--primary-900)' : 'var(--slate-900)' }}>
                        {b.customer_name}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--slate-500)' }}>
                        {b.customer_no} ({b.rt_rw}) • {formatPeriod(b.period_month, b.period_year)}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--slate-500)', marginTop: 2 }}>
                        Faktur: {b.bill_no}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 800, color: 'var(--danger-700)', fontSize: 14 }}>
                        {formatRupiah(b.balance_due || b.total_amount)}
                      </div>
                      <Badge status={b.status} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>

        {/* Right Side: Cashier Terminal Form */}
        <Card
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Banknote size={18} color="var(--success-600)" />
              <span>Terminal Pembayaran Kasir</span>
            </div>
          }
        >
          {selectedBill ? (
            <form onSubmit={handleOpenConfirm}>
              {/* Selected Customer Banner */}
              <div
                style={{
                  backgroundColor: 'var(--slate-50)',
                  padding: 14,
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--slate-200)',
                  marginBottom: 16
                }}
              >
                <div style={{ fontSize: 11, color: 'var(--slate-500)', fontWeight: 700 }}>
                  TAGIHAN TERPILIH
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--slate-900)' }}>
                  {selectedBill.customer_name} ({selectedBill.customer_no})
                </div>
                <div style={{ fontSize: 12, color: 'var(--slate-600)', marginTop: 2 }}>
                  Periode: <strong>{formatPeriod(selectedBill.period_month, selectedBill.period_year)}</strong> | Pakai: {formatM3(selectedBill.usage_m3)}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingTop: 8, borderTop: '1px dashed var(--slate-200)', flexWrap: 'wrap', gap: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>Total Tagihan Tertunggak:</span>
                  <span style={{ fontSize: 17, fontWeight: 800, color: 'var(--danger-700)' }}>
                    {formatRupiah(dueAmount)}
                  </span>
                </div>
              </div>

              <div className="form-grid-2">
                <Input
                  type="number"
                  label="Jumlah yang Dibayar (Rp)"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  required
                />
                <Select
                  label="Metode Pembayaran"
                  options={[
                    { label: 'Tunai (Kas Loket)', value: 'Tunai' },
                    { label: 'Transfer Bank', value: 'Transfer Bank' },
                    { label: 'QRIS Desa', value: 'QRIS' }
                  ]}
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as any)}
                  required
                />
              </div>

              {/* QRIS Display for Cashier Counter */}
              {paymentMethod === 'QRIS' && (
                <div
                  className="qris-card-wrapper"
                  style={{
                    backgroundColor: 'var(--primary-50)',
                    borderColor: 'var(--primary-200)',
                    margin: '12px 0'
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary-900)', display: 'block', marginBottom: 8 }}>
                    SCAN QRIS RESMI BUMDES:
                  </span>
                  <img
                    src={settings.qris_image_url || 'https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=BUMDes%20Tirta%20Sandmosquito%20Water%20Billing'}
                    alt="Barcode QRIS Kasir"
                    className="qris-image-responsive"
                  />
                  <span style={{ fontSize: 12, color: 'var(--slate-600)', marginTop: 6, display: 'block' }}>
                    {settings.qris_info || 'Tersedia di loket kantor desa atau scan barcode resmi'}
                  </span>
                </div>
              )}

              {paymentMethod === 'Tunai' && (
                <div
                  style={{
                    backgroundColor: 'var(--success-50)',
                    padding: 14,
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    margin: '12px 0'
                  }}
                >
                  <div className="form-grid-2">
                    <Input
                      type="number"
                      label="Uang Tunai Diterima (Rp)"
                      placeholder="Masukkan uang dari warga"
                      value={cashTendered}
                      onChange={(e) => setCashTendered(e.target.value)}
                      required
                    />

                    <div>
                      <label className="form-label" style={{ color: 'var(--success-800)' }}>
                        KEMBALIAN UANG:
                      </label>
                      <div
                        style={{
                          fontSize: 22,
                          fontWeight: 900,
                          color: 'var(--success-700)',
                          marginTop: 8
                        }}
                      >
                        {formatRupiah(changeAmount)}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <Input
                label="Catatan Pembayaran (Opsi)"
                placeholder="Contoh: Titipan tetangga / Lunas"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />

              <Button
                type="button"
                variant="success"
                icon={<CheckCircle size={18} />}
                onClick={handleOpenConfirm}
                style={{ width: '100%', padding: '14px', fontSize: 15, marginTop: 8 }}
              >
                Proses Pembayaran & Cetak Kuitansi
              </Button>
            </form>
          ) : (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--slate-500)' }}>
              Silakan pilih salah satu tagihan di sebelah kiri untuk memulai pembayaran.
            </div>
          )}
        </Card>
      </div>

      {/* Confirmation Dialog Before Submitting Payment */}
      {selectedBill && (
        <Modal
          isOpen={confirmModalOpen}
          onClose={() => setConfirmModalOpen(false)}
          title="Konfirmasi Transaksi Pembayaran Kasir"
        >
          <div style={{ padding: 14, backgroundColor: 'var(--slate-50)', borderRadius: 'var(--radius-md)', marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: 'var(--slate-500)' }}>Warga / Pelanggan:</div>
            <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--slate-900)' }}>
              {selectedBill.customer_name} ({selectedBill.customer_no})
            </div>
            <div style={{ fontSize: 12, color: 'var(--slate-600)', marginTop: 2 }}>
              No. Faktur: <strong>{selectedBill.bill_no}</strong> | Periode: {formatPeriod(selectedBill.period_month, selectedBill.period_year)}
            </div>

            <div style={{ marginTop: 14, borderTop: '1px dashed var(--slate-300)', paddingTop: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 13, color: 'var(--slate-600)' }}>Total Tagihan:</span>
                <span style={{ fontSize: 14, fontWeight: 700 }}>{formatRupiah(dueAmount)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 13, color: 'var(--slate-600)' }}>Metode Bayar:</span>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{paymentMethod}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 13, color: 'var(--slate-600)' }}>Jumlah Dibayar:</span>
                <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--primary-700)' }}>{formatRupiah(payAmountNum)}</span>
              </div>
              {paymentMethod === 'Tunai' && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 13, color: 'var(--slate-600)' }}>Uang Diterima:</span>
                    <span style={{ fontSize: 14, fontWeight: 700 }}>{formatRupiah(tenderedNum)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 6, borderTop: '1px solid var(--slate-200)' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--success-800)' }}>Kembalian Uang:</span>
                    <span style={{ fontSize: 17, fontWeight: 900, color: 'var(--success-700)' }}>{formatRupiah(changeAmount)}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          <p style={{ fontSize: 13, color: 'var(--slate-600)', marginBottom: 16, textAlign: 'center' }}>
            Pastikan uang pembayaran telah dihitung dengan benar sebelum mencatat transaksi.
          </p>

          <div className="modal-footer" style={{ padding: '14px 0 0 0' }}>
            <Button variant="secondary" type="button" onClick={() => setConfirmModalOpen(false)}>
              Batal / Periksa Lagi
            </Button>
            <Button
              variant="success"
              type="button"
              icon={<CheckCircle size={16} />}
              loading={saving}
              onClick={handleExecutePayment}
            >
              Ya, Terima & Cetak Struk
            </Button>
          </div>
        </Modal>
      )}

      <PaymentReceiptModal
        isOpen={receiptModalOpen}
        onClose={() => setReceiptModalOpen(false)}
        payment={recordedPayment}
        bill={selectedBill}
      />
    </div>
  );
};
