import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Plus,
  Search,
  Download,
  Edit2,
  Trash2,
  Phone,
  MapPin,
  FileText,
  ShieldCheck,
  HeartHandshake,
  Gift
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
import { exportToCsv } from '../../utils/exportCsv';
import { formatRupiah } from '../../utils/formatters';
import { Customer, Tariff, SubsidyType } from '../../types';

export const CustomerManagement: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [tariffs, setTariffs] = useState<Tariff[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [rtrwFilter, setRtrwFilter] = useState<string>('');
  const [subsidyFilter, setSubsidyFilter] = useState<string>('');

  // Modal State
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [saving, setSaving] = useState<boolean>(false);

  // Form State
  const [formData, setFormData] = useState({
    customer_no: '',
    full_name: '',
    nik: '',
    phone: '',
    address: '',
    rt_rw: 'RT 01 / RW 01',
    tariff_id: 'TRF-01',
    status: 'Aktif',
    meter_no: '',
    initial_reading: '0',
    is_subsidized: false,
    subsidy_type: 'max_tagihan' as SubsidyType,
    subsidy_max_amount: '20000',
    subsidy_notes: ''
  });

  const debouncedSearch = useDebounce(search, 300);
  const { success, error: toastError } = useToast();

  const fetchTariffs = useCallback(async () => {
    try {
      const data = await api.getTariffs();
      setTariffs(data);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const fetchCustomers = useCallback(async () => {
    try {
      setLoading(true);
      let data = await api.getCustomers({
        search: debouncedSearch,
        status: statusFilter,
        rt_rw: rtrwFilter
      });
      if (subsidyFilter === 'subsidized') {
        data = data.filter((c: Customer) => c.is_subsidized);
      } else if (subsidyFilter === 'regular') {
        data = data.filter((c: Customer) => !c.is_subsidized);
      }
      setCustomers(data);
    } catch (err: any) {
      toastError(err.message || 'Gagal memuat data pelanggan.');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, statusFilter, rtrwFilter, subsidyFilter, toastError]);

  useEffect(() => {
    fetchTariffs();
  }, [fetchTariffs]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const pagination = usePagination(customers, { initialPageSize: 10 });

  const handleOpenCreate = () => {
    setEditingCustomer(null);
    setFormData({
      customer_no: '',
      full_name: '',
      nik: '',
      phone: '',
      address: '',
      rt_rw: 'RT 01 / RW 01',
      tariff_id: tariffs[0]?.id || 'TRF-01',
      status: 'Aktif',
      meter_no: '',
      initial_reading: '0',
      is_subsidized: false,
      subsidy_type: 'max_tagihan',
      subsidy_max_amount: '20000',
      subsidy_notes: ''
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (c: Customer) => {
    setEditingCustomer(c);
    setFormData({
      customer_no: c.customer_no,
      full_name: c.full_name,
      nik: c.nik || '',
      phone: c.phone || '',
      address: c.address || '',
      rt_rw: c.rt_rw || 'RT 01 / RW 01',
      tariff_id: c.tariff_id || tariffs[0]?.id || 'TRF-01',
      status: c.status || 'Aktif',
      meter_no: c.meter_no || '',
      initial_reading: String(c.current_reading || 0),
      is_subsidized: Boolean(c.is_subsidized),
      subsidy_type: c.subsidy_type || 'max_tagihan',
      subsidy_max_amount: String(c.subsidy_max_amount !== undefined ? c.subsidy_max_amount : 20000),
      subsidy_notes: c.subsidy_notes || ''
    });
    setModalOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.full_name.trim()) {
      toastError('Nama lengkap pelanggan wajib diisi.');
      return;
    }

    setSaving(true);
    try {
      if (editingCustomer) {
        // initial_reading is a meter-only concept; sending it would be rejected
        // by backends with strict schemas.
        const { initial_reading: _ignored, ...customerFields } = formData;
        await api.updateCustomer({
          id: editingCustomer.id,
          ...customerFields,
          subsidy_max_amount: Number(formData.subsidy_max_amount || 0)
        });
        success('Data pelanggan berhasil diperbarui.');
      } else {
        await api.createCustomer({
          ...formData,
          initial_reading: Number(formData.initial_reading || 0),
          subsidy_max_amount: Number(formData.subsidy_max_amount || 0)
        });
        success('Pelanggan baru berhasil ditambahkan.');
      }
      setModalOpen(false);
      fetchCustomers();
    } catch (err: any) {
      toastError(err.message || 'Gagal menyimpan data pelanggan.');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await api.deleteCustomer(deleteTarget.id);
      success('Pelanggan berhasil dihapus.');
      setDeleteTarget(null);
      fetchCustomers();
    } catch (err: any) {
      toastError(err.message || 'Gagal menghapus pelanggan.');
    } finally {
      setSaving(false);
    }
  };

  const handleExportCsv = () => {
    const headers = ['ID Pelanggan', 'Nama Lengkap', 'NIK', 'No. HP', 'Alamat', 'RT/RW', 'No. Meter', 'Tarif', 'Status'];
    const rows = customers.map((c) => [
      c.customer_no,
      c.full_name,
      c.nik || '-',
      c.phone || '-',
      c.address || '-',
      c.rt_rw || '-',
      c.meter_no || '-',
      c.tariff_name || '-',
      c.status
    ]);
    exportToCsv(`data-pelanggan-air-${new Date().toISOString().substring(0, 10)}`, headers, rows);
    success('Data pelanggan berhasil diexport ke CSV.');
  };

  // Distinct RT/RW list for filter
  const rtrwOptions = [
    { label: 'Semua Wilayah RT/RW', value: '' },
    { label: 'RT 01 / RW 01', value: 'RT 01 / RW 01' },
    { label: 'RT 02 / RW 01', value: 'RT 02 / RW 01' },
    { label: 'RT 03 / RW 01', value: 'RT 03 / RW 01' },
    { label: 'RT 01 / RW 02', value: 'RT 01 / RW 02' },
    { label: 'RT 02 / RW 02', value: 'RT 02 / RW 02' }
  ];

  const columns = [
    {
      header: 'No. Pelanggan',
      render: (c: Customer) => (
        <div>
          <span style={{ fontWeight: 800, color: 'var(--primary-700)', fontSize: 13.5 }}>
            {c.customer_no}
          </span>
          <div style={{ fontSize: 11, color: 'var(--slate-500)' }}>
            Meter: {c.meter_no || '-'}
          </div>
        </div>
      )
    },
    {
      header: 'Nama & Kontak',
      render: (c: Customer) => (
        <div>
          <div style={{ fontWeight: 700, color: 'var(--slate-900)' }}>{c.full_name}</div>
          {c.phone && (
            <div style={{ fontSize: 12, color: 'var(--slate-500)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Phone size={12} /> {c.phone}
            </div>
          )}
        </div>
      )
    },
    {
      header: 'Alamat & RT/RW',
      render: (c: Customer) => (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--slate-700)', fontSize: 13 }}>
            <MapPin size={13} color="var(--slate-400)" />
            <span>{c.rt_rw || '-'}</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--slate-500)' }}>{c.address || '-'}</div>
        </div>
      )
    },
    {
      header: 'Tarif & Subsidi',
      render: (c: Customer) => (
        <div>
          <Badge variant="neutral">{c.tariff_name || 'Rumah Tangga'}</Badge>
          {c.is_subsidized && (
            <div style={{ marginTop: 4 }}>
              {c.subsidy_type === 'gratis' ? (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3,
                    fontSize: 11,
                    fontWeight: 700,
                    backgroundColor: 'rgba(16, 185, 129, 0.15)',
                    color: 'var(--success-700)',
                    padding: '2px 7px',
                    borderRadius: 4,
                    border: '1px solid rgba(16, 185, 129, 0.3)'
                  }}
                >
                  <ShieldCheck size={11} /> 100% Gratis
                </span>
              ) : (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3,
                    fontSize: 11,
                    fontWeight: 700,
                    backgroundColor: 'rgba(2, 132, 199, 0.12)',
                    color: 'var(--primary-700)',
                    padding: '2px 7px',
                    borderRadius: 4,
                    border: '1px solid rgba(2, 132, 199, 0.25)'
                  }}
                >
                  <HeartHandshake size={11} /> Maks. {formatRupiah(c.subsidy_max_amount || 20000)}
                </span>
              )}
            </div>
          )}
        </div>
      )
    },
    {
      header: 'Status',
      render: (c: Customer) => <Badge status={c.status} />
    },
    {
      header: 'Aksi',
      align: 'right' as const,
      render: (c: Customer) => (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
          <Button
            size="sm"
            variant="secondary"
            icon={<Edit2 size={13} />}
            onClick={() => handleOpenEdit(c)}
            aria-label="Edit"
          >
            Edit
          </Button>
          <Button
            size="sm"
            variant="danger"
            icon={<Trash2 size={13} />}
            onClick={() => setDeleteTarget(c)}
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
        title="Manajemen Pelanggan Air"
        subtitle="Kelola data sambungan air rumah warga, penetapan subsidi desa, dan golongan tarif."
        action={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button variant="secondary" icon={<Download size={16} />} onClick={handleExportCsv}>
              Export CSV
            </Button>
            <Button variant="primary" icon={<Plus size={16} />} onClick={handleOpenCreate}>
              Tambah Pelanggan
            </Button>
          </div>
        }
      />

      {/* Filter & Search Bar */}
      <Card bodyClassName="p-4" style={{ marginBottom: 20 }}>
        <div className="filter-bar" style={{ margin: 0, gap: 12 }}>
          <div className="filter-group" style={{ flex: 1, minWidth: 240 }}>
            <div style={{ width: '100%', maxWidth: 360 }}>
              <Input
                placeholder="Cari nama, nomor pelanggan, no HP..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                leftIcon={<Search size={16} />}
              />
            </div>
          </div>

          <div className="filter-group" style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <div style={{ width: 170 }}>
              <Select
                options={[
                  { label: 'Semua Kategori Warga', value: '' },
                  { label: 'Warga Reguler', value: 'regular' },
                  { label: 'Warga Penerima Subsidi', value: 'subsidized' }
                ]}
                value={subsidyFilter}
                onChange={(e) => setSubsidyFilter(e.target.value)}
              />
            </div>

            <div style={{ width: 160 }}>
              <Select
                options={rtrwOptions}
                value={rtrwFilter}
                onChange={(e) => setRtrwFilter(e.target.value)}
              />
            </div>

            <div style={{ width: 140 }}>
              <Select
                options={[
                  { label: 'Semua Status', value: '' },
                  { label: 'Aktif', value: 'Aktif' },
                  { label: 'Nonaktif', value: 'Nonaktif' },
                  { label: 'Ditangguhkan', value: 'Ditangguhkan' }
                ]}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Customers Data Table */}
      <Card>
        <DataTable
          columns={columns}
          data={pagination.paginatedItems}
          loading={loading}
          emptyTitle="Belum Ada Pelanggan"
          emptyMessage="Tidak ada data pelanggan yang sesuai dengan filter pencarian Anda."
        />
        <Pagination
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          totalItems={pagination.totalItems}
          pageSize={pagination.pageSize}
          onPageChange={pagination.goToPage}
        />
      </Card>

      {/* Create / Edit Customer Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        size="md"
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Users size={20} color="var(--primary-600)" />
            <span>{editingCustomer ? 'Edit Data Pelanggan' : 'Pendaftaran Pelanggan Baru'}</span>
          </div>
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)} disabled={saving}>
              Batal
            </Button>
            <Button variant="primary" onClick={handleFormSubmit} loading={saving}>
              {editingCustomer ? 'Simpan Perubahan' : 'Daftarkan Pelanggan'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleFormSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Input
              label="Nomor Pelanggan (ID)"
              placeholder="Otomatis jika kosong (CUST-2026-XXXX)"
              value={formData.customer_no}
              onChange={(e) => setFormData({ ...formData, customer_no: e.target.value })}
            />
            <Input
              label="Nama Lengkap"
              placeholder="Contoh: Bpk. Supardi"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Input
              label="Nomor NIK KTP (Opsi)"
              placeholder="16 digit NIK"
              value={formData.nik}
              onChange={(e) => setFormData({ ...formData, nik: e.target.value })}
            />
            <Input
              label="Nomor Telepon / WA"
              placeholder="081234567890"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Select
              label="Wilayah (RT / RW)"
              options={rtrwOptions.filter((o) => o.value !== '')}
              value={formData.rt_rw}
              onChange={(e) => setFormData({ ...formData, rt_rw: e.target.value })}
              required
            />
            <Select
              label="Golongan Tarif"
              options={tariffs.map((t) => ({ label: `${t.name} (${t.code})`, value: t.id }))}
              value={formData.tariff_id}
              onChange={(e) => setFormData({ ...formData, tariff_id: e.target.value })}
              required
            />
          </div>

          <Input
            label="Alamat Rumah"
            placeholder="Nama jalan, nomor rumah, atau dusun"
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
          />

          {/* Subsidy Configuration Section */}
          <div
            style={{
              backgroundColor: formData.is_subsidized ? 'rgba(16, 185, 129, 0.08)' : 'var(--slate-50)',
              border: formData.is_subsidized ? '1px solid var(--success-300)' : '1px solid var(--slate-200)',
              borderRadius: 'var(--radius-md)',
              padding: 14,
              marginTop: 12,
              marginBottom: 12,
              transition: 'all 0.2s ease'
            }}
          >
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 700, fontSize: 13.5, color: formData.is_subsidized ? 'var(--success-800)' : 'var(--slate-800)' }}>
              <input
                type="checkbox"
                checked={formData.is_subsidized}
                onChange={(e) => setFormData({ ...formData, is_subsidized: e.target.checked })}
                style={{ width: 16, height: 16, cursor: 'pointer' }}
              />
              <HeartHandshake size={16} color={formData.is_subsidized ? 'var(--success-600)' : 'var(--slate-500)'} />
              <span>Tetapkan sebagai Warga Penerima Subsidi Air Desa</span>
            </label>

            {formData.is_subsidized && (
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <Select
                    label="Tipe Subsidi"
                    value={formData.subsidy_type}
                    onChange={(e) => setFormData({ ...formData, subsidy_type: e.target.value as SubsidyType })}
                    options={[
                      { label: '100% Tagihan Gratis (Rp 0)', value: 'gratis' },
                      { label: 'Plafon Maksimal Bayar (Capped)', value: 'max_tagihan' }
                    ]}
                    required
                  />
                  {formData.subsidy_type === 'max_tagihan' ? (
                    <Input
                      type="number"
                      label="Batas Maksimal Bayar per Bulan (Rp)"
                      placeholder="Contoh: 20000"
                      value={formData.subsidy_max_amount}
                      onChange={(e) => setFormData({ ...formData, subsidy_max_amount: e.target.value })}
                      hint="Berapapun pemakaian airnya, warga cukup bayar maksimal nominal ini"
                      required
                    />
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', fontSize: 12, color: 'var(--success-700)', fontWeight: 600, padding: '10px 0' }}>
                      <Gift size={16} style={{ marginRight: 6 }} /> Tagihan bulanan otomatis Rp 0 (100% ditanggung BUMDes).
                    </div>
                  )}
                </div>

                <Input
                  label="Keterangan / Alasan Subsidi"
                  placeholder="Contoh: Warga Lansia / Kurang Mampu / Bantuan Khusus BUMDes / Rumah Ibadah"
                  value={formData.subsidy_notes}
                  onChange={(e) => setFormData({ ...formData, subsidy_notes: e.target.value })}
                />
              </div>
            )}
          </div>

          {!editingCustomer && (
            <div
              style={{
                backgroundColor: 'var(--primary-50)',
                padding: 14,
                borderRadius: 'var(--radius-md)',
                marginTop: 10,
                border: '1px solid var(--primary-200)'
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary-800)', marginBottom: 8 }}>
                Pemasangan Meter Air Awal
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Input
                  label="Nomor Meter"
                  placeholder="Contoh: MTR-8810"
                  value={formData.meter_no}
                  onChange={(e) => setFormData({ ...formData, meter_no: e.target.value })}
                />
                <Input
                  type="number"
                  label="Angka Meter Awal (m³)"
                  placeholder="0"
                  value={formData.initial_reading}
                  onChange={(e) => setFormData({ ...formData, initial_reading: e.target.value })}
                />
              </div>
              <div style={{ fontSize: 11, color: 'var(--primary-700)', marginTop: 4 }}>
                *Akun login mandiri untuk warga otomatis dibuat dengan username = Nomor Pelanggan.
              </div>
            </div>
          )}

          {editingCustomer && (
            <Select
              label="Status Pelanggan"
              options={[
                { label: 'Aktif', value: 'Aktif' },
                { label: 'Nonaktif', value: 'Nonaktif' },
                { label: 'Ditangguhkan', value: 'Ditangguhkan' }
              ]}
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
            />
          )}
        </form>
      </Modal>

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title="Hapus Data Pelanggan"
        message={`Apakah Anda yakin ingin menghapus pelanggan "${deleteTarget?.full_name}" (${deleteTarget?.customer_no})? Tindakan ini tidak dapat dibatalkan.`}
        confirmText="Hapus Pelanggan"
        variant="danger"
        loading={saving}
      />
    </div>
  );
};
