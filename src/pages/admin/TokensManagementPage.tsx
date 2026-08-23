import React, { useState, useEffect, useCallback } from 'react';
import { Key, Plus, Trash2, Copy, CheckCircle2, XCircle, Users, Shield } from 'lucide-react';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { EmptyState } from '../../components/common/EmptyState';
import { DataTable } from '../../components/common/DataTable';
import { useToast } from '../../context/ToastContext';
import { api } from '../../services/api';
import { RegistrationToken, Tariff } from '../../types';
import { formatDateTime } from '../../utils/formatters';

export const TokensManagementPage: React.FC = () => {
  const { showToast } = useToast();
  const [tokens, setTokens] = useState<RegistrationToken[]>([]);
  const [tariffs, setTariffs] = useState<Tariff[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Form states
  const [tokenType, setTokenType] = useState<'registration' | 'password_reset'>('registration');
  const [customToken, setCustomToken] = useState<string>('');
  const [recipientName, setRecipientName] = useState<string>('');
  const [targetRole, setTargetRole] = useState<'customer' | 'operator'>('customer');
  const [defaultTariffId, setDefaultTariffId] = useState<string>('TRF-01');
  const [notes, setNotes] = useState<string>('');

  const fetchTokens = useCallback(async () => {
    try {
      setLoading(true);
      const [tokenList, tariffList] = await Promise.all([
        api.getRegistrationTokens(),
        api.getTariffs()
      ]);
      setTokens(tokenList);
      setTariffs(tariffList);
      if (tariffList.length > 0) setDefaultTariffId(tariffList[0].id);
    } catch (err: any) {
      showToast(err.message || 'Gagal memuat token pendaftaran', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchTokens();
  }, [fetchTokens]);

  const handleCreateToken = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await api.createRegistrationToken({
        token: customToken.trim() ? customToken.trim().toUpperCase() : undefined,
        token_type: tokenType,
        recipient_name: recipientName.trim() || undefined,
        target_role: targetRole,
        default_tariff_id: tokenType === 'registration' ? defaultTariffId : undefined,
        notes: notes.trim() || undefined
      });
      showToast(
        tokenType === 'password_reset'
          ? 'Token khusus reset password berhasil dibuat!'
          : 'Token pendaftaran berhasil diterbitkan!',
        'success'
      );
      setCustomToken('');
      setRecipientName('');
      setNotes('');
      setModalOpen(false);
      fetchTokens();
    } catch (err: any) {
      showToast(err.message || 'Gagal membuat token', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Yakin ingin menghapus token ini? Token yang terhapus tidak dapat digunakan lagi.')) return;
    try {
      await api.deleteRegistrationToken(id);
      showToast('Token pendaftaran berhasil dihapus', 'success');
      fetchTokens();
    } catch (err: any) {
      showToast(err.message || 'Gagal menghapus token', 'error');
    }
  };

  const handleCopy = (token: string) => {
    navigator.clipboard.writeText(token);
    showToast(`Token "${token}" disalin ke clipboard!`, 'info');
  };

  return (
    <div className="fade-in">
      <PageHeader
        title="Kelola Token Registrasi & Reset Sandi"
        subtitle="Buat dan pantau kode token undangan untuk pendaftaran akun pelanggan baru atau reset kata sandi warga yang lupa."
        action={
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => setModalOpen(true)}>
            Buat Token Baru
          </Button>
        }
      />

      <DataTable
        columns={[
          {
            header: 'Kode Token',
            render: (t: RegistrationToken) => (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 13.5, color: t.token_type === 'password_reset' ? 'var(--danger-700)' : 'var(--primary-700)' }}>
                  {t.token}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy(t.token)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--slate-400)' }}
                  title="Salin token"
                >
                  <Copy size={13} />
                </button>
              </div>
            )
          },
          {
            header: 'Tipe Token',
            render: (t: RegistrationToken) => (
              <Badge variant={t.token_type === 'password_reset' ? 'danger' : 'info'}>
                {t.token_type === 'password_reset' ? 'Reset Password' : 'Registrasi Akun'}
              </Badge>
            )
          },
          {
            header: 'Penerima / Warga',
            render: (t: RegistrationToken) => (
              <div style={{ fontWeight: 600 }}>{t.recipient_name || 'Umum'}</div>
            )
          },
          {
            header: 'Peruntukan Role',
            render: (t: RegistrationToken) => (
              <Badge variant={t.target_role === 'operator' ? 'info' : 'neutral'}>
                {t.target_role === 'operator' ? 'Operator' : 'Pelanggan'}
              </Badge>
            )
          },
          {
            header: 'Status',
            render: (t: RegistrationToken) => (
              t.is_used ? (
                <Badge variant="success">
                  <CheckCircle2 size={11} style={{ marginRight: 3 }} /> Terpakai ({t.used_by_username})
                </Badge>
              ) : (
                <Badge variant="warning">
                  <Key size={11} style={{ marginRight: 3 }} /> Belum Digunakan
                </Badge>
              )
            )
          },
          {
            header: 'Keterangan',
            render: (t: RegistrationToken) => (
              <span style={{ fontSize: 12, color: 'var(--slate-600)' }}>{t.notes || '-'}</span>
            )
          },
          {
            header: 'Tanggal',
            render: (t: RegistrationToken) => formatDateTime(t.created_at || '')
          },
          {
            header: 'Aksi',
            align: 'right' as const,
            render: (t: RegistrationToken) => (
              <Button
                size="sm"
                variant="danger"
                icon={<Trash2 size={13} />}
                onClick={() => handleDelete(t.id)}
              >
                Hapus
              </Button>
            )
          }
        ]}
        data={tokens}
        loading={loading}
        emptyTitle="Belum Ada Token Pendaftaran"
        emptyMessage="Buat kode token undangan agar calon pelanggan dapat mendaftar akun di sistem."
      />

      {/* Modal Create Token */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Buat Token Baru (Registrasi / Reset Sandi)"
      >
        <form onSubmit={handleCreateToken}>
          <Select
            label="Tipe / Peruntukan Token"
            value={tokenType}
            onChange={(e) => setTokenType(e.target.value as any)}
            options={[
              { value: 'registration', label: '1. Token Pendaftaran Akun Pelanggan Baru' },
              { value: 'password_reset', label: '2. Token Khusus Reset / Lupa Kata Sandi' },
            ]}
            required
          />

          <Input
            label="Kode Token Kustom (Kosongkan untuk acak otomatis)"
            placeholder={tokenType === 'password_reset' ? 'Contoh: RESET-BUDI-2026' : 'Contoh: WARGA-RT01-001'}
            value={customToken}
            onChange={(e) => setCustomToken(e.target.value.toUpperCase())}
            hint={tokenType === 'password_reset' ? 'Otomatis membuat kode seperti RST-88F2 jika dikosongkan.' : 'Otomatis membuat kode seperti DESA-A8F2 jika dikosongkan.'}
          />

          <Input
            label={tokenType === 'password_reset' ? 'Nama Pelanggan Yang Meminta Reset' : 'Nama Calon Penerima Token (Warga/Pelanggan)'}
            placeholder="Contoh: Bpk. Budi Santoso"
            value={recipientName}
            onChange={(e) => setRecipientName(e.target.value)}
          />

          <div className="form-grid-2">
            <Select
              label="Role Akun Yang Dituju"
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value as any)}
              options={[
                { value: 'customer', label: 'Pelanggan Air (Warga)' },
                { value: 'operator', label: 'Petugas Lapangan / Operator' },
              ]}
              required
            />

            {tokenType === 'registration' ? (
              <Select
                label="Tarif Bawaan Pelanggan"
                value={defaultTariffId}
                onChange={(e) => setDefaultTariffId(e.target.value)}
                options={tariffs.map((t) => ({ value: t.id, label: t.name }))}
              />
            ) : (
              <Input
                label="Keperluan Token"
                value="Reset Password Warga"
                disabled
              />
            )}
          </div>

          <Input
            label="Catatan Tambahan (Opsional)"
            placeholder="Contoh: Sambungan baru dusun timur"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

          <div className="modal-footer" style={{ padding: '16px 0 0 0', marginTop: 20 }}>
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>
              Batal
            </Button>
            <Button variant="primary" type="submit" icon={<Key size={15} />} disabled={submitting}>
              {submitting ? 'Membuat...' : 'Buat & Terbitkan Token'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
