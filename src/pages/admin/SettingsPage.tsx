import React, { useState, useEffect } from 'react';
import { Save, RefreshCw, Database, CheckCircle, Server, HardDrive, Cloud, Zap, Check } from 'lucide-react';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Badge } from '../../components/common/Badge';
import { useToast } from '../../context/ToastContext';
import { useSettings } from '../../context/SettingsContext';
import { api, getActiveBackend, BackendType } from '../../services/api';
import { isSupabaseConfigured } from '../../services/supabaseClient';

export const SettingsPage: React.FC = () => {
  const { settings, updateSettings, refreshSettings } = useSettings();
  const [formData, setFormData] = useState({ ...settings });
  const [saving, setSaving] = useState<boolean>(false);
  const [resetting, setResetting] = useState<boolean>(false);
  const [sqliteStatus, setSqliteStatus] = useState<any>(null);
  const [checkingSqlite, setCheckingSqlite] = useState<boolean>(false);

  const { success, error: toastError } = useToast();
  const activeBackend = getActiveBackend();

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

  const handleSwitchBackend = async (backendId: BackendType) => {
    if (backendId === activeBackend) return;

    if (backendId === 'supabase' && !isSupabaseConfigured()) {
      toastError('Kredensial Supabase (VITE_SUPABASE_URL / ANON_KEY) belum diisi di .env.');
      return;
    }

    if (backendId === 'sqlite' && sqliteStatus?.status !== 'online') {
      const confirmSwitch = window.confirm(
        'Server SQLite lokal (http://localhost:3001) tampaknya belum aktif. Apakah Anda ingin tetap mengaktifkannya? (Pastikan jalankan terminal: npm run server)'
      );
      if (!confirmSwitch) return;
    }

    if (backendId === 'gas' && !import.meta.env.VITE_GAS_API_URL) {
      toastError('VITE_GAS_API_URL belum dikonfigurasi di file .env.');
      return;
    }

    api.setActiveBackend(backendId);
    success(`Berhasil beralih ke Database: ${backendId.toUpperCase()}! Sistem memuat ulang...`);
    setTimeout(() => {
      window.location.reload();
    }, 600);
  };

  const databaseOptions: {
    id: BackendType;
    name: string;
    description: string;
    icon: React.ReactNode;
    status: 'active' | 'ready' | 'offline';
    statusText: string;
    instructions: string;
  }[] = [
    {
      id: 'supabase',
      name: '1. Supabase Cloud Database',
      description: 'Database PostgreSQL cloud terkelola dengan performa tinggi, backup otomatis, dan real-time sync.',
      icon: <Cloud size={20} color="var(--primary-600)" />,
      status: activeBackend === 'supabase' ? 'active' : isSupabaseConfigured() ? 'ready' : 'offline',
      statusText: isSupabaseConfigured() ? 'Terkoneksi (Aktif / Siap)' : 'Kredensial belum diisi di .env',
      instructions: 'Isi VITE_SUPABASE_URL & ANON_KEY di .env atau klik tombol aktifkan di samping.',
    },
    {
      id: 'sqlite',
      name: '2. SQLite Lokal (sandmosquito.db)',
      description: 'Database relasional lokal di komputer/server desa, tersimpan di file sandmosquito.db (WAL mode).',
      icon: <HardDrive size={20} color="var(--accent-600)" />,
      status: activeBackend === 'sqlite' ? 'active' : sqliteStatus?.status === 'online' ? 'ready' : 'offline',
      statusText: sqliteStatus?.status === 'online' ? 'Server Aktif (Port 3001)' : 'Server Offline (Jalankan: npm run server)',
      instructions: 'Jalankan terminal: npm run server lalu klik tombol aktifkan.',
    },
    {
      id: 'gas',
      name: '3. Google Sheets (Google Apps Script Cloud)',
      description: 'Penyimpanan data cloud berbasis Google Spreadsheet melalui integrasi Web App Google Apps Script.',
      icon: <Database size={20} color="var(--warning-600)" />,
      status: activeBackend === 'gas' ? 'active' : import.meta.env.VITE_GAS_API_URL ? 'ready' : 'offline',
      statusText: import.meta.env.VITE_GAS_API_URL ? 'URL Dikonfigurasi' : 'URL GAS belum diisi di .env',
      instructions: 'Deploy script di google-apps-script lalu isi VITE_GAS_API_URL di .env.',
    },
    {
      id: 'mock',
      name: '4. LocalStorage Simulator (Mode Demo Offline)',
      description: 'Penyimpanan in-memory di browser tanpa server atau internet, cocok untuk demonstrasi cepat.',
      icon: <Zap size={20} color="var(--slate-600)" />,
      status: activeBackend === 'mock' ? 'active' : 'ready',
      statusText: 'Siap Digunakan di Browser (100% Fleksibel)',
      instructions: 'Klik tombol di samping untuk beralih kapan saja.',
    },
  ];

  return (
    <div className="fade-in">
      <PageHeader
        title="Pengaturan Sistem & Konfigurasi Database"
        subtitle="Kelola identitas BUMDes, rekening bank, aturan denda, dan pilih salah satu dari 4 database backend aktif."
      />

      <div className="responsive-grid-2" style={{ alignItems: 'start' }}>
        {/* Village & Agency Profile Card */}
        <Card title="Identitas BUMDes / Pengelola Air">
          <form onSubmit={handleSave}>
            <div className="form-grid-2">
              <Input
                label="Nama Aplikasi"
                value={formData.app_name}
                onChange={(e) => handleChange('app_name', e.target.value)}
                required
              />
              <Input
                label="Nama Lembaga / BUMDes"
                value={formData.organization_name}
                onChange={(e) => handleChange('organization_name', e.target.value)}
                required
              />
            </div>

            <div className="form-grid-2">
              <Input
                label="Nama Desa"
                value={formData.village_name}
                onChange={(e) => handleChange('village_name', e.target.value)}
                required
              />
              <Input
                label="Nomor WhatsApp Pengelola"
                value={formData.contact_phone}
                onChange={(e) => handleChange('contact_phone', e.target.value)}
                placeholder="081234567890"
              />
            </div>

            <Input
              label="Alamat Kantor Pengelola"
              value={formData.village_address}
              onChange={(e) => handleChange('village_address', e.target.value)}
              placeholder="Jalan, Nomor, Dusun, RT/RW"
              required
            />

            <Input
              label="Email Resmi (Opsional)"
              value={formData.contact_email}
              onChange={(e) => handleChange('contact_email', e.target.value)}
              placeholder="bumdes@desa.id"
            />

            <Button type="submit" variant="primary" icon={<Save size={16} />} loading={saving} style={{ marginTop: 16 }}>
              Simpan Identitas
            </Button>
          </form>
        </Card>

        {/* Billing & Payment Configuration Card */}
        <Card title="Aturan Pembayaran & Rekening Bank">
          <form onSubmit={handleSave}>
            {/* Section 1: Parameter Tagihan */}
            <div className="form-section-title" style={{ marginTop: 0 }}>
              1. Parameter Tagihan & Batas Waktu
            </div>

            <div className="form-grid-2">
              <Input
                label="Tanggal Batas Jatuh Tempo"
                type="number"
                min="1"
                max="28"
                value={formData.due_day_of_month}
                onChange={(e) => handleChange('due_day_of_month', e.target.value)}
                hint="Misal tanggal 20 setiap bulan"
                required
              />
              <Input
                label="Denda Keterlambatan (Rp)"
                type="number"
                value={formData.late_fee_flat}
                onChange={(e) => handleChange('late_fee_flat', e.target.value)}
                hint="Denda tetap jika lewat jatuh tempo"
                required
              />
            </div>

            <Input
              label="Biaya Administrasi Tagihan (Rp)"
              type="number"
              value={formData.admin_fee_flat || '2500'}
              onChange={(e) => handleChange('admin_fee_flat', e.target.value)}
              hint="Biaya operasional / cetak per lembar tagihan"
              required
            />

            {/* Section 2: Rekening Bank & QRIS */}
            <div className="form-section-title">
              2. Rekening Bank & Pembayaran QRIS
            </div>

            <Input
              label="Informasi Rekening Bank Pembayaran"
              value={formData.bank_account_info}
              onChange={(e) => handleChange('bank_account_info', e.target.value)}
              hint="Dicantumkan di faktur & pesan tagihan WhatsApp"
              placeholder="Contoh: Bank BRI 1234-5678-9012-345 a/n BUMDes Tirta Sandmosquito"
              required
            />

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', gap: 14, alignItems: 'start', marginTop: 10 }}>
              <div>
                <Input
                  label="Nama Merchant QRIS Resmi"
                  value={formData.qris_info}
                  onChange={(e) => handleChange('qris_info', e.target.value)}
                  placeholder="Contoh: BUMDes Tirta Sandmosquito"
                  hint="Nama penerima pada sistem QRIS"
                />

                <Input
                  label="URL Gambar Barcode QRIS"
                  placeholder="https://... (URL gambar barcode)"
                  value={formData.qris_image_url || ''}
                  onChange={(e) => handleChange('qris_image_url', e.target.value)}
                  hint="Gambar barcode otomatis tampil di loket kasir & faktur"
                />
              </div>

              {/* QRIS Image Preview Card */}
              <div className="qris-preview-box" style={{ marginTop: 6 }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--slate-700)', marginBottom: 6 }}>
                  Pratinjau Barcode QRIS:
                </span>
                <img
                  src={formData.qris_image_url || 'https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=BUMDes%20Tirta%20Sandmosquito%20Water%20Billing'}
                  alt="Barcode QRIS"
                  style={{
                    width: 120,
                    height: 120,
                    objectFit: 'contain',
                    backgroundColor: '#ffffff',
                    borderRadius: 6,
                    border: '1px solid var(--slate-200)',
                    padding: 4,
                    boxShadow: 'var(--shadow-sm)'
                  }}
                />
                <span style={{ fontSize: 10.5, color: 'var(--slate-500)', marginTop: 6 }}>
                  {formData.qris_info || 'QRIS BUMDes'}
                </span>
              </div>
            </div>

            {/* Section 3: Catatan Kaki Faktur */}
            <div className="form-section-title">
              3. Catatan Kaki Faktur & Struk
            </div>

            <div className="form-group">
              <label className="form-label">Teks Keterangan di Bagian Bawah Faktur</label>
              <textarea
                className="form-control"
                rows={3}
                value={formData.bill_footer_notes}
                onChange={(e) => handleChange('bill_footer_notes', e.target.value)}
                placeholder="Pesan imbauan hemat air, jam operasional loket, atau informasi kontak"
                style={{ resize: 'vertical' }}
              />
            </div>

            <Button type="submit" variant="primary" icon={<Save size={16} />} loading={saving} style={{ marginTop: 16 }}>
              Simpan Aturan Pembayaran
            </Button>
          </form>
        </Card>
      </div>

      {/* 4 Database Backends Selection Panel (Placed at bottom, right above Reset) */}
      <Card
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Database size={18} color="var(--primary-600)" />
            <span>Pilihan Mesin Database (4 Opsi Backend)</span>
          </div>
        }
        subtitle="Sistem mendukung 4 backend penyimpanan. Database yang aktif saat ini ditentukan langsung di file konfigurasi .env (VITE_ACTIVE_BACKEND)."
        style={{ marginTop: 24 }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {databaseOptions.map((opt) => {
            const isActive = activeBackend === opt.id;
            return (
              <div
                key={opt.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 16,
                  padding: 16,
                  borderRadius: 'var(--radius-lg)',
                  border: isActive ? '2px solid var(--primary-600)' : '1px solid var(--slate-200)',
                  backgroundColor: isActive ? 'var(--primary-50)' : 'var(--card-bg)',
                  boxShadow: isActive ? '0 4px 12px rgba(2, 132, 199, 0.15)' : 'var(--shadow-card)',
                  transition: 'all 0.2s ease',
                  flexWrap: 'wrap'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flex: 1, minWidth: 280 }}>
                  <div
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: isActive ? 'var(--card-bg)' : 'var(--slate-100)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: isActive ? 'var(--shadow-sm)' : 'none',
                    }}
                  >
                    {opt.icon}
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--slate-900)' }}>
                        {opt.name}
                      </span>
                      {isActive && (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            fontSize: 11,
                            fontWeight: 700,
                            backgroundColor: 'var(--primary-600)',
                            color: '#ffffff',
                            padding: '2px 8px',
                            borderRadius: 9999,
                          }}
                        >
                          <Check size={12} /> AKTIF SAAT INI
                        </span>
                      )}
                    </div>

                    <p style={{ fontSize: 13, color: 'var(--slate-600)', lineHeight: 1.5, marginBottom: 6 }}>
                      {opt.description}
                    </p>

                    <div style={{ fontSize: 12, color: 'var(--slate-500)', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                      <span><strong>Status:</strong> {opt.statusText}</span>
                      <span>•</span>
                      <span><strong>Petunjuk:</strong> <code>{opt.instructions}</code></span>
                    </div>
                  </div>
                </div>

                <div style={{ alignSelf: 'center', minWidth: 140, textAlign: 'right' }}>
                  {isActive ? (
                    <Button variant="secondary" size="sm" disabled icon={<Check size={14} />}>
                      Sedang Aktif
                    </Button>
                  ) : (
                    <Button
                      variant="primary"
                      size="sm"
                      icon={<Zap size={14} />}
                      onClick={() => handleSwitchBackend(opt.id)}
                    >
                      Pilih & Aktifkan
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <Button variant="secondary" size="sm" icon={<Server size={14} />} onClick={checkSqlite} loading={checkingSqlite}>
            Uji Ulang Koneksi SQLite
          </Button>
        </div>
      </Card>

      {/* Demo Reset Card */}
      <Card title="Pemeliharaan & Reset Simulasi Browser" style={{ marginTop: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--slate-900)' }}>
              Reset Data Mock Browser
            </h4>
            <p style={{ fontSize: 13, color: 'var(--slate-500)', marginTop: 2 }}>
              Mengembalikan seluruh data simulasi browser (mock mode) ke data awal default desa.
            </p>
          </div>
          <Button
            variant="danger"
            size="sm"
            icon={<RefreshCw size={14} />}
            onClick={handleResetDemoData}
            loading={resetting}
          >
            Reset Data Simulasi
          </Button>
        </div>
      </Card>
    </div>
  );
};
