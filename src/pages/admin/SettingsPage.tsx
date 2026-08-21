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
      name: '1. Supabase Cloud Database (Default Rekomendasi)',
      description: 'Database PostgreSQL cloud terkelola dengan performa tinggi, backup otomatis, dan real-time sync.',
      icon: <Cloud size={20} color="var(--primary-600)" />,
      status: activeBackend === 'supabase' ? 'active' : isSupabaseConfigured() ? 'ready' : 'offline',
      statusText: isSupabaseConfigured() ? 'Terkoneksi (Aktif)' : 'Kredensial belum diisi di .env',
      instructions: 'Atur VITE_ACTIVE_BACKEND=supabase di file .env untuk mengaktifkan.',
    },
    {
      id: 'sqlite',
      name: '2. SQLite Lokal (sandmosquito.db)',
      description: 'Database relasional lokal di komputer/server desa, tersimpan di file sandmosquito.db (WAL mode).',
      icon: <HardDrive size={20} color="var(--accent-600)" />,
      status: activeBackend === 'sqlite' ? 'active' : sqliteStatus?.status === 'online' ? 'ready' : 'offline',
      statusText: sqliteStatus?.status === 'online' ? 'Server Aktif (Port 3001)' : 'Server Offline (Jalankan: npm run server)',
      instructions: 'Jalankan terminal: npm run server lalu atur VITE_ACTIVE_BACKEND=sqlite di .env.',
    },
    {
      id: 'gas',
      name: '3. Google Sheets (Google Apps Script Cloud)',
      description: 'Penyimpanan data cloud berbasis Google Spreadsheet melalui integrasi Web App Google Apps Script.',
      icon: <Database size={20} color="var(--warning-600)" />,
      status: activeBackend === 'gas' ? 'active' : import.meta.env.VITE_GAS_API_URL ? 'ready' : 'offline',
      statusText: import.meta.env.VITE_GAS_API_URL ? 'URL Dikonfigurasi' : 'URL GAS belum diisi di .env',
      instructions: 'Deploy script di folder google-apps-script lalu isi VITE_GAS_API_URL dan VITE_ACTIVE_BACKEND=gas di .env.',
    },
    {
      id: 'mock',
      name: '4. LocalStorage Simulator (Mode Demo Offline)',
      description: 'Penyimpanan in-memory di browser tanpa server atau internet, cocok untuk demonstrasi cepat.',
      icon: <Zap size={20} color="var(--slate-600)" />,
      status: activeBackend === 'mock' ? 'active' : 'ready',
      statusText: 'Siap Digunakan di Browser',
      instructions: 'Atur VITE_ACTIVE_BACKEND=mock di file .env.',
    },
  ];

  return (
    <div className="fade-in">
      <PageHeader
        title="Pengaturan Sistem & Konfigurasi Database"
        subtitle="Kelola identitas BUMDes, rekening bank, aturan denda, dan pilih salah satu dari 4 database backend aktif."
      />

      {/* 4 Database Backends Selection Panel */}
      <Card
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Database size={18} color="var(--primary-600)" />
            <span>Pilihan Mesin Database (4 Opsi Backend)</span>
          </div>
        }
        subtitle="Sistem mendukung 4 backend penyimpanan. Database yang aktif saat ini ditentukan langsung di file konfigurasi .env (VITE_ACTIVE_BACKEND)."
        style={{ marginBottom: 24 }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {databaseOptions.map((opt) => {
            const isActive = activeBackend === opt.id;
            return (
              <div
                key={opt.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: 16,
                  padding: 16,
                  borderRadius: 'var(--radius-lg)',
                  border: isActive ? '2px solid var(--primary-600)' : '1px solid var(--slate-200)',
                  backgroundColor: isActive ? 'var(--primary-50)' : '#ffffff',
                  boxShadow: isActive ? '0 4px 12px rgba(2, 132, 199, 0.15)' : 'var(--shadow-card)',
                  transition: 'all 0.2s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flex: 1 }}>
                  <div
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: isActive ? '#ffffff' : 'var(--slate-100)',
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
                      <span><strong>Cara Aktivasi:</strong> <code>{opt.instructions}</code></span>
                    </div>
                  </div>
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
              label="Nama Lembaga / BUMDes"
              value={formData.organization_name}
              onChange={(e) => handleChange('organization_name', e.target.value)}
              required
            />
            <Input
              label="Alamat Kantor Pengelola"
              value={formData.village_address}
              onChange={(e) => handleChange('village_address', e.target.value)}
              required
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Input
                label="Nomor WhatsApp Pengelola"
                value={formData.contact_phone}
                onChange={(e) => handleChange('contact_phone', e.target.value)}
              />
              <Input
                label="Email Resmi"
                value={formData.contact_email}
                onChange={(e) => handleChange('contact_email', e.target.value)}
              />
            </div>

            <Button type="submit" variant="primary" icon={<Save size={16} />} loading={saving} style={{ marginTop: 16 }}>
              Simpan Identitas
            </Button>
          </form>
        </Card>

        {/* Billing & Payment Configuration Card */}
        <Card title="Aturan Pembayaran & Rekening Bank">
          <form onSubmit={handleSave}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Input
                label="Tanggal Batas Jatuh Tempo (Setiap Bulan)"
                type="number"
                min="1"
                max="28"
                value={formData.due_day_of_month}
                onChange={(e) => handleChange('due_day_of_month', e.target.value)}
                hint="Misal tanggal 20"
                required
              />
              <Input
                label="Denda Keterlambatan Standar (Rp)"
                type="number"
                value={formData.late_fee_flat}
                onChange={(e) => handleChange('late_fee_flat', e.target.value)}
                hint="Denda tetap per bulan"
                required
              />
            </div>

            <Input
              label="Informasi Rekening Bank Pembayaran"
              value={formData.bank_account_info}
              onChange={(e) => handleChange('bank_account_info', e.target.value)}
              hint="Ditampilkan di invoice tagihan warga"
              required
            />

            <Input
              label="Informasi Pembayaran QRIS"
              value={formData.qris_info}
              onChange={(e) => handleChange('qris_info', e.target.value)}
            />

            <div className="form-group">
              <label className="form-label">Catatan Kaki Faktur / Struk Pembayaran</label>
              <textarea
                className="form-control"
                rows={3}
                value={formData.bill_footer_notes}
                onChange={(e) => handleChange('bill_footer_notes', e.target.value)}
                style={{ resize: 'vertical' }}
              />
            </div>

            <Button type="submit" variant="primary" icon={<Save size={16} />} loading={saving} style={{ marginTop: 16 }}>
              Simpan Aturan Pembayaran
            </Button>
          </form>
        </Card>
      </div>

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
