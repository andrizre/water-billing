import React, { useState, useEffect, useCallback } from 'react';
import { UserCheck, CheckCircle2, XCircle, Clock, AlertCircle, ArrowRight, ShieldCheck } from 'lucide-react';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { Select } from '../../components/common/Select';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { EmptyState } from '../../components/common/EmptyState';
import { DataTable } from '../../components/common/DataTable';
import { useToast } from '../../context/ToastContext';
import { api } from '../../services/api';
import { SubscriptionRequest, SubscriptionRequestStatus } from '../../types';
import { formatDateTime } from '../../utils/formatters';

export const SubscriptionRequestsPage: React.FC = () => {
  const { showToast } = useToast();
  const [requests, setRequests] = useState<SubscriptionRequest[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedStatus, setSelectedStatus] = useState<string>('');

  // Modal Action
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [activeRequest, setActiveRequest] = useState<SubscriptionRequest | null>(null);
  const [decision, setDecision] = useState<SubscriptionRequestStatus>('Disetujui');
  const [responseNotes, setResponseNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (selectedStatus) params.status = selectedStatus;
      const res = await api.getSubscriptionRequests(params);
      setRequests(res);
    } catch (err: any) {
      showToast(err.message || 'Gagal memuat pengajuan', 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedStatus, showToast]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleOpenDecision = (req: SubscriptionRequest) => {
    setActiveRequest(req);
    setDecision('Disetujui');
    setResponseNotes('');
    setModalOpen(true);
  };

  const handleSaveDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRequest) return;

    try {
      setSubmitting(true);
      await api.updateSubscriptionRequestStatus(activeRequest.id, decision, responseNotes);
      showToast(
        decision === 'Disetujui'
          ? 'Pengajuan disetujui! Golongan tarif pelanggan berhasil diperbarui.'
          : 'Pengajuan telah ditolak.',
        'success'
      );
      setModalOpen(false);
      fetchRequests();
    } catch (err: any) {
      showToast(err.message || 'Gagal memproses pengajuan', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: SubscriptionRequestStatus) => {
    switch (status) {
      case 'Disetujui':
        return <Badge variant="success"><CheckCircle2 size={12} style={{ marginRight: 3 }} /> Disetujui</Badge>;
      case 'Ditolak':
        return <Badge variant="danger"><XCircle size={12} style={{ marginRight: 3 }} /> Ditolak</Badge>;
      default:
        return <Badge variant="warning"><Clock size={12} style={{ marginRight: 3 }} /> Menunggu Verifikasi</Badge>;
    }
  };

  return (
    <div className="fade-in">
      <PageHeader
        title="Pengajuan Perubahan Golongan Langganan"
        subtitle="Verifikasi dan setujui permohonan warga yang ingin pindah golongan tarif (Rumah Tangga / Niaga / Sosial)."
      />

      {/* Filter */}
      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Select
            label=""
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            options={[
              { value: '', label: 'Semua Status Pengajuan' },
              { value: 'Menunggu', label: 'Menunggu Persetujuan' },
              { value: 'Disetujui', label: 'Disetujui' },
              { value: 'Ditolak', label: 'Ditolak' },
            ]}
          />
        </div>
      </Card>

      <Card title="Daftar Pengajuan Perubahan Golongan">
        <DataTable
          columns={[
            {
              header: 'No. Pengajuan',
              render: (r: SubscriptionRequest) => <span style={{ fontWeight: 700, color: 'var(--primary-700)' }}>{r.request_no}</span>
            },
            {
              header: 'Tanggal',
              render: (r: SubscriptionRequest) => formatDateTime(r.created_at || '')
            },
            {
              header: 'Nama Pelanggan',
              render: (r: SubscriptionRequest) => (
                <div>
                  <div style={{ fontWeight: 600 }}>{r.customer_name}</div>
                  <div style={{ fontSize: 11, color: 'var(--slate-500)' }}>
                    {r.customer_no} {r.phone ? `• ${r.phone}` : ''}
                  </div>
                </div>
              )
            },
            {
              header: 'Golongan Saat Ini',
              render: (r: SubscriptionRequest) => (
                <Badge variant="neutral">{r.current_tariff_name}</Badge>
              )
            },
            {
              header: 'Diajukan Ke',
              render: (r: SubscriptionRequest) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <ArrowRight size={13} color="var(--primary-600)" />
                  <Badge variant="info">{r.requested_tariff_name}</Badge>
                </div>
              )
            },
            {
              header: 'Alasan Permohonan',
              render: (r: SubscriptionRequest) => (
                <div style={{ fontSize: 13, color: 'var(--slate-700)', maxWidth: 260 }}>
                  {r.reason}
                </div>
              )
            },
            {
              header: 'Status',
              render: (r: SubscriptionRequest) => getStatusBadge(r.status)
            },
            {
              header: 'Aksi',
              align: 'right' as const,
              render: (r: SubscriptionRequest) => (
                r.status === 'Menunggu' ? (
                  <Button
                    size="sm"
                    variant="primary"
                    icon={<ShieldCheck size={13} />}
                    onClick={() => handleOpenDecision(r)}
                  >
                    Proses
                  </Button>
                ) : (
                  <span style={{ fontSize: 12, color: 'var(--slate-400)' }}>Selesai</span>
                )
              )
            }
          ]}
          data={requests}
          loading={loading}
          emptyTitle="Tidak Ada Pengajuan"
          emptyMessage="Belum ada permohonan perubahan golongan dari pelanggan."
        />
      </Card>

      {/* Decision Modal */}
      {activeRequest && (
        <Modal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          title={`Verifikasi Pengajuan: ${activeRequest.request_no}`}
        >
          <form onSubmit={handleSaveDecision}>
            <div style={{ padding: 14, backgroundColor: 'var(--slate-50)', borderRadius: 'var(--radius-md)', marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: 'var(--slate-500)' }}>Pemohon:</div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{activeRequest.customer_name} ({activeRequest.customer_no})</div>
              {activeRequest.phone && <div style={{ fontSize: 12, color: 'var(--slate-600)' }}>No. HP: {activeRequest.phone}</div>}

              <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <div>
                  <span style={{ fontSize: 11, color: 'var(--slate-500)' }}>Golongan Saat Ini:</span>
                  <div style={{ fontWeight: 600, color: 'var(--slate-800)' }}>{activeRequest.current_tariff_name}</div>
                </div>
                <ArrowRight size={16} color="var(--primary-600)" />
                <div>
                  <span style={{ fontSize: 11, color: 'var(--slate-500)' }}>Golongan Baru Yang Diminta:</span>
                  <div style={{ fontWeight: 700, color: 'var(--primary-700)' }}>{activeRequest.requested_tariff_name}</div>
                </div>
              </div>

              <div style={{ marginTop: 12, fontSize: 12, color: 'var(--slate-500)' }}>Alasan:</div>
              <div style={{ fontSize: 13, color: 'var(--slate-800)', marginTop: 2 }}>{activeRequest.reason}</div>
            </div>

            <Select
              label="Keputusan Verifikasi"
              value={decision}
              onChange={(e) => setDecision(e.target.value as any)}
              options={[
                { value: 'Disetujui', label: 'Disetujui (Otomatis Ubah Tarif Pelanggan)' },
                { value: 'Ditolak', label: 'Ditolak (Permohonan Tidak Memenuhi Syarat)' },
              ]}
              required
            />

            <div className="form-group" style={{ marginTop: 14 }}>
              <label className="form-label">Catatan Tambahan / Keterangan Persetujuan</label>
              <textarea
                className="form-control"
                rows={3}
                placeholder="Contoh: Telah disurvei petugas lapangan dan sesuai dengan peruntukan niaga..."
                value={responseNotes}
                onChange={(e) => setResponseNotes(e.target.value)}
                style={{ resize: 'vertical' }}
              />
            </div>

            <div className="modal-footer" style={{ padding: '16px 0 0 0', marginTop: 20 }}>
              <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>
                Batal
              </Button>
              <Button
                variant={decision === 'Disetujui' ? 'success' : 'danger'}
                type="submit"
                icon={<CheckCircle2 size={15} />}
                disabled={submitting}
              >
                {submitting ? 'Memproses...' : `Konfirmasi ${decision}`}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
