import React, { useState, useEffect, useCallback } from 'react';
import { UserCheck, Plus, Clock, CheckCircle2, XCircle, Send, ArrowRight, ShieldCheck } from 'lucide-react';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { Select } from '../../components/common/Select';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { EmptyState } from '../../components/common/EmptyState';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { api } from '../../services/api';
import { SubscriptionRequest, Tariff, SubscriptionRequestStatus } from '../../types';
import { formatDateTime, formatRupiah } from '../../utils/formatters';

import { notifyDataUpdated } from '../../hooks/useNotificationCounts';

export const CustomerSubscriptionRequestPage: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [requests, setRequests] = useState<SubscriptionRequest[]>([]);
  const [tariffs, setTariffs] = useState<Tariff[]>([]);
  const [customerInfo, setCustomerInfo] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Form states
  const [requestedTariffId, setRequestedTariffId] = useState<string>('');
  const [reason, setReason] = useState<string>('');

  const fetchCustomerRequests = useCallback(async () => {
    if (!user?.customerId) return;
    try {
      setLoading(true);
      const [reqList, tariffList, custData] = await Promise.all([
        api.getSubscriptionRequests({ customer_id: user.customerId }),
        api.getTariffs(),
        api.getCustomerById(user.customerId)
      ]);
      setRequests(reqList);
      setTariffs(tariffList);
      setCustomerInfo(custData?.customer || user?.customer || null);
      if (tariffList.length > 0) {
        setRequestedTariffId(tariffList[0].id);
      }
    } catch (err: any) {
      showToast(err.message || 'Gagal memuat data permohonan', 'error');
    } finally {
      setLoading(false);
    }
  }, [user?.customerId, user?.customer, showToast]);

  useEffect(() => {
    fetchCustomerRequests();
  }, [fetchCustomerRequests]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      showToast('Alasan pengajuan wajib diisi', 'error');
      return;
    }

    const selectedTariff = tariffs.find((t) => t.id === requestedTariffId);
    if (!selectedTariff) {
      showToast('Silakan pilih golongan tarif tujuan', 'error');
      return;
    }

    try {
      setSubmitting(true);
      await api.createSubscriptionRequest({
        customer_id: user?.customerId,
        customer_name: user?.fullName || user?.username,
        customer_no: customerInfo?.customer_no || user?.username,
        phone: user?.phone || '',
        current_tariff_id: customerInfo?.tariff_id || 'TRF-01',
        current_tariff_name: customerInfo?.tariff_name || 'Rumah Tangga Standar',
        requested_tariff_id: selectedTariff.id,
        requested_tariff_name: selectedTariff.name,
        reason
      });
      showToast('Permohonan perubahan golongan berhasil dikirim!', 'success');
      setReason('');
      setModalOpen(false);
      fetchCustomerRequests();
      notifyDataUpdated();
    } catch (err: any) {
      showToast(err.message || 'Gagal mengirim permohonan', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: SubscriptionRequestStatus) => {
    switch (status) {
      case 'Disetujui':
        return <Badge variant="success"><CheckCircle2 size={12} style={{ marginRight: 3 }} /> Disetujui (Tarif Berubah)</Badge>;
      case 'Ditolak':
        return <Badge variant="danger"><XCircle size={12} style={{ marginRight: 3 }} /> Permohonan Ditolak</Badge>;
      default:
        return <Badge variant="warning"><Clock size={12} style={{ marginRight: 3 }} /> Sedang Ditinjau Pengelola</Badge>;
    }
  };

  return (
    <div className="fade-in">
      <PageHeader
        title="Pengajuan Perubahan Golongan Langganan"
        subtitle="Ajukan permohonan penyesuaian kategori tarif air jika terjadi perubahan peruntukan bangunan (misal: rumah tempat usaha/sosial)."
        action={
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => setModalOpen(true)}>
            Ajukan Pindah Golongan
          </Button>
        }
      />

      {/* Current Status Card */}
      <Card style={{ marginBottom: 24, backgroundColor: 'var(--primary-50)', borderColor: 'var(--primary-200)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--primary-800)', fontWeight: 600 }}>
              GOLONGAN TARIF AKTIF SAAT INI:
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--primary-900)', marginTop: 2 }}>
              {customerInfo?.tariff_name || 'Rumah Tangga Standar'}
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={() => setModalOpen(true)}>
            Minta Perubahan Tarif
          </Button>
        </div>
      </Card>

      {/* History Requests */}
      <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--slate-900)', marginBottom: 14 }}>
        Riwayat Pengajuan Anda
      </h3>

      {loading ? (
        <LoadingSpinner text="Memuat riwayat pengajuan..." />
      ) : requests.length === 0 ? (
        <EmptyState
          icon={<UserCheck size={36} />}
          title="Belum Ada Pengajuan"
          description="Anda belum pernah mengajukan permohonan perubahan golongan tarif langganan."
          action={
            <Button variant="primary" onClick={() => setModalOpen(true)}>
              Ajukan Sekarang
            </Button>
          }
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {requests.map((r) => (
            <Card key={r.id} className="hover-lift">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
                <div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary-700)', marginRight: 10 }}>
                    {r.request_no}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--slate-400)' }}>
                    {formatDateTime(r.created_at || '')}
                  </span>
                </div>
                <div>{getStatusBadge(r.status)}</div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
                <div>
                  <span style={{ fontSize: 11, color: 'var(--slate-500)' }}>Dari Golongan:</span>
                  <div style={{ fontWeight: 600, color: 'var(--slate-800)' }}>{r.current_tariff_name}</div>
                </div>
                <ArrowRight size={16} color="var(--primary-600)" />
                <div>
                  <span style={{ fontSize: 11, color: 'var(--slate-500)' }}>Menjadi:</span>
                  <div style={{ fontWeight: 700, color: 'var(--primary-700)' }}>{r.requested_tariff_name}</div>
                </div>
              </div>

              <div style={{ fontSize: 13, color: 'var(--slate-700)', lineHeight: 1.6 }}>
                <strong>Alasan Permohonan:</strong> {r.reason}
              </div>

              {/* Admin Note */}
              {r.response_notes && (
                <div
                  style={{
                    marginTop: 14,
                    padding: 12,
                    backgroundColor: r.status === 'Disetujui' ? 'var(--success-50)' : 'var(--danger-50)',
                    border: `1px solid ${r.status === 'Disetujui' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                    borderRadius: 'var(--radius-md)',
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--slate-800)', marginBottom: 2 }}>
                    Keterangan Pengelola:
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--slate-800)' }}>
                    {r.response_notes}
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Modal Form */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Formulir Pengajuan Pindah Golongan Tarif"
      >
        <form onSubmit={handleSubmit}>
          <div style={{ padding: 12, backgroundColor: 'var(--slate-50)', borderRadius: 'var(--radius-md)', marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: 'var(--slate-500)' }}>Golongan Anda Sekarang:</div>
            <div style={{ fontWeight: 700, color: 'var(--slate-900)' }}>
              {customerInfo?.tariff_name || 'Rumah Tangga Standar'}
            </div>
          </div>

          <Select
            label="Pilih Golongan Tarif Baru Yang Diinginkan"
            value={requestedTariffId}
            onChange={(e) => setRequestedTariffId(e.target.value)}
            options={tariffs.map((t) => ({
              value: t.id,
              label: `${t.name} (Beban: ${formatRupiah(t.base_fee)} / Pemakaian: ${formatRupiah(t.tier1_rate)}/m³)`
            }))}
            required
          />

          <div className="form-group" style={{ marginTop: 14 }}>
            <label className="form-label">
              Alasan Permohonan Penyesuaian <span className="required">*</span>
            </label>
            <textarea
              className="form-control"
              rows={4}
              placeholder="Contoh: Rumah mulai digunakan sebagai warung kelontong / Tempat ibadah musholla yang baru dibangun..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              style={{ resize: 'vertical' }}
            />
          </div>

          <div className="modal-footer" style={{ padding: '16px 0 0 0', marginTop: 20 }}>
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>
              Batal
            </Button>
            <Button variant="primary" type="submit" icon={<Send size={15} />} disabled={submitting}>
              {submitting ? 'Mengirim...' : 'Kirim Permohonan'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
