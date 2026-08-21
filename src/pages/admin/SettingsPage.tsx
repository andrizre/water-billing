import React, { useState, useEffect } from 'react';
import { Save, RefreshCw, Database, CheckCircle, Server, HardDrive } from 'lucide-react';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Badge } from '../../components/common/Badge';
import { useToast } from '../../context/ToastContext';
import { useSettings } from '../../context/SettingsContext';
import { api } from '../../services/api';

export const SettingsPage: React.FC = () => {
  const { settings, updateSettings, refreshSettings } = useSettings();
  const [formData, setFormData] = useState({ ...settings });
  const [saving, setSaving] = useState<boolean>(false);
  const [resetting, setResetting] = useState<boolean>(false);
  const [sqliteStatus, setSqliteStatus] = useState<any>(null);
  const [checkingSqlite, setCheckingSqlite] = useState<boolean>(false);

  const { success, error: toastError } = useToast();

  useEffect(() => {
    setFormData({ ...settings });
  }, [settings]);

  const checkSqlite = async () => {
    setCheckingSqlite(true);
    try {
      const res = await fetch('http://localhost:3001/health', {
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(2000)
      });
      if (res.ok) {
        const data = await res.json();
        setSqliteStatus(data);
        success('Server SQLite lokal terhubung dengan baik!');
      } else {
        setSqliteStatus({ status: 'offline' });
      }
    } catch {
      setSqliteStatus({ status: 'offline' });
    } finally {
      setCheckingSqlite(false);
    }
  };

  useEffect(() => {
    checkSqlite();
  }, []);

  const handleChange = (key: string, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateSettings(formData);
      success('Pengaturan sistem berhasil disimpan.');
    } catch (err: any) {
      toastError(err.message || 'Gagal menyimpan pengaturan.');
    } finally {
      setSaving(false);
    }
  };

  const handleResetDemoData = async () => {
    if (window.confirm('Reset data simulasi browser ke konfigurasi awal?')) {
      setResetting(true);
      try {
        await api.resetMockData();
        await refreshSettings();
        success('Data berhasil direset.');
        window.location.reload();
      } catch (err: any) {
        toastError(err.message || 'Gagal mereset data.');
      } finally {
        setResetting(false);
      }
    }
  };

  return (
    <div>
      <PageHeader
        title="Pengaturan Sistem & Profil Desa"
        subtitle="Konfigurasi identitas pengelola BUMDes, rekening pembayaran, aturan jatuh tempo, dan status database penyimpanan."
      />

      {/* Database Engine Status Banner */}
      <Card
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Database size={18} color="var(--primary-600)" />
            <span>Status Penyimpanan Database (SQLite & Cloud)</span>
          </div>
        }
        style={{ marginBottom: 24 }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--slate-900)' }}>
                Mesin Database Aktif:
              </span>
              {sqliteStatus?.status === 'online' ? (
                <Badge variant="success">SQLite Server (sandmosquito.db)</Badge>
              ) : import.meta.env.VITE_GAS_API_URL ? (
                <Badge variant="info">Google Spreadsheet (GAS Cloud)</Badge>
              ) : (
                <Badge variant="warning">SQLite Simulator / Local Storage</Badge>
              )}
            </div>
            <p style={{ fontSize: 13, color: 'var(--slate-600)', lineHeight: 1.5 }}>
              {sqliteStatus?.status === 'online'
                ? `Server backend SQLite aktif di http://localhost:3001. Data tersimpan permanen di file disk "sandmosquito.db".`
                : `Untuk mengaktifkan backend SQLite lokal di komputer Anda, jalankan perintah terminal: bun run server`}
            </p>
            {sqliteStatus?.tables && (
              <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 12, color: 'var(--slate-500)' }}>
                <span>👥 {sqliteStatus.tables.customers} Pelanggan</span>
                <span>•</span>
                <span>📟 {sqliteStatus.tables.meters} Meter Air</span>
                <span>•</span>
                <span>📄 {sqliteStatus.tables.bills} Tagihan</span>
                <span>•</span>
                <span>💳 {sqliteStatus.tables.payments} Pembayaran</span>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              variant="secondary"
              size="sm"
              icon={<Server size={14} />}
              onClick={checkSqlite}
              loading={checkingSqlite}
            >
              Cek Koneksi SQLite
            </Button>
          </div>
        </div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 24 }}>
        {/* Village & Agency Profile Card */}
        <Card title="Identitas BUMDes / Pengelola Air">
          <form onSubmit={handleSave}>
            <Input
              label="Nama Aplikasi"
              value={formData.app_name}
              onChange={(e) => handleChange('app_name', e.target.value)}
              required
            />
            <Input
              label="Nama Desa"
              value={formData.village_name}
              onChange={(e) => handleChange('village_name', e.target.value)}
              required
            />
            <Input
              label="Nama Instansi / BUMDes"
              value={formData.organization_name}
              onChange={(e) => handleChange('organization_name', e.target.value)}
              required
            />
            <Input
              label="Alamat Lengkap Kantor"
              value={formData.village_address}
              onChange={(e) => handleChange('village_address', e.target.value)}
              required
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Input
                label="Nomor Telepon Layanan"
                value={formData.contact_phone}
                onChange={(e) => handleChange('contact_phone', e.target.value)}
              />
              <Input
                label="Email Resmi"
                value={formData.contact_email}
                onChange={(e) => handleChange('contact_email', e.target.value)}
              />
            </div>

            <Button type="submit" variant="primary" icon={<Save size={16} />} loading={saving} style={{ marginTop: 8 }}>
              Simpan Identitas
            </Button>
          </form>
        </Card>

        {/* Financial Rules & Bill Formatting */}
        <Card title="Aturan Penagihan & Pembayaran">
          <form onSubmit={handleSave}>
            <Input
              label="Informasi Rekening Bank Pembayaran"
              placeholder="Contoh: Bank BRI: 1234-01-000123-53-0 a.n BUMDes"
              value={formData.bank_account_info}
              onChange={(e) => handleChange('bank_account_info', e.target.value)}
            />
            <Input
              label="Informasi Pembayaran QRIS / Loket"
              placeholder="Tersedia di loket kantor desa atau scan barcode resmi"
              value={formData.qris_info}
              onChange={(e) => handleChange('qris_info', e.target.value)}
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Input
                type="number"
                label="Tanggal Jatuh Tempo Bulanan"
                placeholder="20"
                value={formData.due_day_of_month}
                onChange={(e) => handleChange('due_day_of_month', e.target.value)}
              />
              <Input
                type="number"
                label="Standar Denda Flat (Rp)"
                placeholder="5000"
                value={formData.late_fee_flat}
                onChange={(e) => handleChange('late_fee_flat', e.target.value)}
              />
            </div>
            <Input
              label="Catatan Kaki Struk / Faktur"
              value={formData.bill_footer_notes}
              onChange={(e) => handleChange('bill_footer_notes', e.target.value)}
            />

            <Button type="submit" variant="primary" icon={<Save size={16} />} loading={saving} style={{ marginTop: 8 }}>
              Simpan Aturan Tagihan
            </Button>
          </form>
        </Card>
      </div>

      {/* Maintenance Card */}
      <Card title="Pemeliharaan Database Simulasi" style={{ marginTop: 24 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--slate-900)' }}>
              Reset Data Demo Browser
            </h4>
            <p style={{ fontSize: 13, color: 'var(--slate-500)', marginTop: 2 }}>
              Kembalikan seluruh data simulasi browser ke setelan default awal.
            </p>
          </div>
          <Button
            variant="secondary"
            icon={<RefreshCw size={15} />}
            onClick={handleResetDemoData}
            loading={resetting}
          >
            Reset Data Demo
          </Button>
        </div>
      </Card>
    </div>
  );
};
