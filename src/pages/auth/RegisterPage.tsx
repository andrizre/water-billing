import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Droplets, Key, User, Lock, Phone, MapPin, CheckCircle2, ArrowRight, ShieldCheck, AlertCircle } from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { useToast } from '../../context/ToastContext';
import { api } from '../../services/api';

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { success, error: toastError } = useToast();

  // Step 1: Token verification
  const [tokenStr, setTokenStr] = useState('');
  const [tokenVerified, setTokenVerified] = useState(false);
  const [verifiedTokenData, setVerifiedTokenData] = useState<any>(null);
  const [verifying, setVerifying] = useState(false);

  // Step 2: Form fields
  const [fullName, setFullName] = useState('');
  const [nik, setNik] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [rtRw, setRtRw] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleVerifyToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenStr.trim()) {
      toastError('Silakan masukkan token pendaftaran dari admin.');
      return;
    }

    try {
      setVerifying(true);
      const res = await api.verifyRegistrationToken(tokenStr);
      setVerifiedTokenData(res.token);
      setTokenVerified(true);
      if (res.token.recipient_name) {
        setFullName(res.token.recipient_name);
      }
      success('Token pendaftaran valid! Silakan lengkapi formulir di bawah ini.');
    } catch (err: any) {
      toastError(err.message || 'Token tidak valid atau sudah kadaluarsa.');
    } finally {
      setVerifying(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fullName.trim() || !username.trim() || !password.trim()) {
      toastError('Nama lengkap, username, dan kata sandi wajib diisi.');
      return;
    }

    if (password.length < 6) {
      toastError('Kata sandi minimal 6 karakter.');
      return;
    }

    if (password !== confirmPassword) {
      toastError('Konfirmasi kata sandi tidak cocok.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.registerWithToken({
        tokenStr,
        fullName,
        nik,
        phone,
        address,
        rtRw,
        username,
        password
      });

      success(res.message || 'Pendaftaran berhasil! Silakan login dengan akun Anda.');
      setTimeout(() => {
        navigate('/login');
      }, 1500);
    } catch (err: any) {
      toastError(err.message || 'Pendaftaran gagal.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--slate-100)',
        padding: '24px 16px',
      }}
    >
      <div style={{ width: '100%', maxWidth: 520 }}>
        {/* Header Branding */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 'var(--radius-lg)',
              backgroundColor: 'var(--primary-600)',
              color: '#ffffff',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 16px rgba(2, 132, 199, 0.3)',
              marginBottom: 12,
            }}
          >
            <Droplets size={28} />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--slate-900)' }}>
            Daftar Akun Pelanggan Air
          </h1>
          <p style={{ fontSize: 13.5, color: 'var(--slate-500)', marginTop: 4 }}>
            BUMDes Tirta Sandmosquito &middot; Registrasi Pelanggan Baru
          </p>
        </div>

        <Card>
          {!tokenVerified ? (
            /* STEP 1: Token Input Form */
            <form onSubmit={handleVerifyToken}>
              <div
                style={{
                  padding: 14,
                  backgroundColor: 'var(--primary-50)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--primary-200)',
                  marginBottom: 20,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                }}
              >
                <Key size={20} color="var(--primary-600)" style={{ flexShrink: 0, marginTop: 2 }} />
                <div style={{ fontSize: 13, color: 'var(--primary-900)', lineHeight: 1.5 }}>
                  <strong>Memerlukan Token Pendaftaran</strong>
                  <p style={{ marginTop: 2, color: 'var(--slate-600)' }}>
                    Pendaftaran pelanggan baru memerlukan Token Undangan Resmi dari Administrator / Kantor BUMDes.
                  </p>
                </div>
              </div>

              <Input
                label="Masukkan Token Pendaftaran"
                placeholder="Contoh: DESA-AIR-2026 atau WARGA-MANDIRI-88"
                value={tokenStr}
                onChange={(e) => setTokenStr(e.target.value.toUpperCase())}
                required
                hint="Dapatkan token dari petugas loket atau administrator desa."
              />

              <Button
                type="submit"
                variant="primary"
                icon={<ArrowRight size={16} />}
                loading={verifying}
                style={{ width: '100%', marginTop: 10 }}
              >
                Verifikasi Token & Lanjutkan
              </Button>

              <div style={{ textAlign: 'center', marginTop: 20, fontSize: 13 }}>
                <span style={{ color: 'var(--slate-500)' }}>Sudah memiliki akun? </span>
                <Link to="/login" style={{ fontWeight: 700, color: 'var(--primary-600)' }}>
                  Masuk di sini
                </Link>
              </div>
            </form>
          ) : (
            /* STEP 2: Full Customer Registration Form */
            <form onSubmit={handleRegister}>
              <div
                style={{
                  padding: 12,
                  backgroundColor: 'var(--success-50)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid rgba(16,185,129,0.3)',
                  marginBottom: 18,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <ShieldCheck size={20} color="var(--success-600)" />
                <div style={{ fontSize: 12.5, color: 'var(--success-800)' }}>
                  Token <strong>{tokenStr}</strong> valid! {verifiedTokenData?.notes && `(${verifiedTokenData.notes})`}
                </div>
              </div>

              <Input
                label="Nama Lengkap Sesuai KTP"
                placeholder="Contoh: Bpk. Supardi"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <Input
                  label="Nomor Induk Kependudukan (NIK)"
                  placeholder="16 digit NIK"
                  value={nik}
                  onChange={(e) => setNik(e.target.value)}
                />
                <Input
                  label="Nomor WhatsApp / HP"
                  placeholder="Contoh: 081234567890"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14 }}>
                <Input
                  label="Alamat Rumah"
                  placeholder="Contoh: Jl. Mawar No. 12"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
                <Input
                  label="RT / RW"
                  placeholder="RT 01 / RW 01"
                  value={rtRw}
                  onChange={(e) => setRtRw(e.target.value)}
                />
              </div>

              <div style={{ margin: '14px 0', borderTop: '1px solid var(--slate-200)', paddingTop: 14 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--slate-500)', textTransform: 'uppercase' }}>
                  Akun Masuk (Login)
                </span>
              </div>

              <Input
                label="Username Baru"
                placeholder="Contoh: supardi_desa atau nomor HP"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
                required
              />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <Input
                  label="Kata Sandi"
                  type="password"
                  placeholder="Min. 6 karakter"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <Input
                  label="Konfirmasi Sandi"
                  type="password"
                  placeholder="Ulangi kata sandi"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>

              <Button
                type="submit"
                variant="success"
                icon={<CheckCircle2 size={16} />}
                loading={submitting}
                style={{ width: '100%', marginTop: 14 }}
              >
                Selesaikan Pendaftaran
              </Button>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16, fontSize: 13 }}>
                <button
                  type="button"
                  onClick={() => setTokenVerified(false)}
                  style={{ background: 'none', border: 'none', color: 'var(--slate-500)', cursor: 'pointer' }}
                >
                  &larr; Ganti Token
                </button>
                <Link to="/login" style={{ fontWeight: 700, color: 'var(--primary-600)' }}>
                  Batal & Masuk
                </Link>
              </div>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
};
