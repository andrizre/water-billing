import React, { useState, useEffect, useCallback } from 'react';
import { Gauge, Download } from 'lucide-react';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { DataTable } from '../../components/common/DataTable';
import { UsageBarChart } from '../../components/charts/UsageBarChart';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { api } from '../../services/api';
import { MeterReading } from '../../types';
import { formatM3, formatDate, formatPeriod } from '../../utils/formatters';
import { exportToCsv } from '../../utils/exportCsv';

export const CustomerUsagePage: React.FC = () => {
  const { user } = useAuth();
  const [readings, setReadings] = useState<MeterReading[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const { success, error: toastError } = useToast();

  const fetchReadings = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getReadings({ customer_id: user?.customerId });
      setReadings(data);
    } catch (err: any) {
      toastError(err.message || 'Gagal memuat riwayat pemakaian.');
    } finally {
      setLoading(false);
    }
  }, [user?.customerId, toastError]);

  useEffect(() => {
    fetchReadings();
  }, [fetchReadings]);

  const chartData = readings.map((r) => ({
    period_name: formatPeriod(r.period_month, r.period_year),
    usage_m3: r.usage_m3
  })).reverse();

  const handleExportCsv = () => {
    const headers = ['Periode', 'Tanggal Catat', 'Meter Awal', 'Meter Akhir', 'Pemakaian (m3)', 'Catatan'];
    const rows = readings.map((r) => [
      formatPeriod(r.period_month, r.period_year),
      r.reading_date,
      r.prev_reading,
      r.current_reading,
      r.usage_m3,
      r.notes || '-'
    ]);
    exportToCsv(`riwayat-pemakaian-air-${user?.username}`, headers, rows);
    success('Riwayat pemakaian berhasil diexport ke CSV.');
  };

  const columns = [
    {
      header: 'Periode Bulan',
      render: (r: MeterReading) => (
        <strong>{formatPeriod(r.period_month, r.period_year)}</strong>
      )
    },
    {
      header: 'Tanggal Catat',
      render: (r: MeterReading) => formatDate(r.reading_date)
    },
    {
      header: 'Angka Meter Awal',
      render: (r: MeterReading) => `${r.prev_reading} m³`
    },
    {
      header: 'Angka Meter Akhir',
      render: (r: MeterReading) => `${r.current_reading} m³`
    },
    {
      header: 'Total Pemakaian',
      render: (r: MeterReading) => (
        <span style={{ fontWeight: 800, color: 'var(--primary-700)', fontSize: 14 }}>
          {formatM3(r.usage_m3)}
        </span>
      )
    },
    {
      header: 'Petugas / Catatan',
      render: (r: MeterReading) => (
        <span style={{ fontSize: 12, color: 'var(--slate-500)' }}>
          {r.reader_name || 'Petugas Lapangan'} {r.notes ? `(${r.notes})` : ''}
        </span>
      )
    }
  ];

  return (
    <div>
      <PageHeader
        title="Riwayat Penggunaan Volume Air"
        subtitle="Pantau kubikasi air yang Anda gunakan setiap bulan dari angka meteran awal sampai akhir."
        action={
          <Button variant="secondary" icon={<Download size={16} />} onClick={handleExportCsv}>
            Export CSV
          </Button>
        }
      />

      <Card title="Grafik Pemakaian Air Bulanan" style={{ marginBottom: 24 }}>
        <UsageBarChart data={chartData} height={260} />
      </Card>

      <Card title="Tabel Detail Pembacaan Meter">
        {loading ? (
          <LoadingSpinner text="Memuat riwayat pemakaian air..." />
        ) : (
          <DataTable
            columns={columns}
            data={readings}
            emptyTitle="Belum Ada Riwayat"
            emptyMessage="Belum ada data pencatatan meter yang tersedia untuk akun Anda."
          />
        )}
      </Card>
    </div>
  );
};
