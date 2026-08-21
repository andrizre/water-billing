import React, { useState, useEffect, useCallback } from 'react';
import { User, Lock, KeyRound, Shield, Gauge, MapPin, Phone } from 'lucide-react';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Badge } from '../../components/common/Badge';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { api } from '../../services/api';
import { Customer, WaterMeter, Tariff } from '../../types';
import { formatM3 } from '../../utils/formatters';

export const CustomerProfilePage: React.FC = () => {
  const { user, changePassword } = useAuth();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [meter, setMeter] = useState<WaterMeter | null>(null);
  const [tariff, setTariff] = useState<Tariff | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Change Password Form
  const [oldPassword, setOldPassword] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [savingPassword, setSavingPassword] = useState<boolean>(false);

  const { success, error: toastError } = useToast();

  const fetchProfile = useCallback(async () => {
    if (!user?.customerId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const res = await api.getCustomerById(user.customerId);
      setCustomer(res.customer);
      setMeter(res.meter);
      setTariff(res.tariff);
    } catch (err) {
      console.error('Failed to load profile:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.customerId]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oldPassword || !newPassword) {
      toastError('Kata sandi lama dan baru wajib diisi.');
      return;
    }
    if (newPassword.length < 6) {
      toastError('Kata sandi baru minimal 6 karakter.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toastError('Konfirmasi kata sandi baru tidak cocok.');
      return;
    }

    setSavingPassword(true);
    try {
      await changePassword(oldPassword, newPassword);
      success('Kata sandi Anda berhasil diperbarui.');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      toastError(err.message || 'Gagal mengubah kata sandi.');
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Profil Pelanggan & Keamanan Akun"
        subtitle="Informasi identitas sambungan air rumah Anda dan pengaturan kata sandi login."
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 24 }}>
        {/* Customer Data Details Card */}
        <Card title="Data Pelanggan & Meteran Air">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--slate-400)' }}>
                NOMOR PELANGGAN (ID)
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--primary-700)', marginTop: 2 }}>
                {customer?.customer_no || user?.username}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--slate-400)' }}>
                NAMA LENGKAP WARGA
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--slate-900)', marginTop: 2 }}>
                {customer?.full_name || user?.fullName}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--slate-400)' }}>
                  WILAYAH RT / RW
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--slate-800)', marginTop: 2 }}>
                  {customer?.rt_rw || '-'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--slate-400)' }}>
                  NOMOR TELEPON / WA
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--slate-800)', marginTop: 2 }}>
                  {customer?.phone || user?.phone || '-'}
                </div>
              </div>
            </div>

            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--slate-400)' }}>
                ALAMAT RUMAH
              </div>
              <div style={{ fontSize: 13, color: 'var(--slate-700)', marginTop: 2 }}>
                {customer?.address || '-'}
              </div>
            </div>

            <div
              style={{
                backgroundColor: 'var(--slate-50)',
                padding: 14,
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--slate-200)',
                marginTop: 4
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--slate-900)', marginBottom: 8 }}>
                Data Fisik Meteran
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                <span style={{ color: 'var(--slate-500)' }}>Nomor Seri Meter:</span>
                <span style={{ fontWeight: 700 }}>{meter?.meter_no || 'MTR-8801'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                <span style={{ color: 'var(--slate-500)' }}>Angka Meter Terakhir:</span>
                <span style={{ fontWeight: 800, color: 'var(--primary-700)' }}>
                  {formatM3(meter?.current_reading || customer?.current_reading || 0)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: 'var(--slate-500)' }}>Golongan Tarif:</span>
                <Badge variant="neutral">{tariff?.name || 'Rumah Tangga Standar'}</Badge>
              </div>
            </div>
          </div>
        </Card>

        {/* Change Password Card */}
        <Card
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <KeyRound size={18} color="var(--primary-600)" />
              <span>Ganti Kata Sandi (Password)</span>
            </div>
          }
          subtitle="Pastikan menggunakan kata sandi yang aman untuk melindungi akun Anda"
        >
          <form onSubmit={handleChangePasswordSubmit}>
            <Input
              type="password"
              label="Kata Sandi Lama"
              placeholder="Masukkan kata sandi saat ini"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              leftIcon={<Lock size={16} />}
              required
            />

            <Input
              type="password"
              label="Kata Sandi Baru"
              placeholder="Minimal 6 karakter"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              leftIcon={<Lock size={16} />}
              required
            />

            <Input
              type="password"
              label="Konfirmasi Kata Sandi Baru"
              placeholder="Ulangi kata sandi baru"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              leftIcon={<Lock size={16} />}
              required
            />

            <Button
              type="submit"
              variant="primary"
              loading={savingPassword}
              icon={<Shield size={16} />}
              style={{ width: '100%', marginTop: 8 }}
            >
              Perbarui Kata Sandi
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
};
