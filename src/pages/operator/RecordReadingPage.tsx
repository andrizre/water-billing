import React, { useState, useEffect, useCallback } from 'react';
import {
  ClipboardPen,
  Plus,
  Search,
  CheckCircle2,
  Gauge,
  Calendar,
  FileText,
  Camera,
  AlertTriangle,
  Image as ImageIcon,
  Trash2,
  Eye,
  HeartHandshake
} from 'lucide-react';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import { Modal } from '../../components/common/Modal';
import { DataTable } from '../../components/common/DataTable';
import { Pagination } from '../../components/common/Pagination';
import { useAuth } from '../../context/AuthContext';
import { usePagination } from '../../hooks/usePagination';
import { useToast } from '../../context/ToastContext';
import { api } from '../../services/api';
import { Customer, MeterReading } from '../../types';
import { formatM3, formatDate, formatPeriod, formatRupiah, INDONESIAN_MONTHS } from '../../utils/formatters';

export const RecordReadingPage: React.FC = () => {
  const { user, role } = useAuth();
  const [readings, setReadings] = useState<MeterReading[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);

  // Form State
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [periodMonth, setPeriodMonth] = useState<string>('8');
  const [periodYear, setPeriodYear] = useState<string>('2026');
  const [prevReading, setPrevReading] = useState<number>(0);
  const [currentReading, setCurrentReading] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [autoGenerateBill, setAutoGenerateBill] = useState<boolean>(true);
  const [customerMeta, setCustomerMeta] = useState<any>(null);
  const [photoUrl, setPhotoUrl] = useState<string>('');
  const [selectedPhotoPreview, setSelectedPhotoPreview] = useState<string | null>(null);

  const { success, error: toastError } = useToast();

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      toastError('Ukuran foto terlalu besar (maksimal 3MB).');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      setPhotoUrl(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const fetchCustomers = useCallback(async () => {
    try {
      const custs = await api.getCustomers();
      let active = custs.filter((c: Customer) => c.status === 'Aktif');
      if (role === 'operator' && user?.assigned_rt && user.assigned_rt !== 'Semua RT') {
        active = active.filter((c: Customer) => c.rt_rw && c.rt_rw.includes(user.assigned_rt!));
      }
      setCustomers(active);
      if (active.length > 0 && !selectedCustomerId) {
        setSelectedCustomerId(active[0].id);
      }
    } catch (e) {
      console.error(e);
    }
  }, [selectedCustomerId, role, user?.assigned_rt]);

  const fetchReadings = useCallback(async () => {
    try {
      setLoading(true);
      let data = await api.getReadings({
        period_month: periodMonth,
        period_year: periodYear
      });
      if (role === 'operator' && user?.assigned_rt && user.assigned_rt !== 'Semua RT') {
        data = data.filter((r: MeterReading) => r.rt_rw && r.rt_rw.includes(user.assigned_rt!));
      }
      setReadings(data);
    } catch (err: any) {
      toastError(err.message || 'Gagal memuat catatan meter.');
    } finally {
      setLoading(false);
    }
  }, [periodMonth, periodYear, toastError, role, user?.assigned_rt]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  useEffect(() => {
    fetchReadings();
  }, [fetchReadings]);

  // When customer changes, load previous reading
  useEffect(() => {
    if (!selectedCustomerId) return;
    const loadPrev = async () => {
      try {
        const info = await api.getPrevReading(selectedCustomerId);
        setPrevReading(info.prev_reading || 0);
        setCustomerMeta(info);
        // default suggestion
        setCurrentReading(String((info.prev_reading || 0) + 15));
      } catch (e) {
        console.error('Failed to load previous reading:', e);
      }
    };
    loadPrev();
  }, [selectedCustomerId]);

  const [confirmModalOpen, setConfirmModalOpen] = useState<boolean>(false);
  const curVal = Number(currentReading || 0);
  const calculatedUsage = Math.max(0, curVal - prevReading);
  const isNegativeReading = curVal < prevReading;
  const isHighAnomalyUsage = calculatedUsage >= 35 || (prevReading > 0 && calculatedUsage > prevReading * 2.5);

  const handleOpenConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId) {
      toastError('Pilih pelanggan terlebih dahulu.');
      return;
    }
    if (isNegativeReading) {
      if (!window.confirm(`PERINGATAN: Angka meter (${curVal}) lebih kecil dari bulan lalu (${prevReading}). Lanjutkan hanya jika meteran diganti baru?`)) {
        return;
      }
    }
    setConfirmModalOpen(true);
  };

  const handleExecuteRecord = async () => {
    setSaving(true);
    try {
      await api.recordReading({
        customer_id: selectedCustomerId,
        period_month: Number(periodMonth),
        period_year: Number(periodYear),
        prev_reading: prevReading,
        current_reading: curVal,
        auto_generate_bill: autoGenerateBill,
        notes,
        photo_url: photoUrl
      });

      success(`Pencatatan meter berhasil! Pemakaian: ${calculatedUsage} m³.`);
      setConfirmModalOpen(false);
      fetchReadings();
      setNotes('');
      setPhotoUrl('');
    } catch (err: any) {
      toastError(err.message || 'Gagal menyimpan catatan meter.');
    } finally {
      setSaving(false);
    }
  };

  const pagination = usePagination(readings, { initialPageSize: 10 });

  const columns = [
    {
      header: 'No. Catat',
      render: (r: MeterReading) => (
        <span style={{ fontWeight: 800, color: 'var(--primary-700)' }}>{r.reading_no}</span>
      )
    },
    {
      header: 'Nama Pelanggan',
      render: (r: MeterReading) => (
        <div>
          <div style={{ fontWeight: 700 }}>{r.customer_name}</div>
          <div style={{ fontSize: 11, color: 'var(--slate-500)' }}>
            {r.customer_no} ({r.rt_rw})
          </div>
        </div>
      )
    },
    {
      header: 'Periode',
      render: (r: MeterReading) => formatPeriod(r.period_month, r.period_year)
    },
    {
      header: 'Meter Awal',
      render: (r: MeterReading) => `${r.prev_reading} m³`
    },
    {
      header: 'Meter Akhir',
      render: (r: MeterReading) => `${r.current_reading} m³`
    },
    {
      header: 'Pemakaian',
      render: (r: MeterReading) => (
        <span style={{ fontWeight: 800, color: 'var(--primary-700)', fontSize: 14 }}>
          {formatM3(r.usage_m3)}
        </span>
      )
    },
    {
      header: 'Foto Meter',
      render: (r: MeterReading) => (
        r.photo_url ? (
          <button
            type="button"
            onClick={() => setSelectedPhotoPreview(r.photo_url!)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 8px',
              borderRadius: 6,
              border: '1px solid var(--primary-200)',
              backgroundColor: 'var(--primary-50)',
              color: 'var(--primary-700)',
              fontSize: 11.5,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Lihat Foto
          </button>
        ) : (
          <span style={{ fontSize: 11, color: 'var(--slate-400)' }}>-</span>
        )
      )
    },
    {
      header: 'Tanggal Catat',
      render: (r: MeterReading) => formatDate(r.reading_date)
    }
  ];

  return (
    <div>
      <PageHeader
        title="Pencatatan Meteran Air Bulanan"
        subtitle="Input angka pembacaan meter fisik air di lapangan dengan kalkulasi volume kubikasi otomatis."
        action={
          user?.assigned_rt && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, backgroundColor: 'var(--primary-50)', border: '1px solid var(--primary-200)', padding: '6px 12px', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 700, color: 'var(--primary-700)' }}>
              <span>Wilayah Tugas:</span>
              <span style={{ backgroundColor: 'var(--primary-600)', color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 12 }}>
                {user.assigned_rt}
              </span>
            </div>
          )
        }
      />

      <div className="responsive-grid-2" style={{ marginBottom: 24 }}>
        {/* Input Form Card */}
        <Card
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ClipboardPen size={18} color="var(--primary-600)" />
              <span>Formulir Pencatatan Meter</span>
            </div>
          }
        >
          <form onSubmit={handleOpenConfirm}>
            <Select
              label="Pilih Pelanggan Air"
              options={customers.map((c) => ({
                label: `${c.customer_no} - ${c.full_name} (${c.rt_rw})${c.is_subsidized ? ' [SUBSIDI]' : ''}`,
                value: c.id
              }))}
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              required
            />

            {(() => {
              const selCust = customers.find(c => c.id === selectedCustomerId);
              if (!selCust?.is_subsidized) return null;
              return (
                <div
                  style={{
                    padding: '8px 12px',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid rgba(16, 185, 129, 0.25)',
                    color: 'var(--success-800)',
                    fontSize: 12,
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    marginBottom: 10
                  }}
                >
                  <HeartHandshake size={15} />
                  <span>
                    {selCust.subsidy_type === 'gratis'
                      ? 'Warga Penerima Subsidi: 100% Tagihan Gratis (Rp 0)'
                      : `Warga Penerima Subsidi: Plafon Maksimal Bayar ${formatRupiah(selCust.subsidy_max_amount || 20000)}`}
                  </span>
                </div>
              );
            })()}

            <div className="form-grid-2">
              <Select
                label="Periode Bulan"
                options={INDONESIAN_MONTHS.map((m, idx) => ({ label: m, value: String(idx + 1) }))}
                value={periodMonth}
                onChange={(e) => setPeriodMonth(e.target.value)}
                required
              />
              <Select
                label="Periode Tahun"
                options={[
                  { label: '2026', value: '2026' },
                  { label: '2025', value: '2025' }
                ]}
                value={periodYear}
                onChange={(e) => setPeriodYear(e.target.value)}
                required
              />
            </div>

            <div
              className="form-grid-2"
              style={{
                backgroundColor: 'var(--slate-50)',
                padding: 14,
                borderRadius: 'var(--radius-md)',
                margin: '12px 0',
                border: '1px solid var(--slate-200)'
              }}
            >
              <div>
                <label className="form-label" style={{ color: 'var(--slate-500)' }}>
                  Angka Meter Sebelumnya
                </label>
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--slate-700)', marginTop: 4 }}>
                  {prevReading} m³
                </div>
                <div style={{ fontSize: 11, color: 'var(--slate-400)' }}>
                  No. Meter: {customerMeta?.meter_no || '-'}
                </div>
              </div>

              <div>
                <Input
                  type="number"
                  label="Angka Meter Sekarang (m³)"
                  value={currentReading}
                  onChange={(e) => setCurrentReading(e.target.value)}
                  placeholder="0"
                  required
                />
              </div>
            </div>

            <div
              style={{
                backgroundColor: 'var(--primary-50)',
                padding: '12px 16px',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 16,
                border: '1px solid var(--primary-200)'
              }}
            >
              <div>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary-800)' }}>
                  VOLUME PEMAKAIAN AIR BULAN INI:
                </span>
                <div style={{ fontSize: 11, color: 'var(--primary-600)' }}>
                  Rumus: {curVal} m³ - {prevReading} m³
                </div>
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--primary-700)' }}>
                {formatM3(calculatedUsage)}
              </div>
            </div>

            {/* Smart Anomaly / Negative Warning Alerts */}
            {isNegativeReading && (
              <div
                style={{
                  backgroundColor: 'var(--danger-50)',
                  border: '1px solid var(--danger-500)',
                  color: 'var(--danger-700)',
                  padding: 12,
                  borderRadius: 'var(--radius-md)',
                  marginBottom: 14,
                  fontSize: 12.5,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 8
                }}
              >
                <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
                <div>
                  <strong>Perhatian: Angka Lebih Kecil!</strong>
                  <div>Angka meter saat ini ({curVal} m³) lebih kecil dari bulan lalu ({prevReading} m³). Lanjutkan hanya jika meteran fisik diganti dengan unit baru.</div>
                </div>
              </div>
            )}

            {isHighAnomalyUsage && !isNegativeReading && (
              <div
                style={{
                  backgroundColor: 'var(--warning-50)',
                  border: '1px solid var(--warning-500)',
                  color: 'var(--warning-700)',
                  padding: 12,
                  borderRadius: 'var(--radius-md)',
                  marginBottom: 14,
                  fontSize: 12.5,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 8
                }}
              >
                <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
                <div>
                  <strong>Deteksi Lonjakan Pemakaian Air ({calculatedUsage} m³)</strong>
                  <div>Pemakaian bulan ini meningkat signifikan. Pastikan angka meter benar atau beri tahu warga untuk mengecek kemungkinan kebocoran pipa / keran terbuka.</div>
                </div>
              </div>
            )}

            {/* Photo Evidence Upload Container */}
            <div
              style={{
                border: '1px dashed var(--slate-300)',
                padding: 14,
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--slate-50)',
                marginBottom: 16
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--slate-800)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Camera size={16} color="var(--primary-600)" />
                  Foto Bukti Fisik Meteran (Opsional)
                </span>
                {photoUrl && (
                  <button
                    type="button"
                    onClick={() => setPhotoUrl('')}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--danger-600)',
                      fontSize: 12,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4
                    }}
                  >
                    <Trash2 size={13} /> Hapus
                  </button>
                )}
              </div>

              {photoUrl ? (
                <div style={{ position: 'relative', textAlign: 'center', marginTop: 8 }}>
                  <img
                    src={photoUrl}
                    alt="Bukti fisik meteran"
                    style={{
                      width: '100%',
                      maxHeight: 180,
                      objectFit: 'contain',
                      borderRadius: 8,
                      border: '1px solid var(--slate-200)'
                    }}
                  />
                  <span style={{ fontSize: 11, color: 'var(--success-700)', display: 'block', marginTop: 4, fontWeight: 600 }}>
                    Foto berhasil dilampirkan
                  </span>
                </div>
              ) : (
                <label
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '16px 8px',
                    cursor: 'pointer',
                    borderRadius: 8,
                    backgroundColor: '#ffffff',
                    border: '1px solid var(--slate-200)',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <Camera size={24} color="var(--slate-400)" style={{ marginBottom: 4 }} />
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--primary-700)' }}>
                    Ambil Foto / Upload Gambar Meteran
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--slate-400)' }}>
                    Format JPG, PNG (Maks 3MB)
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handlePhotoUpload}
                    style={{ display: 'none' }}
                  />
                </label>
              )}
            </div>

            <Input
              label="Catatan Lapangan (Kondisi meter, kendala, dll.)"
              placeholder="Contoh: Kondisi meter bersih, tidak bocor"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '14px 0' }}>
              <input
                type="checkbox"
                id="autoBill"
                checked={autoGenerateBill}
                onChange={(e) => setAutoGenerateBill(e.target.checked)}
                style={{ width: 16, height: 16 }}
              />
              <label htmlFor="autoBill" style={{ fontSize: 13, fontWeight: 600, color: 'var(--slate-700)', cursor: 'pointer' }}>
                Otomatis buatkan faktur tagihan rekening air untuk periode ini
              </label>
            </div>

            <Button
              type="button"
              variant="primary"
              icon={<CheckCircle2 size={16} />}
              onClick={handleOpenConfirm}
              style={{ width: '100%', padding: '12px' }}
            >
              Simpan Pencatatan Meter
            </Button>
          </form>
        </Card>

        {/* Confirmation Modal */}
        <Modal
          isOpen={confirmModalOpen}
          onClose={() => setConfirmModalOpen(false)}
          title="Konfirmasi Pencatatan Angka Meter"
        >
          <div style={{ padding: 14, backgroundColor: 'var(--slate-50)', borderRadius: 'var(--radius-md)', marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: 'var(--slate-500)' }}>Nama Pelanggan:</div>
            <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--slate-900)' }}>
              {customerMeta?.customer_name || 'Pelanggan'} ({customerMeta?.customer_no || '-'})
            </div>
            <div style={{ fontSize: 12, color: 'var(--slate-600)', marginTop: 2 }}>
              Periode: <strong>{INDONESIAN_MONTHS[Number(periodMonth) - 1]} {periodYear}</strong> | No. Meter: {customerMeta?.meter_no || '-'}
            </div>

            <div style={{ marginTop: 12, borderTop: '1px dashed var(--slate-300)', paddingTop: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 13, color: 'var(--slate-600)' }}>Angka Meter Sebelumnya:</span>
                <span style={{ fontSize: 14, fontWeight: 700 }}>{prevReading} m³</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 13, color: 'var(--slate-600)' }}>Angka Meter Sekarang:</span>
                <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--primary-700)' }}>{curVal} m³</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 6, borderTop: '1px solid var(--slate-200)' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary-800)' }}>Total Pemakaian Air:</span>
                <span style={{ fontSize: 18, fontWeight: 900, color: 'var(--primary-700)' }}>{formatM3(calculatedUsage)}</span>
              </div>
              {photoUrl && (
                <div style={{ marginTop: 10, textAlign: 'center' }}>
                  <img
                    src={photoUrl}
                    alt="Foto meter lampiran"
                    style={{ maxHeight: 120, borderRadius: 6, border: '1px solid var(--slate-200)' }}
                  />
                </div>
              )}
            </div>
          </div>

          <p style={{ fontSize: 13, color: 'var(--slate-600)', textAlign: 'center', marginBottom: 16 }}>
            Pastikan angka meteran yang dicatat sudah sesuai dengan kondisi fisik meter air pelanggan.
          </p>

          <div className="modal-footer" style={{ padding: '14px 0 0 0' }}>
            <Button variant="secondary" type="button" onClick={() => setConfirmModalOpen(false)}>
              Batal / Koreksi
            </Button>
            <Button
              variant="primary"
              type="button"
              icon={<CheckCircle2 size={16} />}
              loading={saving}
              onClick={handleExecuteRecord}
            >
              Ya, Simpan Angka Meter
            </Button>
          </div>
        </Modal>

        {/* Photo Preview Modal */}
        {selectedPhotoPreview && (
          <Modal
            isOpen={!!selectedPhotoPreview}
            onClose={() => setSelectedPhotoPreview(null)}
            title="Bukti Foto Fisik Meteran Air"
          >
            <div style={{ textAlign: 'center', padding: 8 }}>
              <img
                src={selectedPhotoPreview}
                alt="Foto bukti meter"
                style={{ width: '100%', maxHeight: 420, objectFit: 'contain', borderRadius: 8 }}
              />
            </div>
            <div className="modal-footer" style={{ marginTop: 16 }}>
              <Button variant="secondary" onClick={() => setSelectedPhotoPreview(null)}>
                Tutup Pratinjau
              </Button>
            </div>
          </Modal>
        )}

        {/* Info & Helper Card */}
        <Card title="Petunjuk Pencatatan Lapangan">
          <div style={{ fontSize: 13.5, color: 'var(--slate-600)', lineHeight: 1.7 }}>
            <p style={{ marginBottom: 12 }}>
              <strong>Langkah Pencatatan:</strong>
            </p>
            <ol style={{ paddingLeft: 20, marginBottom: 16 }}>
              <li>Pilih nama pelanggan atau cari berdasarkan nomor ID.</li>
              <li>Periksa kesesuaian nomor fisik meteran di rumah warga.</li>
              <li>Masukkan angka meter yang tertera pada jarum/dial meteran air.</li>
              <li>Sistem akan memvalidasi agar angka meter sekarang &ge; meter sebelumnya.</li>
              <li>Centang opsi buat tagihan agar pelanggan langsung mendapatkan tagihan aktif.</li>
            </ol>
            <div style={{ padding: 12, backgroundColor: 'var(--slate-50)', borderRadius: 'var(--radius-md)', border: '1px solid var(--slate-200)', fontSize: 12 }}>
              ⚠️ <em>Jika meteran rusak atau diganti baru, laporkan kepada Administrator untuk diperbarui pada menu Manajemen Meter Air.</em>
            </div>
          </div>
        </Card>
      </div>

      {/* Recent Readings Table */}
      <Card title={`Riwayat Pembacaan Meter (${formatPeriod(periodMonth, periodYear)})`}>
        <DataTable
          columns={columns}
          data={pagination.paginatedItems}
          loading={loading}
          emptyTitle="Belum Ada Pembacaan"
          emptyMessage="Belum ada pembacaan meter yang dicatat pada periode ini."
        />
        <Pagination
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          totalItems={pagination.totalItems}
          pageSize={pagination.pageSize}
          onPageChange={pagination.goToPage}
        />
      </Card>
    </div>
  );
};
