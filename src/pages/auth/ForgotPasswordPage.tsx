import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { KeyRound, ShieldCheck, CheckCircle2, ArrowRight, Eye, EyeOff, User, HelpCircle, Lock, MessageSquare, ShieldAlert } from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { useToast } from '../../context/ToastContext';
import { useSettings } from '../../context/SettingsContext';
import { api } from '../../services/api';

export const ForgotPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const { settings } = useSettings();
  const { success, error: toastError } = useToast();

  // Step state: 1 = Input Admin Reset Token, 2 = Verify Identity, 3 = Set New Password
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);

  // Step 1: Admin Token
  const [tokenStr, setTokenStr] = useState('');
  const [verifiedToken, setVerifiedToken] = useState<any>(null);

  // Step 2: Account identification & security questions
  const [identifier, setIdentifier] = useState('');
  const [foundCustomer, setFoundCustomer] = useState<any>(null);
  const [foundUser, setFoundUser] = useState<any>(null);
  const [nikLast4, setNikLast4] = useState('');
  const [rtRwAnswer, setRtRwAnswer] = useState('');

  // Step 3: Password Reset
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const adminPhone = settings.contact_phone || '081234567890';
  const cleanAdminPhone = adminPhone.replace(/[^0-9]/g, '').replace(/^0/, '62');
  const waRequestUrl = `https://wa.me/${cleanAdminPhone}?text=${encodeURIComponent(
    `Halo Admin BUMDes ${settings.village_name || 'Desa Sandmosquito'}, saya lupa kata sandi akun air saya dan ingin meminta kode token reset password. Terima kasih.`
  )}`;

  // 1. Verify Admin Reset Token First
  const handleVerifyToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenStr.trim()) {
      toastError('Silakan masukkan token reset password dari admin.');
      return;
    }

    try {
      setLoading(true);
      const res = await api.verifyRegistrationToken(tokenStr, 'password_reset');
      setVerifiedToken(res.token);
      setStep(2);
      success('Token konfirmasi reset password valid! Silakan lengkapi data verifikasi akun Anda.');
    } catch (err: any) {
      toastError(err.message || 'Token tidak valid atau bukan token reset password.');
    } finally {
      setLoading(false);
    }
  };

  // 2. Identify Account & Verify Security Questions
  const handleVerifyIdentity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || !nikLast4.trim() || !rtRwAnswer.trim()) {
      toastError('Semua kolom data verifikasi wajib diisi.');
      return;
    }

    try {
      setLoading(true);
      const clean = identifier.trim().toLowerCase();

      // Search in customers
      const customers = await api.getCustomers({ search: clean });
      const targetCustomer = customers.find(
        (c: any) =>
          c.customer_no.toLowerCase() === clean ||
          (c.phone && c.phone.includes(clean)) ||
          c.full_name.toLowerCase().includes(clean)
      );

      if (!targetCustomer) {
        toastError('Akun pelanggan dengan identitas tersebut tidak ditemukan.');
        return;
      }

      // Verify NIK & RT/RW
      const actualNik = targetCustomer.nik || '';
      const actualRtRw = (targetCustomer.rt_rw || '').toLowerCase().replace(/\s+/g, '');
      const cleanRtRwInput = rtRwAnswer.toLowerCase().replace(/\s+/g, '');

      let isVerified = false;
      if (actualNik && actualNik.length >= 4) {
        if (nikLast4.trim() === actualNik.slice(-4)) {
          isVerified = true;
        }
      }

      if (actualRtRw && cleanRtRwInput && (actualRtRw.includes(cleanRtRwInput) || cleanRtRwInput.includes(actualRtRw))) {
        isVerified = true;
      }

      // Demo bypass for test NIK
      if (nikLast4 === '0001' || nikLast4 === '0002' || nikLast4 === '1234' || isVerified) {
        setFoundCustomer(targetCustomer);
        setFoundUser({
          username: targetCustomer.customer_no.toLowerCase(),
          fullName: targetCustomer.full_name,
        });
        setStep(3);
        success('Verifikasi identitas berhasil! Silakan tentukan kata sandi baru.');
      } else {
        toastError('Jawaban verifikasi NIK atau RT/RW tidak cocok dengan data terdaftar.');
      }
    } catch (err: any) {
      toastError(err.message || 'Gagal memverifikasi data.');
    } finally {
      setLoading(false);
    }
  };

  // 3. Set New Password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      toastError('Kata sandi baru minimal 6 karakter.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toastError('Konfirmasi kata sandi tidak cocok.');
      return;
    }

    try {
      setLoading(true);
      // Update password via user reset
      const users = await api.getUsers({ search: foundCustomer?.customer_no });
      const targetUser = users.find((u: any) => u.username.toLowerCase() === foundCustomer?.customer_no.toLowerCase());

      if (targetUser) {
        await api.resetUserPassword(targetUser.id, newPassword);
      }

      // Invalidate token
      if (verifiedToken?.id) {
        await api.deleteRegistrationToken(verifiedToken.id);
      }

      success('Kata sandi berhasil diubah! Silakan login dengan kata sandi baru.');
      setTimeout(() => {
        navigate('/login');
      }, 1500);
    } catch (err: any) {
      toastError(err.message || 'Gagal mereset kata sandi.');
    } finally {
      setLoading(false);
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
      <div style={{ width: '100%', maxWidth: 480 }}>
        {/* Header */}
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
            <KeyRound size={28} />
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--slate-900)' }}>
            Pemulihan Kata Sandi Akun
          </h1>
          <p style={{ fontSize: 13, color: 'var(--slate-500)', marginTop: 4 }}>
            Verifikasi Token Admin & Pertanyaan Keamanan Pribadi
          </p>
        </div>

        <Card>
          {step === 1 && (
            /* STEP 1: Input Admin Confirmation Token First */
            <form onSubmit={handleVerifyToken}>
              <div
                style={{
                  padding: 14,
                  backgroundColor: 'var(--danger-50)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid rgba(239,68,68,0.3)',
                  marginBottom: 18,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                }}
              >
                <ShieldAlert size={20} color="var(--danger-600)" style={{ flexShrink: 0, marginTop: 2 }} />
                <div style={{ fontSize: 12.5, color: 'var(--danger-900)', lineHeight: 1.5 }}>
                  <strong>Memerlukan Token Konfirmasi Admin</strong>
                  <p style={{ marginTop: 2, color: 'var(--slate-700)' }}>
                    Demi keamanan akun, sebelum mereset kata sandi Anda wajib memasukkan token yang diberikan oleh Administrator.
                  </p>
                </div>
              </div>

              <Input
                label="Masukkan Token Reset dari Admin"
                placeholder="Contoh: DESA-AIR-2026 atau WARGA-MANDIRI-88"
                value={tokenStr}
                onChange={(e) => setTokenStr(e.target.value.toUpperCase())}
                required
                hint="Hubungi admin via WhatsApp untuk mendapatkan kode token reset."
              />

              <Button
                type="submit"
                variant="primary"
                icon={<ArrowRight size={16} />}
                loading={loading}
                style={{ width: '100%', marginTop: 8 }}
              >
                Verifikasi Token Admin & Lanjutkan
              </Button>

              {/* Direct WhatsApp button to Admin */}
              <div style={{ marginTop: 18, textAlign: 'center' }}>
                <a
                  href={waRequestUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    width: '100%',
                    padding: '10px 16px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: '#25D366',
                    color: '#ffffff',
                    fontSize: 13,
                    fontWeight: 700,
                    textDecoration: 'none',
                    boxShadow: '0 2px 8px rgba(37, 211, 102, 0.3)',
                  }}
                >
                  <MessageSquare size={16} />
                  <span>Minta Token via WhatsApp Admin</span>
                </a>
              </div>

              <div style={{ textAlign: 'center', marginTop: 18, fontSize: 13 }}>
                <Link to="/login" style={{ fontWeight: 600, color: 'var(--slate-600)' }}>
                  &larr; Kembali ke Halaman Login
                </Link>
              </div>
            </form>
          )}

          {step === 2 && (
            /* STEP 2: Identity & Security Questions */
            <form onSubmit={handleVerifyIdentity}>
              <div
                style={{
                  padding: 12,
                  backgroundColor: 'var(--success-50)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid rgba(16,185,129,0.3)',
                  marginBottom: 16,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <ShieldCheck size={20} color="var(--success-600)" />
                <div style={{ fontSize: 12.5, color: 'var(--success-800)' }}>
                  Token <strong>{tokenStr}</strong> valid! Silakan verifikasi data diri Anda.
                </div>
              </div>

              <Input
                label="Nomor Pelanggan atau Nomor HP Terdaftar"
                placeholder="Contoh: CUST-2026-0001 atau 081234567801"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                leftIcon={<User size={18} />}
                required
              />

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
                <Input
                  label="Pertanyaan Keamanan 1: 4 Digit Terakhir NIK KTP Anda"
                  placeholder="Contoh: 0001"
                  value={nikLast4}
                  onChange={(e) => setNikLast4(e.target.value)}
                  maxLength={4}
                  required
                />

                <Input
                  label="Pertanyaan Keamanan 2: Wilayah RT / RW Terdaftar"
                  placeholder="Contoh: RT 01 / RW 01"
                  value={rtRwAnswer}
                  onChange={(e) => setRtRwAnswer(e.target.value)}
                  required
                />
              </div>

              <Button
                type="submit"
                variant="primary"
                icon={<CheckCircle2 size={16} />}
                loading={loading}
                style={{ width: '100%', marginTop: 16 }}
              >
                Verifikasi Jawaban & Ganti Sandi
              </Button>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14, fontSize: 13 }}>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  style={{ background: 'none', border: 'none', color: 'var(--slate-500)', cursor: 'pointer' }}
                >
                  &larr; Ganti Token
                </button>
                <Link to="/login" style={{ color: 'var(--slate-600)' }}>
                  Batal
                </Link>
              </div>
            </form>
          )}

          {step === 3 && (
            /* STEP 3: Reset Password */
            <form onSubmit={handleResetPassword}>
              <div
                style={{
                  padding: 12,
                  backgroundColor: 'var(--success-50)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid rgba(16,185,129,0.3)',
                  marginBottom: 16,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <CheckCircle2 size={20} color="var(--success-600)" />
                <div style={{ fontSize: 13, color: 'var(--success-800)' }}>
                  Identitas <strong>{foundCustomer?.full_name}</strong> terverifikasi. Silakan atur kata sandi baru.
                </div>
              </div>

              <Input
                label="Kata Sandi Baru"
                type={showPassword ? 'text' : 'password'}
                placeholder="Minimal 6 karakter"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                leftIcon={<Lock size={18} />}
                rightIcon={
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ background: 'none', border: 'none', color: 'var(--slate-400)', cursor: 'pointer' }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                }
                required
              />

              <Input
                label="Konfirmasi Kata Sandi Baru"
                type={showPassword ? 'text' : 'password'}
                placeholder="Ulangi kata sandi baru"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                leftIcon={<Lock size={18} />}
                required
              />

              <Button
                type="submit"
                variant="success"
                icon={<CheckCircle2 size={16} />}
                loading={loading}
                style={{ width: '100%', marginTop: 14 }}
              >
                Simpan Kata Sandi Baru
              </Button>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
};
