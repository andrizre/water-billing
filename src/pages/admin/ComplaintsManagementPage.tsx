import React, { useState, useEffect, useCallback } from 'react';
import { MessageSquareWarning, Filter, CheckCircle2, Clock, XCircle, Search, MessageSquare, Send } from 'lucide-react';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { Select } from '../../components/common/Select';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { EmptyState } from '../../components/common/EmptyState';
import { useToast } from '../../context/ToastContext';
import { api } from '../../services/api';
import { Complaint, ComplaintCategory, ComplaintStatus } from '../../types';
import { formatDateTime } from '../../utils/formatters';

export const ComplaintsManagementPage: React.FC = () => {
  const { showToast } = useToast();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modal response
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [activeComplaint, setActiveComplaint] = useState<Complaint | null>(null);
  const [responseStatus, setResponseStatus] = useState<ComplaintStatus>('Diproses');
  const [responseNotes, setResponseNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  const fetchComplaints = useCallback(async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (selectedStatus) params.status = selectedStatus;
      if (selectedCategory) params.category = selectedCategory;
      if (searchQuery) params.search = searchQuery;
      const res = await api.getComplaints(params);
      setComplaints(res);
    } catch (err: any) {
      showToast(err.message || 'Gagal memuat keluhan', 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedStatus, selectedCategory, searchQuery, showToast]);

  useEffect(() => {
    fetchComplaints();
  }, [fetchComplaints]);

  const handleOpenResponseModal = (complaint: Complaint) => {
    setActiveComplaint(complaint);
    setResponseStatus(complaint.status === 'Menunggu' ? 'Diproses' : complaint.status);
    setResponseNotes(complaint.response_notes || '');
    setModalOpen(true);
  };

  const handleSaveResponse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeComplaint) return;

    try {
      setSubmitting(true);
      await api.updateComplaintStatus(activeComplaint.id, responseStatus, responseNotes);
      showToast('Status keluhan & catatan tanggapan berhasil disimpan', 'success');
      setModalOpen(false);
      fetchComplaints();
    } catch (err: any) {
      showToast(err.message || 'Gagal menyimpan tanggapan', 'error');
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
        return <Badge variant="success"><CheckCircle2 size={12} style={{ marginRight: 3 }} /> Selesai</Badge>;
      case 'Diproses':
        return <Badge variant="info"><Clock size={12} style={{ marginRight: 3 }} /> Sedang Diproses</Badge>;
      case 'Ditolak':
        return <Badge variant="danger"><XCircle size={12} style={{ marginRight: 3 }} /> Ditolak</Badge>;
      default:
        return <Badge variant="warning"><Clock size={12} style={{ marginRight: 3 }} /> Menunggu Tindak Lanjut</Badge>;
    }
  };

  return (
    <div className="fade-in">
      <PageHeader
        title="Layanan Pengaduan & Keluhan Pelanggan"
        subtitle="Kelola laporan pipa bocor, kerusakan meter air, gangguan aliran, dan keluhan warga desa."
      />

      {/* Filter Bar */}
      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
          <div className="search-input-wrapper">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              className="form-control"
              placeholder="Cari no. laporan, warga, judul..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <Select
            label=""
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            options={[
              { value: '', label: 'Semua Status' },
              { value: 'Menunggu', label: 'Menunggu' },
              { value: 'Diproses', label: 'Sedang Diproses' },
              { value: 'Selesai', label: 'Selesai' },
              { value: 'Ditolak', label: 'Ditolak' },
            ]}
          />

          <Select
            label=""
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            options={[
              { value: '', label: 'Semua Kategori' },
              { value: 'air_mati', label: 'Air Mati / Aliran Kecil' },
              { value: 'pipa_bocor', label: 'Pipa Bocor' },
              { value: 'meter_rusak', label: 'Meteran Rusak' },
              { value: 'tagihan_salah', label: 'Ketidaksesuaian Tagihan' },
              { value: 'kualitas_air', label: 'Kualitas Air' },
              { value: 'lainnya', label: 'Lainnya' },
            ]}
          />
        </div>
      </Card>

      {loading ? (
        <LoadingSpinner text="Memuat data pengaduan..." />
      ) : complaints.length === 0 ? (
        <EmptyState
          icon={<MessageSquareWarning size={36} />}
          title="Tidak Ada Pengaduan"
          description="Belum ada keluhan yang masuk dari pelanggan."
        />
      ) : (
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>No. Laporan</th>
                <th>Tanggal</th>
                <th>Nama Pelanggan</th>
                <th>Kategori</th>
                <th>Judul Keluhan</th>
                <th>Status</th>
                <th>Ditangani Oleh</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {complaints.map((c) => (
                <tr key={c.id} className="row-hover-highlight">
                  <td style={{ fontWeight: 700 }}>{c.complaint_no}</td>
                  <td>{formatDateTime(c.created_at || '')}</td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{c.customer_name}</div>
                    <div style={{ fontSize: 11, color: 'var(--slate-500)' }}>
                      {c.customer_no} {c.phone ? `• ${c.phone}` : ''}
                    </div>
                  </td>
                  <td>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--slate-700)' }}>
                      {getCategoryLabel(c.category)}
                    </span>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--slate-900)' }}>{c.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--slate-500)', maxWidth: 280, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {c.description}
                    </div>
                  </td>
                  <td>{getStatusBadge(c.status)}</td>
                  <td>
                    {c.handled_by ? (
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--slate-700)' }}>{c.handled_by}</span>
                    ) : (
                      <span style={{ fontSize: 12, color: 'var(--slate-400)' }}>-</span>
                    )}
                  </td>
                  <td>
                    <Button
                      size="sm"
                      variant="primary"
                      icon={<MessageSquare size={13} />}
                      onClick={() => handleOpenResponseModal(c)}
                    >
                      Tindak Lanjut
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Response / Follow-up Modal */}
      {activeComplaint && (
        <Modal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          title={`Tindak Lanjut Pengaduan: ${activeComplaint.complaint_no}`}
        >
          <form onSubmit={handleSaveResponse}>
            <div style={{ padding: 14, backgroundColor: 'var(--slate-50)', borderRadius: 'var(--radius-md)', marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: 'var(--slate-500)' }}>Pelapor:</div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{activeComplaint.customer_name} ({activeComplaint.customer_no})</div>
              {activeComplaint.phone && <div style={{ fontSize: 12, color: 'var(--slate-600)' }}>No. HP/WA: {activeComplaint.phone}</div>}

              <div style={{ marginTop: 10, fontSize: 12, color: 'var(--slate-500)' }}>Rincian Keluhan:</div>
              <div style={{ fontWeight: 600, color: 'var(--slate-900)' }}>{activeComplaint.title}</div>
              <div style={{ fontSize: 13, color: 'var(--slate-700)', marginTop: 4, whiteSpace: 'pre-line' }}>
                {activeComplaint.description}
              </div>
            </div>

            <Select
              label="Ubah Status Pengaduan"
              value={responseStatus}
              onChange={(e) => setResponseStatus(e.target.value as any)}
              options={[
                { value: 'Menunggu', label: 'Menunggu' },
                { value: 'Diproses', label: 'Sedang Diproses (Petugas Ditugaskan)' },
                { value: 'Selesai', label: 'Selesai (Sudah Diperbaiki / Terselesaikan)' },
                { value: 'Ditolak', label: 'Ditolak (Tidak Valid / Diluar Wewenang)' },
              ]}
              required
            />

            <div className="form-group" style={{ marginTop: 14 }}>
              <label className="form-label">Catatan Tanggapan / Tindakan Petugas</label>
              <textarea
                className="form-control"
                rows={4}
                placeholder="Contoh: Petugas Budi telah memperbaiki kebocoran pipa di depan rumah warga pada tanggal 22/08/2026..."
                value={responseNotes}
                onChange={(e) => setResponseNotes(e.target.value)}
                style={{ resize: 'vertical' }}
              />
            </div>

            <div className="modal-footer" style={{ padding: '16px 0 0 0', marginTop: 20 }}>
              <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>
                Batal
              </Button>
              <Button variant="primary" type="submit" icon={<Send size={15} />} disabled={submitting}>
                {submitting ? 'Menyimpan...' : 'Simpan Tanggapan'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
