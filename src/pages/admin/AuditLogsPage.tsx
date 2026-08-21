import React, { useState, useEffect, useCallback } from 'react';
import { History, Search, Shield, Filter } from 'lucide-react';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card } from '../../components/common/Card';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import { Badge } from '../../components/common/Badge';
import { DataTable } from '../../components/common/DataTable';
import { Pagination } from '../../components/common/Pagination';
import { useDebounce } from '../../hooks/useDebounce';
import { usePagination } from '../../hooks/usePagination';
import { useToast } from '../../context/ToastContext';
import { api } from '../../services/api';
import { AuditLog } from '../../types';
import { formatDateTime } from '../../utils/formatters';

export const AuditLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [actionFilter, setActionFilter] = useState<string>('');

  const debouncedSearch = useDebounce(search, 300);
  const { error: toastError } = useToast();

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getAuditLogs({
        search: debouncedSearch,
        action: actionFilter
      });
      setLogs(data);
    } catch (err: any) {
      toastError(err.message || 'Gagal memuat log audit.');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, actionFilter, toastError]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const pagination = usePagination(logs, { initialPageSize: 15 });

  const columns = [
    {
      header: 'Waktu Aktivitas',
      render: (l: AuditLog) => (
        <span style={{ fontSize: 13, color: 'var(--slate-700)' }}>
          {formatDateTime(l.created_at)}
        </span>
      )
    },
    {
      header: 'Pengguna (User)',
      render: (l: AuditLog) => (
        <div style={{ fontWeight: 700, color: 'var(--slate-900)' }}>
          {l.username}
        </div>
      )
    },
    {
      header: 'Aktivitas / Aksi',
      render: (l: AuditLog) => (
        <Badge variant={l.action.includes('DELETE') ? 'danger' : l.action.includes('PAYMENT') ? 'success' : 'info'}>
          {l.action}
        </Badge>
      )
    },
    {
      header: 'Rincian & Keterangan',
      render: (l: AuditLog) => (
        <span style={{ fontSize: 13, color: 'var(--slate-600)' }}>{l.details}</span>
      )
    }
  ];

  return (
    <div>
      <PageHeader
        title="Audit Trail & Log Aktivitas Sistem"
        subtitle="Rekam jejak setiap tindakan kritis: login, generate tagihan massal, pencatatan meter, dan penerimaan pembayaran kas."
      />

      <Card bodyClassName="p-4" style={{ marginBottom: 20 }}>
        <div className="filter-bar" style={{ margin: 0 }}>
          <div className="filter-group" style={{ flex: 1, minWidth: 260 }}>
            <div style={{ width: '100%', maxWidth: 360 }}>
              <Input
                placeholder="Cari aktivitas atau username..."
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
                  { label: 'Semua Aktivitas', value: '' },
                  { label: 'LOGIN', value: 'LOGIN' },
                  { label: 'RECORD_READING', value: 'RECORD_READING' },
                  { label: 'GENERATE_BILL', value: 'GENERATE_BILL' },
                  { label: 'RECORD_PAYMENT', value: 'RECORD_PAYMENT' },
                  { label: 'CREATE_CUSTOMER', value: 'CREATE_CUSTOMER' },
                  { label: 'DELETE_CUSTOMER', value: 'DELETE_CUSTOMER' }
                ]}
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
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
          emptyTitle="Belum Ada Log"
          emptyMessage="Tidak ada rekam jejak aktivitas yang tercatat."
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
