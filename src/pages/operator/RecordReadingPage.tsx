import React, { useState, useEffect, useCallback } from 'react';
import {
  ClipboardPen,
  Plus,
  Search,
  CheckCircle2,
  Gauge,
  Calendar,
  FileText
} from 'lucide-react';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import { Modal } from '../../components/common/Modal';
import { DataTable } from '../../components/common/DataTable';
import { Pagination } from '../../components/common/Pagination';
import { usePagination } from '../../hooks/usePagination';
import { useToast } from '../../context/ToastContext';
import { api } from '../../services/api';
import { Customer, MeterReading } from '../../types';
import { formatM3, formatDate, formatPeriod, INDONESIAN_MONTHS } from '../../utils/formatters';

export const RecordReadingPage: React.FC = () => {
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

  const { success, error: toastError } = useToast();

  const fetchCustomers = useCallback(async () => {
    try {
      const custs = await api.getCustomers();
      const active = custs.filter((c: Customer) => c.status === 'Aktif');
      setCustomers(active);
      if (active.length > 0 && !selectedCustomerId) {
        setSelectedCustomerId(active[0].id);
      }
    } catch (e) {
      console.error(e);
    }
  }, [selectedCustomerId]);

  const fetchReadings = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getReadings({
        period_month: periodMonth,
        period_year: periodYear
      });
      setReadings(data);
    } catch (err: any) {
      toastError(err.message || 'Gagal memuat catatan meter.');
    } finally {
      setLoading(false);
    }
  }, [periodMonth, periodYear, toastError]);

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

  const handleOpenConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId) {
      toastError('Pilih pelanggan terlebih dahulu.');
      return;
    }
    if (curVal < prevReading) {
      toastError(`Angka meter (${curVal}) tidak boleh lebih kecil dari meter sebelumnya (${prevReading}).`);
      return;
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
        notes
      });

      success(`Pencatatan meter berhasil! Pemakaian: ${calculatedUsage} m³.`);
      setConfirmModalOpen(false);
      fetchReadings();
      setNotes('');
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
      header: 'Tanggal Catat',
      render: (r: MeterReading) => formatDate(r.reading_date)
    }
  ];

  return (
    <div>
      <PageHeader
        title="Pencatatan Meteran Air Bulanan"
        subtitle="Input angka pembacaan meter fisik air di lapangan dengan kalkulasi volume kubikasi otomatis."
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
                label: `${c.customer_no} - ${c.full_name} (${c.rt_rw})`,
                value: c.id
              }))}
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              required
            />

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
