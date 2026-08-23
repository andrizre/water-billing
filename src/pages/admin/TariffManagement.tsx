import React, { useState, useEffect, useCallback } from 'react';
import { Tag, Plus, Edit2, Calculator, CheckCircle } from 'lucide-react';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { DataTable } from '../../components/common/DataTable';
import { useToast } from '../../context/ToastContext';
import { api } from '../../services/api';
import { Tariff } from '../../types';
import { formatRupiah, formatM3 } from '../../utils/formatters';
import { calculateTieredBillBreakdown } from '../../utils/calculator';

export const TariffManagement: React.FC = () => {
  const [tariffs, setTariffs] = useState<Tariff[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [editingTariff, setEditingTariff] = useState<Tariff | null>(null);
  const [saving, setSaving] = useState<boolean>(false);

  // Simulator State
  const [simTariffId, setSimTariffId] = useState<string>('TRF-01');
  const [simUsage, setSimUsage] = useState<string>('18');

  // Form State
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    category: 'Rumah Tangga' as any,
    base_fee: '5000',
    tier1_max: '10',
    tier1_rate: '2000',
    tier2_max: '20',
    tier2_rate: '3000',
    tier3_rate: '5000',
    late_fee: '5000',
    description: '',
    is_active: true
  });

  const { success, error: toastError } = useToast();

  const fetchTariffs = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getTariffs();
      setTariffs(data);
      if (data.length > 0 && !simTariffId) {
        setSimTariffId(data[0].id);
      }
    } catch (err: any) {
      toastError(err.message || 'Gagal memuat data tarif.');
    } finally {
      setLoading(false);
    }
  }, [toastError, simTariffId]);

  useEffect(() => {
    fetchTariffs();
  }, [fetchTariffs]);

  const handleOpenCreate = () => {
    setEditingTariff(null);
    setFormData({
      code: '',
      name: '',
      category: 'Rumah Tangga',
      base_fee: '5000',
      tier1_max: '10',
      tier1_rate: '2000',
      tier2_max: '20',
      tier2_rate: '3000',
      tier3_rate: '5000',
      late_fee: '5000',
      description: '',
      is_active: true
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (t: Tariff) => {
    setEditingTariff(t);
    setFormData({
      code: t.code,
      name: t.name,
      category: t.category,
      base_fee: String(t.base_fee || 0),
      tier1_max: String(t.tier1_max || 10),
      tier1_rate: String(t.tier1_rate || 2000),
      tier2_max: String(t.tier2_max || 20),
      tier2_rate: String(t.tier2_rate || 3000),
      tier3_rate: String(t.tier3_rate || 5000),
      late_fee: String(t.late_fee || 5000),
      description: t.description || '',
      is_active: t.is_active
    });
    setModalOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toastError('Nama golongan tarif wajib diisi.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        code: formData.code,
        name: formData.name,
        category: formData.category,
        base_fee: Number(formData.base_fee),
        tier1_max: Number(formData.tier1_max),
        tier1_rate: Number(formData.tier1_rate),
        tier2_max: Number(formData.tier2_max),
        tier2_rate: Number(formData.tier2_rate),
        tier3_rate: Number(formData.tier3_rate),
        late_fee: Number(formData.late_fee),
        description: formData.description,
        is_active: formData.is_active
      };

      if (editingTariff) {
        await api.updateTariff({ id: editingTariff.id, ...payload });
        success('Golongan tarif berhasil diperbarui.');
      } else {
        await api.createTariff(payload);
        success('Golongan tarif baru berhasil ditambahkan.');
      }

      setModalOpen(false);
      fetchTariffs();
    } catch (err: any) {
      toastError(err.message || 'Gagal menyimpan tarif.');
    } finally {
      setSaving(false);
    }
  };

  // Run calculation for simulator
  const activeSimTariff = tariffs.find((t) => t.id === simTariffId) || tariffs[0];
  const simResult = calculateTieredBillBreakdown(Number(simUsage || 0), activeSimTariff);

  const columns = [
    {
      header: 'Kode & Golongan',
      render: (t: Tariff) => (
        <div>
          <span style={{ fontWeight: 800, color: 'var(--primary-700)', fontSize: 13.5 }}>
            {t.code}
          </span>
          <div style={{ fontWeight: 700, color: 'var(--slate-900)' }}>{t.name}</div>
          <div style={{ fontSize: 11, color: 'var(--slate-500)' }}>{t.category}</div>
        </div>
      )
    },
    {
      header: 'Abodemen Tetap',
      render: (t: Tariff) => (
        <span style={{ fontWeight: 700, color: 'var(--slate-800)' }}>
          {formatRupiah(t.base_fee)}
        </span>
      )
    },
    {
      header: 'Tier 1 (0 - 10 m³)',
      render: (t: Tariff) => (
        <div>
          <div style={{ fontWeight: 600 }}>{formatRupiah(t.tier1_rate)} / m³</div>
          <div style={{ fontSize: 11, color: 'var(--slate-500)' }}>Maks: {t.tier1_max} m³</div>
        </div>
      )
    },
    {
      header: 'Tier 2 (11 - 20 m³)',
      render: (t: Tariff) => (
        <div>
          <div style={{ fontWeight: 600 }}>{formatRupiah(t.tier2_rate)} / m³</div>
          <div style={{ fontSize: 11, color: 'var(--slate-500)' }}>Maks: {t.tier2_max} m³</div>
        </div>
      )
    },
    {
      header: 'Tier 3 (> 20 m³)',
      render: (t: Tariff) => (
        <div style={{ fontWeight: 700, color: 'var(--primary-700)' }}>
          {formatRupiah(t.tier3_rate)} / m³
        </div>
      )
    },
    {
      header: 'Denda Flat',
      render: (t: Tariff) => (
        <span style={{ color: 'var(--danger-600)', fontWeight: 600 }}>
          {formatRupiah(t.late_fee)}
        </span>
      )
    },
    {
      header: 'Status',
      render: (t: Tariff) => <Badge status={t.is_active ? 'Aktif' : 'Nonaktif'} />
    },
    {
      header: 'Aksi',
      align: 'right' as const,
      render: (t: Tariff) => (
        <Button
          size="sm"
          variant="secondary"
          icon={<Edit2 size={13} />}
          onClick={() => handleOpenEdit(t)}
        >
          Edit Tarif
        </Button>
      )
    }
  ];

  return (
    <div>
      <PageHeader
        title="Pengaturan Tarif Air Bertingkat"
        subtitle="Atur struktur harga air per kubik (m³), batas tingkatan tier, biaya beban tetap, dan denda."
        action={
          <Button variant="primary" icon={<Plus size={16} />} onClick={handleOpenCreate}>
            Tambah Golongan Tarif
          </Button>
        }
      />

      {/* Interactive Tariff Simulator Card */}
      <Card
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Calculator size={18} color="var(--primary-600)" />
            <span>Kalkulator & Simulator Perhitungan Tarif</span>
          </div>
        }
        subtitle="Uji coba perhitungan tagihan secara langsung dengan memasukkan volume kubikasi air"
        style={{ marginBottom: 24, backgroundColor: 'var(--slate-50)' }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 16,
            alignItems: 'center'
          }}
        >
          <Select
            label="Pilih Golongan Tarif"
            options={tariffs.map((t) => ({ label: `${t.name} (${t.code})`, value: t.id }))}
            value={simTariffId}
            onChange={(e) => setSimTariffId(e.target.value)}
          />

          <Input
            type="number"
            label="Simulasi Pemakaian (m³)"
            placeholder="15"
            value={simUsage}
            onChange={(e) => setSimUsage(e.target.value)}
          />

          <div
            style={{
              backgroundColor: 'var(--slate-50)',
              padding: '12px 18px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--slate-200)',
              textAlign: 'right'
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--slate-500)' }}>
              ESTIMASI TOTAL TAGIHAN
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--primary-700)', marginTop: 2 }}>
              {formatRupiah(simResult.total_amount)}
            </div>
            <div style={{ fontSize: 11, color: 'var(--slate-500)', marginTop: 2 }}>
              Abodemen: {formatRupiah(simResult.base_fee)} | Air: {formatRupiah(simResult.usage_amount)}
            </div>
          </div>
        </div>
      </Card>

      {/* Tariffs Table */}
      <Card title="Daftar Golongan Tarif Aktif">
        <DataTable columns={columns} data={tariffs} loading={loading} />
      </Card>

      {/* Create / Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        size="md"
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Tag size={20} color="var(--primary-600)" />
            <span>{editingTariff ? 'Edit Golongan Tarif' : 'Tambah Golongan Tarif'}</span>
          </div>
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)} disabled={saving}>
              Batal
            </Button>
            <Button variant="primary" onClick={handleFormSubmit} loading={saving}>
              Simpan Tarif
            </Button>
          </>
        }
      >
        <form onSubmit={handleFormSubmit}>
          <div className="form-grid-2">
            <Input
              label="Kode Tarif"
              placeholder="Contoh: R1-DESA"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              required
            />
            <Input
              label="Nama Golongan"
              placeholder="Contoh: Rumah Tangga Standar"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div className="form-grid-2">
            <Select
              label="Kategori"
              options={[
                { label: 'Rumah Tangga', value: 'Rumah Tangga' },
                { label: 'Niaga', value: 'Niaga' },
                { label: 'Sosial', value: 'Sosial' },
                { label: 'Industri', value: 'Industri' }
              ]}
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            />
            <Input
              type="number"
              label="Biaya Abodemen Tetap (Rp)"
              value={formData.base_fee}
              onChange={(e) => setFormData({ ...formData, base_fee: e.target.value })}
              required
            />
          </div>

          <div
            style={{
              padding: 14,
              backgroundColor: 'var(--slate-50)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--slate-200)',
              marginBottom: 16
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--slate-800)', marginBottom: 10 }}>
              Konfigurasi Batas & Tarif Tiap Tier (Per m³)
            </div>

            <div className="form-grid-2" style={{ marginBottom: 10 }}>
              <Input
                type="number"
                label="Batas Maks Tier 1 (m³)"
                value={formData.tier1_max}
                onChange={(e) => setFormData({ ...formData, tier1_max: e.target.value })}
              />
              <Input
                type="number"
                label="Tarif Tier 1 (Rp/m³)"
                value={formData.tier1_rate}
                onChange={(e) => setFormData({ ...formData, tier1_rate: e.target.value })}
              />
            </div>

            <div className="form-grid-2" style={{ marginBottom: 10 }}>
              <Input
                type="number"
                label="Batas Maks Tier 2 (m³)"
                value={formData.tier2_max}
                onChange={(e) => setFormData({ ...formData, tier2_max: e.target.value })}
              />
              <Input
                type="number"
                label="Tarif Tier 2 (Rp/m³)"
                value={formData.tier2_rate}
                onChange={(e) => setFormData({ ...formData, tier2_rate: e.target.value })}
              />
            </div>

            <div className="form-grid-2">
              <Input
                type="number"
                label="Tarif Tier 3 (Di atas Tier 2) (Rp/m³)"
                value={formData.tier3_rate}
                onChange={(e) => setFormData({ ...formData, tier3_rate: e.target.value })}
              />
              <Input
                type="number"
                label="Denda Keterlambatan (Rp)"
                value={formData.late_fee}
                onChange={(e) => setFormData({ ...formData, late_fee: e.target.value })}
              />
            </div>
          </div>

          <Input
            label="Keterangan Tambahan"
            placeholder="Deskripsi singkat golongan tarif ini"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
        </form>
      </Modal>
    </div>
  );
};
