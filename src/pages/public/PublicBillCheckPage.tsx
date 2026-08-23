import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Droplets, ArrowLeft, CheckCircle2, AlertCircle, FileText } from 'lucide-react';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { useSettings } from '../../context/SettingsContext';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { BillInvoiceModal } from '../../components/print/BillInvoicePrint';
import { Bill } from '../../types';
import { formatRupiah, formatM3, formatDate, formatPeriod } from '../../utils/formatters';
import { usePageTitle } from '../../hooks/usePageTitle';

export const PublicBillCheckPage: React.FC = () => {
  usePageTitle('Cek Tagihan Air Mandiri', 'Portal cek tagihan air minum desa dan riwayat pemakaian air secara transparan dan mudah.');
  const [customerNo, setCustomerNo] = useState<string>('CUST-2026-0001');
  const [loading, setLoading] = useState<boolean>(false);
  const [searchResult, setSearchResult] = useState<any | null>(null);
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [invoiceModalOpen, setInvoiceModalOpen] = useState<boolean>(false);

  const { error: toastError } = useToast();
  const { settings } = useSettings();

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerNo.trim()) {
      toastError('Masukkan nomor pelanggan Anda.');
      return;
    }

    setLoading(true);
    setSearchResult(null);
    try {
      const data = await api.publicCheckBill(customerNo.trim());
      setSearchResult(data);
    } catch (err: any) {
      toastError(err.message || 'Nomor pelanggan tidak ditemukan.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenInvoice = (b: Bill) => {
    setSelectedBill(b);
    setInvoiceModalOpen(true);
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--slate-100)', padding: '24px 16px' }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        {/* Top Bar Navigation */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <Link
            to="/login"
            className="btn-secondary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 14,
              fontWeight: 600,
              padding: '8px 14px',
              borderRadius: 'var(--radius-md)',
              textDecoration: 'none'
            }}
          >
            <ArrowLeft size={16} />
            <span>Kembali ke Halaman Login</span>
          </Link>
          <div style={{ fontSize: 13, color: 'var(--slate-500)', fontWeight: 600 }}>
            {settings.village_name || 'Desa Sandmosquito'}
          </div>
        </div>

        {/* Search Box Header Card */}
        <Card className="no-print" style={{ marginBottom: 24 }}>
          <div style={{ textAlign: 'center', padding: '12px 8px 24px 8px' }}>
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'var(--primary-50)',
                color: 'var(--primary-600)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 12px auto'
              }}
            >
              <Droplets size={28} />
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--slate-900)' }}>
              Cek Tagihan Air Minum Desa
            </h1>
            <p style={{ fontSize: 13.5, color: 'var(--slate-500)', marginTop: 4 }}>
              Masukkan Nomor Pelanggan (ID Pelanggan) Anda untuk melihat tagihan dan riwayat pemakaian air.
            </p>

            <form
              onSubmit={handleSearch}
              style={{
                display: 'flex',
                gap: 10,
                maxWidth: 480,
                margin: '20px auto 0 auto'
              }}
            >
              <div style={{ flex: 1 }}>
                <Input
                  placeholder="Contoh: CUST-2026-0001"
                  value={customerNo}
                  onChange={(e) => setCustomerNo(e.target.value)}
                  leftIcon={<Search size={18} />}
                  required
                />
              </div>
              <Button type="submit" variant="primary" loading={loading} icon={<Search size={16} />}>
                Cari Tagihan
              </Button>
            </form>

            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 12, fontSize: 12 }}>
              <span style={{ color: 'var(--slate-500)' }}>Contoh ID:</span>
              <button
                type="button"
                onClick={() => setCustomerNo('CUST-2026-0001')}
                style={{ background: 'none', border: 'none', color: 'var(--primary-600)', fontWeight: 600, cursor: 'pointer' }}
              >
                CUST-2026-0001
              </button>
              <span style={{ color: 'var(--slate-300)' }}>•</span>
              <button
                type="button"
                onClick={() => setCustomerNo('CUST-2026-0002')}
                style={{ background: 'none', border: 'none', color: 'var(--primary-600)', fontWeight: 600, cursor: 'pointer' }}
              >
                CUST-2026-0002
              </button>
              <span style={{ color: 'var(--slate-300)' }}>•</span>
              <button
                type="button"
                onClick={() => setCustomerNo('CUST-2026-0004')}
                style={{ background: 'none', border: 'none', color: 'var(--primary-600)', fontWeight: 600, cursor: 'pointer' }}
              >
                CUST-2026-0004
              </button>
            </div>
          </div>
        </Card>

        {/* Search Results */}
        {searchResult && (
          <div>
            {/* Customer Info Card */}
            <Card style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 16 }}>
                <div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary-600)' }}>
                    {searchResult.customer.customer_no}
                  </span>
                  <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--slate-900)' }}>
                    {searchResult.customer.full_name}
                  </h2>
                  <p style={{ fontSize: 13, color: 'var(--slate-600)' }}>
                    {searchResult.customer.address} ({searchResult.customer.rt_rw})
                  </p>
                  <p style={{ fontSize: 12, color: 'var(--slate-500)', marginTop: 2 }}>
                    Kategori Tarif: <strong>{searchResult.customer.tariff_name}</strong>
                  </p>
                </div>

                <div
                  style={{
                    backgroundColor: searchResult.total_unpaid_amount > 0 ? 'var(--danger-50)' : 'var(--success-50)',
                    padding: '14px 20px',
                    borderRadius: 'var(--radius-md)',
                    border: `1px solid ${searchResult.total_unpaid_amount > 0 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)'}`,
                    textAlign: 'right'
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 700, color: searchResult.total_unpaid_amount > 0 ? 'var(--danger-700)' : 'var(--success-700)' }}>
                    {searchResult.total_unpaid_amount > 0 ? 'TOTAL TUNGGAKAN / TAGIHAN' : 'STATUS TAGIHAN'}
                  </div>
                  <div
                    style={{
                      fontSize: 22,
                      fontWeight: 800,
                      color: searchResult.total_unpaid_amount > 0 ? 'var(--danger-700)' : 'var(--success-700)',
                      marginTop: 2
                    }}
                  >
                    {searchResult.total_unpaid_amount > 0 ? formatRupiah(searchResult.total_unpaid_amount) : 'LUNAS (NIHIL)'}
                  </div>
                  {searchResult.meter && (
                    <div style={{ fontSize: 11, color: 'var(--slate-500)', marginTop: 4 }}>
                      Angka Meter Terakhir: {searchResult.meter.current_reading} m³
                    </div>
                  )}
                </div>
              </div>
            </Card>

            {/* Bill List */}
            <Card title="Daftar Tagihan & Riwayat Pembayaran">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {searchResult.bills.map((bill: Bill) => (
                  <div
                    key={bill.id}
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: 14,
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--slate-50)',
                      border: '1px solid var(--slate-200)',
                      gap: 12
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--slate-900)' }}>
                          {formatPeriod(bill.period_month, bill.period_year)}
                        </span>
                        <Badge status={bill.status} />
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--slate-600)', marginTop: 4 }}>
                        No. Faktur: <strong>{bill.bill_no}</strong> | Pemakaian: <strong>{formatM3(bill.usage_m3)}</strong> ({bill.prev_reading} → {bill.current_reading} m³)
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--slate-500)', marginTop: 2 }}>
                        Jatuh Tempo: {formatDate(bill.due_date)}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 11, color: 'var(--slate-500)' }}>Total Tagihan</div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--slate-900)' }}>
                          {formatRupiah(bill.total_amount)}
                        </div>
                        {bill.balance_due > 0 && bill.status !== 'Lunas' && (
                          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--danger-600)' }}>
                            Sisa: {formatRupiah(bill.balance_due)}
                          </div>
                        )}
                      </div>

                      <Button
                        size="sm"
                        variant="outline-primary"
                        icon={<FileText size={14} />}
                        onClick={() => handleOpenInvoice(bill)}
                      >
                        Detail & Cetak
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Payment instructions */}
            <div
              style={{
                marginTop: 20,
                padding: 16,
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--slate-50)',
                border: '1px solid var(--slate-200)',
                fontSize: 13,
                color: 'var(--slate-600)'
              }}
            >
              <div style={{ fontWeight: 700, color: 'var(--slate-900)', marginBottom: 6 }}>
                Petunjuk Pembayaran:
              </div>
              <p>
                Pembayaran tagihan air dapat dilakukan secara langsung di <strong>Kantor BUMDes / Loket Desa</strong>, atau melalui transfer ke:
              </p>
              <div style={{ marginTop: 6, fontWeight: 600, color: 'var(--primary-800)' }}>
                {settings.bank_account_info}
              </div>
              <p style={{ marginTop: 6, fontSize: 12, color: 'var(--slate-500)' }}>
                *Setelah melakukan transfer, silakan konfirmasi bukti transfer ke nomor WhatsApp: <strong>{settings.contact_phone}</strong>.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Bill Invoice Modal for Printing */}
      <BillInvoiceModal
        isOpen={invoiceModalOpen}
        onClose={() => setInvoiceModalOpen(false)}
        bill={selectedBill}
        customer={searchResult?.customer}
      />
    </div>
  );
};
