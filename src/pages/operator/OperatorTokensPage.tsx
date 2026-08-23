import React, { useState, useEffect, useCallback } from 'react';
import { Key, Copy, CheckCircle2, RefreshCw, ShieldAlert, Users } from 'lucide-react';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { EmptyState } from '../../components/common/EmptyState';
import { useToast } from '../../context/ToastContext';
import { api } from '../../services/api';
import { RegistrationToken } from '../../types';
import { formatDateTime } from '../../utils/formatters';

export const OperatorTokensPage: React.FC = () => {
  const { showToast } = useToast();
  const [tokens, setTokens] = useState<RegistrationToken[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const fetchTokens = useCallback(async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true);
      else setLoading(true);
      const res = await api.getRegistrationTokens();
      setTokens(res || []);
    } catch (err: any) {
      showToast(err.message || 'Gagal memuat token pendaftaran', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchTokens();
  }, [fetchTokens]);

  const handleCopy = (tokenStr: string) => {
    navigator.clipboard.writeText(tokenStr);
    showToast(`Token ${tokenStr} disalin ke clipboard! Bagikan ke warga yang membutuhkan.`, 'success');
  };

  return (
    <div className="fade-in">
      <PageHeader
        title="Daftar Token Registrasi & Reset (Akses Operator)"
        subtitle="Lihat dan salin kode token resmi yang diterbitkan oleh Administrator untuk dibagikan kepada warga di loket."
        action={
          <Button
            variant="secondary"
            size="sm"
            icon={<RefreshCw size={14} className={refreshing ? 'spin-anim' : ''} />}
            onClick={() => fetchTokens(true)}
            disabled={refreshing}
          >
            Segarkan
          </Button>
        }
      />

      {/* Info Banner */}
      <div
        style={{
          padding: '12px 18px',
          borderRadius: 'var(--radius-md)',
          backgroundColor: 'var(--info-50)',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          marginBottom: 20,
          fontSize: 13,
          color: 'var(--info-700)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <Key size={18} />
        <span>
          <strong>Mode Lihat Saja (Read-Only):</strong> Petugas operator dapat melihat dan menyalin token aktif untuk membantu warga yang mendaftar atau lupa kata sandi di loket. Pembuatan/penghapusan token dikelola oleh Admin.
        </span>
      </div>

      {loading ? (
        <LoadingSpinner text="Memuat daftar token..." />
      ) : tokens.length === 0 ? (
        <EmptyState
          icon={<Key size={36} />}
          title="Tidak Ada Token Aktif"
          description="Saat ini belum ada token yang dibuat oleh administrator."
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
                <th>Salin</th>
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
                        <Key size={11} style={{ marginRight: 3 }} /> Aktif (Siap Pakai)
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
                      variant="secondary"
                      icon={<Copy size={13} />}
                      onClick={() => handleCopy(t.token)}
                    >
                      Salin Token
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
