import React, { useState, useEffect, useCallback } from 'react';
import { Users, Search, Phone, MapPin, Gauge } from 'lucide-react';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card } from '../../components/common/Card';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import { Badge } from '../../components/common/Badge';
import { DataTable } from '../../components/common/DataTable';
import { Pagination } from '../../components/common/Pagination';
import { useAuth } from '../../context/AuthContext';
import { useDebounce } from '../../hooks/useDebounce';
import { usePagination } from '../../hooks/usePagination';
import { useToast } from '../../context/ToastContext';
import { api } from '../../services/api';
import { Customer } from '../../types';
import { formatM3 } from '../../utils/formatters';

export const CustomerList: React.FC = () => {
  const { user, role } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [rtrwFilter, setRtrwFilter] = useState<string>('');

  const debouncedSearch = useDebounce(search, 300);
  const { error: toastError } = useToast();

  const fetchCustomers = useCallback(async () => {
    try {
      setLoading(true);
      let data = await api.getCustomers({
        search: debouncedSearch,
        rt_rw: rtrwFilter
      });
      if (role === 'operator' && user?.assigned_rt && user.assigned_rt !== 'Semua RT') {
        data = data.filter((c: Customer) => c.rt_rw && c.rt_rw.includes(user.assigned_rt!));
      }
      setCustomers(data);
    } catch (err: any) {
      toastError(err.message || 'Gagal memuat data pelanggan.');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, rtrwFilter, toastError, role, user?.assigned_rt]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const pagination = usePagination(customers, { initialPageSize: 10 });

  const columns = [
    {
      header: 'ID & Nama Pelanggan',
      render: (c: Customer) => (
        <div>
          <span style={{ fontWeight: 800, color: 'var(--primary-700)', fontSize: 13.5 }}>
            {c.customer_no}
          </span>
          <div style={{ fontWeight: 700, color: 'var(--slate-900)' }}>{c.full_name}</div>
        </div>
      )
    },
    {
      header: 'Wilayah & Alamat',
      render: (c: Customer) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--slate-700)' }}>{c.rt_rw || '-'}</div>
          <div style={{ fontSize: 12, color: 'var(--slate-500)' }}>{c.address || '-'}</div>
        </div>
      )
    },
    {
      header: 'Kontak HP',
      render: (c: Customer) => (
        <span style={{ fontSize: 13, color: 'var(--slate-700)' }}>{c.phone || '-'}</span>
      )
    },
    {
      header: 'Nomor Meter',
      render: (c: Customer) => (
        <div>
          <span style={{ fontWeight: 700 }}>{c.meter_no || '-'}</span>
          <div style={{ fontSize: 11, color: 'var(--slate-500)' }}>
            Angka: {formatM3(c.current_reading)}
          </div>
        </div>
      )
    },
    {
      header: 'Tarif',
      render: (c: Customer) => <Badge variant="neutral">{c.tariff_name || 'Rumah Tangga'}</Badge>
    },
    {
      header: 'Status',
      render: (c: Customer) => <Badge status={c.status} />
    }
  ];

  return (
    <div>
      <PageHeader
        title="Daftar Pelanggan Air Minum Desa"
        subtitle="Pencarian data sambungan meteran air warga, alamat dusun, dan kontak darurat lapangan."
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

      <Card bodyClassName="p-4" style={{ marginBottom: 20 }}>
        <div className="filter-bar" style={{ margin: 0 }}>
          <div className="filter-group" style={{ flex: 1, minWidth: 260 }}>
            <div style={{ width: '100%', maxWidth: 360 }}>
              <Input
                placeholder="Cari nama, nomor pelanggan, alamat..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                leftIcon={<Search size={16} />}
              />
            </div>
          </div>

          <div className="filter-group">
            <div style={{ width: 180 }}>
              <Select
                options={[
                  { label: 'Semua RT/RW', value: '' },
                  { label: 'RT 01 / RW 01', value: 'RT 01 / RW 01' },
                  { label: 'RT 02 / RW 01', value: 'RT 02 / RW 01' },
                  { label: 'RT 03 / RW 01', value: 'RT 03 / RW 01' },
                  { label: 'RT 01 / RW 02', value: 'RT 01 / RW 02' }
                ]}
                value={rtrwFilter}
                onChange={(e) => setRtrwFilter(e.target.value)}
              />
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <DataTable
          columns={columns}
          data={pagination.paginatedItems}
          loading={loading}
          emptyTitle="Pelanggan Tidak Ditemukan"
          emptyMessage="Tidak ada data pelanggan yang cocok dengan pencarian Anda."
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
