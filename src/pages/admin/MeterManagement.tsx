import React, { useState, useEffect, useCallback } from 'react';
import {
  Gauge,
  Plus,
  Search,
  Edit2,
  Trash2,
  Calendar,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { DataTable } from '../../components/common/DataTable';
import { Pagination } from '../../components/common/Pagination';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { useDebounce } from '../../hooks/useDebounce';
import { usePagination } from '../../hooks/usePagination';
import { useToast } from '../../context/ToastContext';
import { api } from '../../services/api';
import { WaterMeter, Customer } from '../../types';
import { formatM3, formatDate, todayLocalISO } from '../../utils/formatters';

export const MeterManagement: React.FC = () => {
  const [meters, setMeters] = useState<WaterMeter[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [editingMeter, setEditingMeter] = useState<WaterMeter | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<WaterMeter | null>(null);
  const [saving, setSaving] = useState<boolean>(false);

  const [formData, setFormData] = useState({
    meter_no: '',
    customer_id: '',
    brand: 'Onda SNI 1/2"',
    installation_date: todayLocalISO(),
    initial_reading: '0',
    current_reading: '0',
    status: 'Aktif' as any
  });

  const debouncedSearch = useDebounce(search, 300);
  const { success, error: toastError } = useToast();

  const fetchCustomers = useCallback(async () => {
    try {
      const data = await api.getCustomers();
      setCustomers(data);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const fetchMeters = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getMeters({
        search: debouncedSearch,
        status: statusFilter
      });
      setMeters(data);
    } catch (err: any) {
      toastError(err.message || 'Gagal memuat data meter air.');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, statusFilter, toastError]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  useEffect(() => {
    fetchMeters();
  }, [fetchMeters]);

  const pagination = usePagination(meters, { initialPageSize: 10 });

  const handleOpenCreate = () => {
    setEditingMeter(null);
    setFormData({
      meter_no: '',
      customer_id: '',
      brand: 'Onda SNI 1/2"',
      installation_date: todayLocalISO(),
      initial_reading: '0',
      current_reading: '0',
      status: 'Aktif'
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (m: WaterMeter) => {
    setEditingMeter(m);
    setFormData({
      meter_no: m.meter_no,
      customer_id: m.customer_id || '',
      brand: m.brand || 'Onda SNI 1/2"',
      installation_date: m.installation_date || new Date().toISOString().substring(0, 10),
      initial_reading: String(m.initial_reading || 0),
      current_reading: String(m.current_reading || 0),
      status: m.status || 'Aktif'
    });
    setModalOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.meter_no.trim()) {
      toastError('Nomor meter air wajib diisi.');
      return;
    }

    setSaving(true);
    try {
      if (editingMeter) {
        await api.updateMeter({
          id: editingMeter.id,
          meter_no: formData.meter_no,
          customer_id: formData.customer_id,
          brand: formData.brand,
          installation_date: formData.installation_date,
          initial_reading: Number(formData.initial_reading),
          current_reading: Number(formData.current_reading),
          status: formData.status
        });
        success('Data meter air berhasil diperbarui.');
      } else {
        await api.createMeter({
          meter_no: formData.meter_no,
          customer_id: formData.customer_id,
          brand: formData.brand,
          installation_date: formData.installation_date,
          initial_reading: Number(formData.initial_reading),
          current_reading: Number(formData.current_reading),
          status: formData.status
        });
        success('Meter air baru berhasil ditambahkan.');
      }
      setModalOpen(false);
      fetchMeters();
    } catch (err: any) {
      toastError(err.message || 'Gagal menyimpan meter.');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await api.deleteMeter(deleteTarget.id);
      success('Meter air berhasil dihapus.');
      setDeleteTarget(null);
      fetchMeters();
    } catch (err: any) {
      toastError(err.message || 'Gagal menghapus meter.');
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    {
      header: 'Nomor Meter',
      render: (m: WaterMeter) => (
        <div>
          <span style={{ fontWeight: 800, color: 'var(--slate-900)', fontSize: 14 }}>
            {m.meter_no}
          </span>
          <div style={{ fontSize: 11, color: 'var(--slate-500)' }}>Merek: {m.brand || 'Standar'}</div>
        </div>
      )
    },
    {
      header: 'Tertaut Pelanggan',
      render: (m: WaterMeter) => (
        <div>
          <div style={{ fontWeight: 700, color: 'var(--primary-800)' }}>
            {m.customer_name || 'Belum Ditautkan'}
          </div>
          {m.customer_no && (
            <div style={{ fontSize: 11, color: 'var(--slate-500)' }}>ID: {m.customer_no}</div>
          )}
        </div>
      )
    },
    {
      header: 'Angka Meter Terakhir',
      render: (m: WaterMeter) => (
        <div>
          <span style={{ fontWeight: 800, color: 'var(--primary-700)', fontSize: 14 }}>
            {formatM3(m.current_reading)}
          </span>
          <div style={{ fontSize: 11, color: 'var(--slate-500)' }}>
            Awal pasang: {formatM3(m.initial_reading)}
          </div>
        </div>
      )
    },
    {
      header: 'Tgl Pasang',
      render: (m: WaterMeter) => (
        <span style={{ fontSize: 13, color: 'var(--slate-600)' }}>
          {formatDate(m.installation_date)}
        </span>
      )
    },
    {
      header: 'Status',
      render: (m: WaterMeter) => <Badge status={m.status} />
    },
    {
      header: 'Aksi',
      align: 'right' as const,
      render: (m: WaterMeter) => (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
          <Button
            size="sm"
            variant="secondary"
            icon={<Edit2 size={13} />}
            onClick={() => handleOpenEdit(m)}
            aria-label="Edit"
          >
            Edit
          </Button>
          <Button
            size="sm"
            variant="danger"
            icon={<Trash2 size={13} />}
            onClick={() => setDeleteTarget(m)}
            aria-label="Hapus"
          >
            Hapus
          </Button>
        </div>
      )
    }
  ];

  return (
    <div>
      <PageHeader
        title="Manajemen Meter Air"
        subtitle="Inventaris nomor meteran fisik, histori kalibrasi, angka kubikasi saat ini, dan kondisi fisik."
        action={
          <Button variant="primary" icon={<Plus size={16} />} onClick={handleOpenCreate}>
            Tambah Meter Air
          </Button>
        }
      />

      {/* Filter Bar */}
      <Card bodyClassName="p-4" style={{ marginBottom: 20 }}>
        <div className="filter-bar" style={{ margin: 0 }}>
          <div className="filter-group" style={{ flex: 1, minWidth: 260 }}>
            <div style={{ width: '100%', maxWidth: 360 }}>
              <Input
                placeholder="Cari nomor meter atau nama pemilik..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                leftIcon={<Search size={16} />}
              />
            </div>
          </div>

          <div className="filter-group">
            <div style={{ width: 160 }}>
              <Select
                options={[
                  { label: 'Semua Status', value: '' },
                  { label: 'Aktif', value: 'Aktif' },
                  { label: 'Rusak', value: 'Rusak' },
                  { label: 'Diganti', value: 'Diganti' },
                  { label: 'Nonaktif', value: 'Nonaktif' }
                ]}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card>
        <DataTable
          columns={columns}
          data={pagination.paginatedItems}
          loading={loading}
          emptyTitle="Belum Ada Meter Air"
          emptyMessage="Data meter air belum tersedia."
        />
        <Pagination
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          totalItems={pagination.totalItems}
          pageSize={pagination.pageSize}
          onPageChange={pagination.goToPage}
        />
      </Card>

      {/* Modal Form */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        size="md"
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Gauge size={20} color="var(--primary-600)" />
            <span>{editingMeter ? 'Edit Meter Air' : 'Tambah Meter Air Baru'}</span>
          </div>
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)} disabled={saving}>
              Batal
            </Button>
            <Button variant="primary" onClick={handleFormSubmit} loading={saving}>
              Simpan Data Meter
            </Button>
          </>
        }
      >
        <form onSubmit={handleFormSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Input
              label="Nomor Seri Meter"
              placeholder="Contoh: MTR-8815"
              value={formData.meter_no}
              onChange={(e) => setFormData({ ...formData, meter_no: e.target.value })}
              required
            />
            <Input
              label="Merek & Tipe Meter"
              placeholder="Contoh: Onda SNI 1/2 inch"
              value={formData.brand}
              onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
            />
          </div>

          <Select
            label="Tautkan ke Pelanggan"
            options={[
              { label: '-- Belum Ditautkan (Stok Gudang) --', value: '' },
              ...customers.map((c) => ({
                label: `${c.customer_no} - ${c.full_name} (${c.rt_rw})`,
                value: c.id
              }))
            ]}
            value={formData.customer_id}
            onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Input
              type="date"
              label="Tanggal Pemasangan"
              value={formData.installation_date}
              onChange={(e) => setFormData({ ...formData, installation_date: e.target.value })}
            />
            <Select
              label="Kondisi / Status"
              options={[
                { label: 'Aktif (Normal)', value: 'Aktif' },
                { label: 'Rusak', value: 'Rusak' },
                { label: 'Diganti Baru', value: 'Diganti' },
                { label: 'Nonaktif', value: 'Nonaktif' }
              ]}
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Input
              type="number"
              label="Angka Meter Awal (m³)"
              value={formData.initial_reading}
              onChange={(e) => setFormData({ ...formData, initial_reading: e.target.value })}
            />
            <Input
              type="number"
              label="Angka Meter Saat Ini (m³)"
              value={formData.current_reading}
              onChange={(e) => setFormData({ ...formData, current_reading: e.target.value })}
            />
          </div>
        </form>
      </Modal>

      {/* Delete Dialog */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title="Hapus Meter Air"
        message={`Apakah Anda yakin ingin menghapus meter "${deleteTarget?.meter_no}"?`}
        confirmText="Hapus Meter"
        variant="danger"
        loading={saving}
      />
    </div>
  );
};
