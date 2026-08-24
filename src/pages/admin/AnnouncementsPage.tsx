import React, { useState, useEffect, useCallback } from 'react';
import { Megaphone, Plus, Trash2, Edit3, Send, AlertTriangle, Users, Wrench, UserCheck } from 'lucide-react';
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
import { Announcement } from '../../types';
import { formatDateTime } from '../../utils/formatters';

export const AnnouncementsPage: React.FC = () => {
  const { showToast } = useToast();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<Announcement | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Form states
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [targetAudience, setTargetAudience] = useState<'all' | 'operator' | 'customer'>('all');
  const [priority, setPriority] = useState<'normal' | 'urgent'>('normal');

  const fetchAnnouncements = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.getAnnouncements();
      setAnnouncements(res);
    } catch (err: any) {
      showToast(err.message || 'Gagal memuat pengumuman', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  const handleOpenCreate = () => {
    setEditingItem(null);
    setTitle('');
    setContent('');
    setTargetAudience('all');
    setPriority('normal');
    setModalOpen(true);
  };

  const handleOpenEdit = (item: Announcement) => {
    setEditingItem(item);
    setTitle(item.title);
    setContent(item.content);
    setTargetAudience(item.target_audience);
    setPriority(item.priority);
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      showToast('Judul dan isi pengumuman wajib diisi', 'error');
      return;
    }

    try {
      setSubmitting(true);
      if (editingItem) {
        await api.updateAnnouncement({
          id: editingItem.id,
          title,
          content,
          target_audience: targetAudience,
          priority
        });
        showToast('Pengumuman berhasil diperbarui', 'success');
      } else {
        await api.createAnnouncement({
          title,
          content,
          target_audience: targetAudience,
          priority
        });
        showToast('Pengumuman / broadcast berhasil dikirim!', 'success');
      }
      setModalOpen(false);
      fetchAnnouncements();
    } catch (err: any) {
      showToast(err.message || 'Gagal menyimpan pengumuman', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Yakin ingin menghapus pengumuman ini?')) return;
    try {
      await api.deleteAnnouncement(id);
      showToast('Pengumuman dihapus', 'success');
      fetchAnnouncements();
    } catch (err: any) {
      showToast(err.message || 'Gagal menghapus', 'error');
    }
  };

  const getAudienceBadge = (target: string) => {
    switch (target) {
      case 'operator':
        return (
          <Badge variant="info">
            <Wrench size={11} style={{ marginRight: 3 }} /> Khusus Operator
          </Badge>
        );
      case 'customer':
        return (
          <Badge variant="success">
            <Users size={11} style={{ marginRight: 3 }} /> Khusus Warga / Pelanggan
          </Badge>
        );
      default:
        return (
          <Badge variant="neutral">
            <UserCheck size={11} style={{ marginRight: 3 }} /> Semua Pengguna
          </Badge>
        );
    }
  };

  return (
    <div className="fade-in">
      <PageHeader
        title="Pengumuman & Siaran Informasi (Broadcast)"
        subtitle="Kirim informasi penting, jadwal pemeliharaan pipa, atau pengingat tagihan ke operator dan pelanggan."
        action={
          <Button variant="primary" icon={<Plus size={16} />} onClick={handleOpenCreate}>
            Buat Pengumuman Baru
          </Button>
        }
      />

      {loading ? (
        <LoadingSpinner text="Memuat daftar pengumuman..." />
      ) : announcements.length === 0 ? (
        <EmptyState
          icon={<Megaphone size={36} />}
          title="Belum Ada Pengumuman"
          description="Buat pengumuman pertama Anda untuk disiarkan ke operator atau warga desa."
          action={
            <Button variant="primary" onClick={handleOpenCreate}>
              Buat Pengumuman
            </Button>
          }
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {announcements.map((a) => (
            <Card key={a.id} className="hover-lift">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
                <div style={{ flex: 1, minWidth: 260 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                    {a.priority === 'urgent' && (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          fontSize: 11,
                          fontWeight: 700,
                          backgroundColor: 'var(--danger-50)',
                          color: 'var(--danger-700)',
                          padding: '3px 8px',
                          borderRadius: 4,
                          border: '1px solid rgba(239,68,68,0.3)',
                        }}
                      >
                        <AlertTriangle size={12} /> PENTING / DARURAT
                      </span>
                    )}
                    {getAudienceBadge(a.target_audience)}
                    <span style={{ fontSize: 12, color: 'var(--slate-400)' }}>
                      Diterbitkan: {formatDateTime(a.created_at || '')}
                    </span>
                  </div>

                  <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--slate-900)', marginBottom: 8 }}>
                    {a.title}
                  </h3>

                  <p style={{ fontSize: 14, color: 'var(--slate-700)', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
                    {a.content}
                  </p>
                </div>

                <div style={{ display: 'flex', gap: 6 }}>
                  <Button size="sm" variant="secondary" icon={<Edit3 size={13} />} onClick={() => handleOpenEdit(a)}>
                    Edit
                  </Button>
                  <Button size="sm" variant="danger" icon={<Trash2 size={13} />} onClick={() => handleDelete(a.id)}>
                    Hapus
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Modal Create/Edit Announcement */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingItem ? 'Edit Pengumuman' : 'Buat Pengumuman / Broadcast Baru'}
      >
        <form onSubmit={handleSubmit}>
          <Input
            label="Judul Pengumuman"
            placeholder="Contoh: Jadwal Pemadaman Aliran Air / Pengingat Batas Pembayaran"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />

          <div className="form-group">
            <label className="form-label">
              Isi Pengumuman / Pesan Siaran <span className="required">*</span>
            </label>
            <textarea
              className="form-control"
              rows={5}
              placeholder="Tuliskan detail informasi yang ingin disampaikan..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
              style={{ resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Select
              label="Target Penerima (Audiens)"
              value={targetAudience}
              onChange={(e) => setTargetAudience(e.target.value as any)}
              options={[
                { value: 'all', label: 'Semua (Operator & Warga)' },
                { value: 'customer', label: 'Khusus Warga / Pelanggan' },
                { value: 'operator', label: 'Khusus Petugas Operator' },
              ]}
            />

            <Select
              label="Tingkat Prioritas"
              value={priority}
              onChange={(e) => setPriority(e.target.value as any)}
              options={[
                { value: 'normal', label: 'Normal (Informasi Biasa)' },
                { value: 'urgent', label: 'Penting / Darurat (Banner Merah)' },
              ]}
            />
          </div>

          <div className="modal-footer" style={{ padding: '16px 0 0 0', marginTop: 20 }}>
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>
              Batal
            </Button>
            <Button variant="primary" type="submit" icon={<Send size={15} />} disabled={submitting}>
              {submitting ? 'Mengirim...' : editingItem ? 'Simpan Perubahan' : 'Siarkan Pengumuman'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
