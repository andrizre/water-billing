import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Droplets, Lock, User, Shield, Search, ArrowRight, Key } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useSettings } from '../../context/SettingsContext';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';

export const LoginPage: React.FC = () => {
  const [username, setUsername] = useState<string>('admin');
  const [password, setPassword] = useState<string>('admin123');
  const [loading, setLoading] = useState<boolean>(false);

  const { login, role } = useAuth();
  const { error: toastError, success: toastSuccess } = useToast();
  const { settings } = useSettings();
  const navigate = useNavigate();

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      toastError('Silakan masukkan username/nomor pelanggan dan password.');
      return;
    }

    setLoading(true);
    try {
      await login(username, password);
      toastSuccess('Login berhasil! Selamat datang di Sandmosquito Water Billing.');

      // Route according to role
      const cleanUser = username.toLowerCase();
      if (cleanUser.includes('admin')) {
        navigate('/admin/dashboard');
      } else if (cleanUser.includes('operator') || cleanUser.includes('petugas')) {
        navigate('/operator/dashboard');
      } else if (cleanUser.includes('cust') || cleanUser.includes('warga')) {
        navigate('/customer/dashboard');
      } else {
        navigate(role === 'customer' ? '/customer/dashboard' : role === 'operator' ? '/operator/dashboard' : '/admin/dashboard');
      }
    } catch (err: any) {
      toastError(err.message || 'Login gagal. Periksa kembali data akun Anda.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFill = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--slate-100)',
        padding: 20
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 440,
          backgroundColor: '#ffffff',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-xl)',
          border: '1px solid var(--slate-200)',
          overflow: 'hidden'
        }}
      >
        {/* Card Header */}
        <div
          style={{
            background: 'linear-gradient(135deg, var(--primary-700), var(--primary-500))',
            color: '#ffffff',
            padding: '32px 28px 24px 28px',
            textAlign: 'center'
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              backdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 14px auto',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
            }}
          >
            <Droplets size={32} color="#ffffff" />
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 800, letterSpacing: -0.5 }}>
            {settings.app_name || 'Sandmosquito Water Billing'}
          </h1>
          <p style={{ fontSize: 13, opacity: 0.9, marginTop: 4 }}>
            Sistem Informasi Pengelolaan Tagihan Air {settings.village_name || 'Desa Sandmosquito'}
          </p>
        </div>

        {/* Card Form Body */}
        <div style={{ padding: '28px' }}>
          <form onSubmit={handleLoginSubmit}>
            <Input
              label="Username / Nomor Pelanggan"
              placeholder="Contoh: admin, operator, atau CUST-2026-0001"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              leftIcon={<User size={18} />}
              required
            />

            <Input
              type="password"
              label="Kata Sandi (Password)"
              placeholder="Masukkan password Anda"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              leftIcon={<Lock size={18} />}
              required
            />

            <Button
              type="submit"
              variant="primary"
              loading={loading}
              style={{ width: '100%', marginTop: 8, padding: '12px' }}
              icon={<ArrowRight size={18} />}
            >
              Masuk ke Aplikasi
            </Button>

            {/* Link Daftar Pelanggan dengan Token */}
            <div style={{ marginTop: 16, textAlign: 'center' }}>
              <Link
                to="/register"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 13,
                  fontWeight: 700,
                  color: 'var(--primary-600)'
                }}
              >
                <Key size={14} />
                <span>Pelanggan Baru? Daftar dengan Token Undangan</span>
              </Link>
            </div>
          </form>

          {/* Quick Demo Credentials */}
          <div
            style={{
              marginTop: 24,
              padding: 14,
              backgroundColor: 'var(--slate-50)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--slate-200)'
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--slate-600)', marginBottom: 8 }}>
              AKUN CONTOH (DEMO LOGIN):
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => handleQuickFill('admin', 'admin123')}
              >
                <Shield size={12} style={{ marginRight: 4 }} /> Admin
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => handleQuickFill('operator', 'operator123')}
              >
                <User size={12} style={{ marginRight: 4 }} /> Operator
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => handleQuickFill('CUST-2026-0001', 'warga123')}
              >
                <Droplets size={12} style={{ marginRight: 4 }} /> Customer (Warga)
              </button>
            </div>
          </div>

          {/* Public Bill Check Link */}
          <div style={{ marginTop: 20, textAlign: 'center' }}>
            <Link
              to="/cek-tagihan"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--primary-700)'
              }}
            >
              <Search size={15} />
              <span>Warga ingin cek tagihan tanpa login? Klik di sini</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
