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
      if (tariffList.length > 0) {
        setDefaultTariffId(tariffList[0].id);
      }
    } catch (err: any) {
      showToast(err.message || 'Gagal memuat token', 'error');
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
        token: customToken,
        recipient_name: recipientName,
        target_role: targetRole,
        default_tariff_id: defaultTariffId,
        notes
      });
      showToast('Token pendaftaran berhasil dibuat!', 'success');
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
    if (!window.confirm('Hapus token pendaftaran ini?')) return;
    try {
      await api.deleteRegistrationToken(id);
      showToast('Token dihapus', 'success');
      fetchTokens();
    } catch (err: any) {
      showToast(err.message || 'Gagal menghapus token', 'error');
    }
  };

  const handleCopy = (tokenStr: string) => {
    navigator.clipboard.writeText(tokenStr);
    showToast(`Token ${tokenStr} disalin ke clipboard!`, 'success');
  };

  return (
    <div className="fade-in">
      <PageHeader
        title="Token Undangan Registrasi Akun"
        subtitle="Buat dan bagikan kode token rahasia kepada warga atau operator baru agar mereka dapat mendaftar mandiri."
        action={
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => setModalOpen(true)}>
            Buat Token Baru
          </Button>
        }
      />

      {loading ? (
        <LoadingSpinner text="Memuat daftar token pendaftaran..." />
      ) : tokens.length === 0 ? (
        <EmptyState
          icon={<Key size={36} />}
          title="Belum Ada Token Pendaftaran"
          description="Buat kode token undangan agar calon pelanggan dapat mendaftar akun di sistem."
          action={
            <Button variant="primary" onClick={() => setModalOpen(true)}>
              Buat Token Sekarang
            </Button>
          }
        />
      ) : (
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Kode Token</th>
                <th>Calon Penerima / Nama Warga</th>
                <th>Peruntukan Role</th>
                <th>Status</th>
                <th>Keterangan / Catatan</th>
                <th>Tanggal Dibuat</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {tokens.map((t) => (
                <tr key={t.id} className="row-hover-highlight">
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 14, color: 'var(--primary-700)' }}>
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
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{t.recipient_name || 'Umum'}</div>
                  </td>
                  <td>
                    <Badge variant={t.target_role === 'operator' ? 'info' : 'neutral'}>
                      {t.target_role === 'operator' ? 'Operator' : 'Pelanggan'}
                    </Badge>
                  </td>
                  <td>
                    {t.is_used ? (
                      <Badge variant="success">
                        <CheckCircle2 size={11} style={{ marginRight: 3 }} /> Terpakai ({t.used_by_username})
                      </Badge>
                    ) : (
                      <Badge variant="warning">
                        <Key size={11} style={{ marginRight: 3 }} /> Belum Digunakan
                      </Badge>
                    )}
                  </td>
                  <td style={{ fontSize: 12.5, color: 'var(--slate-600)' }}>
                    {t.notes || '-'}
                  </td>
                  <td>{formatDateTime(t.created_at || '')}</td>
                  <td>
                    <Button
                      size="sm"
                      variant="danger"
                      icon={<Trash2 size={13} />}
                      onClick={() => handleDelete(t.id)}
                    >
                      Hapus
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Create Token */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Buat Token Pendaftaran Baru"
      >
        <form onSubmit={handleCreateToken}>
          <Input
            label="Kode Token Kustom (Kosongkan untuk acak otomatis)"
            placeholder="Contoh: WARGA-RT01-001 (Opsional)"
            value={customToken}
            onChange={(e) => setCustomToken(e.target.value.toUpperCase())}
            hint="Jika dikosongkan, sistem akan membuatkan kode token acak seperti DESA-A8F2."
          />

          <Input
            label="Nama Calon Penerima Token (Warga/Pelanggan)"
            placeholder="Contoh: Bpk. Ahmad Dahlan"
            value={recipientName}
            onChange={(e) => setRecipientName(e.target.value)}
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Select
              label="Role Akun Yang Didaftarkan"
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value as any)}
              options={[
                { value: 'customer', label: 'Pelanggan Air (Warga)' },
                { value: 'operator', label: 'Petugas Lapangan / Operator' },
              ]}
              required
            />

            <Select
              label="Tarif Bawaan Pelanggan"
              value={defaultTariffId}
              onChange={(e) => setDefaultTariffId(e.target.value)}
              options={tariffs.map((t) => ({ value: t.id, label: t.name }))}
            />
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
