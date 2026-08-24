import React, { useState, useEffect, useCallback } from 'react';
import { MessageSquarePlus, Plus, Clock, CheckCircle2, XCircle, Send, MessageSquareWarning } from 'lucide-react';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { EmptyState } from '../../components/common/EmptyState';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { api } from '../../services/api';
import { Complaint, ComplaintCategory, ComplaintStatus } from '../../types';
import { formatDateTime } from '../../utils/formatters';

import { notifyDataUpdated } from '../../hooks/useNotificationCounts';

export const CustomerComplaintsPage: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Form states
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ComplaintCategory>('air_mati');
  const [description, setDescription] = useState('');

  const fetchCustomerComplaints = useCallback(async () => {
    if (!user?.customerId) return;
    try {
      setLoading(true);
      const res = await api.getComplaints({ customer_id: user.customerId });
      setComplaints(res);
    } catch (err: any) {
      showToast(err.message || 'Gagal memuat riwayat pengaduan', 'error');
    } finally {
      setLoading(false);
    }
  }, [user?.customerId, showToast]);

  useEffect(() => {
    fetchCustomerComplaints();
  }, [fetchCustomerComplaints]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      showToast('Judul dan rincian keluhan wajib diisi', 'error');
      return;
    }

    try {
      setSubmitting(true);
      await api.createComplaint({
        customer_id: user?.customerId,
        customer_name: user?.fullName || user?.username,
        customer_no: user?.customer?.customer_no || user?.username,
        phone: user?.phone || '',
        title,
        category,
        description
      });
      showToast('Laporan pengaduan berhasil dikirim ke pengelola air desa!', 'success');
      setTitle('');
      setDescription('');
      setCategory('air_mati');
      setModalOpen(false);
      fetchCustomerComplaints();
      notifyDataUpdated();
    } catch (err: any) {
      showToast(err.message || 'Gagal mengirim pengaduan', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const getCategoryLabel = (cat: ComplaintCategory) => {
    const map: Record<string, string> = {
      pipa_bocor: 'Pipa Bocor',
      air_mati: 'Air Mati / Aliran Kecil',
      meter_rusak: 'Meteran Rusak / Buram',
      tagihan_salah: 'Ketidaksesuaian Tagihan',
      kualitas_air: 'Kualitas Air Keruh/Bau',
      lainnya: 'Lainnya',
    };
    return map[cat] || cat;
  };

  const getStatusBadge = (status: ComplaintStatus) => {
    switch (status) {
      case 'Selesai':
        return <Badge variant="success"><CheckCircle2 size={12} style={{ marginRight: 3 }} /> Selesai Diperbaiki</Badge>;
      case 'Diproses':
        return <Badge variant="info"><Clock size={12} style={{ marginRight: 3 }} /> Petugas Sedang Menangani</Badge>;
      case 'Ditolak':
        return <Badge variant="danger"><XCircle size={12} style={{ marginRight: 3 }} /> Ditolak</Badge>;
      default:
        return <Badge variant="warning"><Clock size={12} style={{ marginRight: 3 }} /> Menunggu Tindak Lanjut</Badge>;
    }
  };

  return (
    <div className="fade-in">
      <PageHeader
        title="Layanan Pengaduan & Bantuan Pelanggan"
        subtitle="Laporkan kendala aliran air, pipa bocor, kerusakan meter, atau ketidaksesuaian tagihan langsung ke petugas."
        action={
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => setModalOpen(true)}>
            Kirim Keluhan Baru
          </Button>
        }
      />

      {loading ? (
        <LoadingSpinner text="Memuat riwayat keluhan Anda..." />
      ) : complaints.length === 0 ? (
        <EmptyState
          icon={<MessageSquareWarning size={36} />}
          title="Belum Ada Pengaduan"
          description="Jika mengalami kendala pasokan air, silakan kirimkan laporan kepada kami."
          action={
            <Button variant="primary" onClick={() => setModalOpen(true)}>
              Buat Laporan Sekarang
            </Button>
          }
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {complaints.map((c) => (
            <Card key={c.id} className="hover-lift">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 10 }}>
                <div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary-700)', marginRight: 10 }}>
                    {c.complaint_no}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--slate-400)' }}>
                    {formatDateTime(c.created_at || '')}
                  </span>
                </div>
                <div>{getStatusBadge(c.status)}</div>
              </div>

              <div style={{ display: 'inline-block', marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, backgroundColor: 'var(--slate-100)', color: 'var(--slate-700)', padding: '2px 8px', borderRadius: 4 }}>
                  Kategori: {getCategoryLabel(c.category)}
                </span>
              </div>

              <h4 style={{ fontSize: 16, fontWeight: 700, color: 'var(--slate-900)', marginBottom: 6 }}>
                {c.title}
              </h4>
              <p style={{ fontSize: 13.5, color: 'var(--slate-700)', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
                {c.description}
              </p>

              {/* Response from admin/operator if any */}
              {c.response_notes && (
                <div
                  style={{
                    marginTop: 14,
                    padding: 12,
                    backgroundColor: 'var(--primary-50)',
                    border: '1px solid var(--primary-200)',
                    borderRadius: 'var(--radius-md)',
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary-800)', marginBottom: 4 }}>
                    Tanggapan Petugas ({c.handled_by || 'Pengelola'}):
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--primary-900)', lineHeight: 1.5 }}>
                    {c.response_notes}
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Modal Form New Complaint */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Formulir Laporan / Keluhan Pelanggan"
      >
        <form onSubmit={handleSubmit}>
          <Select
            label="Kategori Kendala"
            value={category}
            onChange={(e) => setCategory(e.target.value as any)}
            options={[
              { value: 'air_mati', label: 'Air Mati / Aliran Sangat Kecil' },
              { value: 'pipa_bocor', label: 'Pipa Bocor di Sekitar Rumah/Jalan' },
              { value: 'meter_rusak', label: 'Meteran Air Pecah / Angka Buram' },
              { value: 'tagihan_salah', label: 'Ketidaksesuaian Jumlah Tagihan' },
              { value: 'kualitas_air', label: 'Kualitas Air Keruh / Berbau' },
              { value: 'lainnya', label: 'Lainnya' },
            ]}
            required
          />

          <Input
            label="Judul Singkat Keluhan"
            placeholder="Contoh: Pipa depan pagar bocor / Kran tidak mengalir"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />

          <div className="form-group">
            <label className="form-label">
              Rincian & Lokasi Kendala <span className="required">*</span>
            </label>
            <textarea
              className="form-control"
              rows={4}
              placeholder="Jelaskan secara detail kendala yang dialami, sejak kapan, dan patokan lokasi..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              style={{ resize: 'vertical' }}
            />
          </div>

          <div className="modal-footer" style={{ padding: '16px 0 0 0', marginTop: 20 }}>
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>
              Batal
            </Button>
            <Button variant="primary" type="submit" icon={<Send size={15} />} disabled={submitting}>
              {submitting ? 'Mengirim...' : 'Kirim Laporan Pengaduan'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
