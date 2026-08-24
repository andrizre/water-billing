import React, { useState, useEffect, useCallback } from 'react';
import { UserCheck, Plus, Search, Edit2, Trash2, KeyRound, Shield } from 'lucide-react';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { DataTable } from '../../components/common/DataTable';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { useToast } from '../../context/ToastContext';
import { api } from '../../services/api';
import { User } from '../../types';

export const OperatorManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [resetModalOpen, setResetModalOpen] = useState<boolean>(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [targetUser, setTargetUser] = useState<User | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [saving, setSaving] = useState<boolean>(false);

  // Form State
  const [formData, setFormData] = useState({
    username: '',
    full_name: '',
    password: '',
    role: 'operator' as any,
    assigned_rt: 'RT 01',
    email: '',
    phone: '',
    is_active: true
  });

  const [newPasswordInput, setNewPasswordInput] = useState<string>('operator123');

  const { success, error: toastError } = useToast();

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getUsers();
      // Exclude customer accounts from staff operator list for cleaner administration
      setUsers(data.filter((u: User) => u.role === 'admin' || u.role === 'operator'));
    } catch (err: any) {
      toastError(err.message || 'Gagal memuat daftar operator.');
    } finally {
      setLoading(false);
    }
  }, [toastError]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleOpenCreate = () => {
    setEditingUser(null);
    setFormData({
      username: '',
      full_name: '',
      password: '',
      role: 'operator',
      assigned_rt: 'RT 01',
      email: '',
      phone: '',
      is_active: true
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (u: User) => {
    setEditingUser(u);
    setFormData({
      username: u.username,
      full_name: u.full_name,
      password: '',
      role: u.role,
      assigned_rt: u.assigned_rt || 'Semua RT',
      email: u.email || '',
      phone: u.phone || '',
      is_active: u.is_active
    });
    setModalOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.username.trim() || !formData.full_name.trim()) {
      toastError('Username dan Nama Lengkap wajib diisi.');
      return;
    }

    setSaving(true);
    try {
      if (editingUser) {
        await api.updateUser({
          id: editingUser.id,
          ...formData
        });
        success('Data operator berhasil diperbarui.');
      } else {
        if (!formData.password) {
          toastError('Kata sandi wajib diisi untuk akun baru.');
          setSaving(false);
          return;
        }
        await api.createUser(formData);
        success('Operator baru berhasil ditambahkan.');
      }
      setModalOpen(false);
      fetchUsers();
    } catch (err: any) {
      toastError(err.message || 'Gagal menyimpan data.');
    } finally {
      setSaving(false);
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUser) return;

    setSaving(true);
    try {
      await api.resetUserPassword(targetUser.id, newPasswordInput);
      success(`Kata sandi pengguna ${targetUser.username} berhasil direset menjadi: ${newPasswordInput}`);
      setResetModalOpen(false);
    } catch (err: any) {
      toastError(err.message || 'Gagal mereset kata sandi.');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await api.deleteUser(deleteTarget.id);
      success('Pengguna berhasil dihapus.');
      setDeleteTarget(null);
      fetchUsers();
    } catch (err: any) {
      toastError(err.message || 'Gagal menghapus pengguna.');
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    {
      header: 'Username',
      render: (u: User) => (
        <span style={{ fontWeight: 800, color: 'var(--slate-900)' }}>{u.username}</span>
      )
    },
    {
      header: 'Nama Lengkap',
      render: (u: User) => (
        <div>
          <div style={{ fontWeight: 700 }}>{u.full_name}</div>
          <div style={{ fontSize: 11, color: 'var(--slate-500)' }}>
            {u.email || u.phone || '-'}
          </div>
        </div>
      )
    },
    {
      header: 'Role Akses',
      render: (u: User) => (
        <Badge variant={u.role === 'admin' ? 'info' : 'neutral'}>
          {u.role === 'admin' ? 'Administrator' : 'Operator Lapangan'}
        </Badge>
      )
    },
    {
      header: 'Wilayah Tugas (RT)',
      render: (u: User) => (
        u.role === 'operator' ? (
          <Badge variant="info">
            {u.assigned_rt || 'Semua RT'}
          </Badge>
        ) : (
          <span style={{ fontSize: 12, color: 'var(--slate-500)' }}>Semua Wilayah</span>
        )
      )
    },
    {
      header: 'Status Akun',
      render: (u: User) => <Badge status={u.is_active ? 'Aktif' : 'Nonaktif'} />
    },
    {
      header: 'Aksi',
      align: 'right' as const,
      render: (u: User) => (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
          <Button
            size="sm"
            variant="secondary"
            icon={<KeyRound size={13} />}
            onClick={() => {
              setTargetUser(u);
              setNewPasswordInput('operator123');
              setResetModalOpen(true);
            }}
          >
            Reset Sandi
          </Button>
          <Button
            size="sm"
            variant="secondary"
            icon={<Edit2 size={13} />}
            onClick={() => handleOpenEdit(u)}
          >
            Edit
          </Button>
          {u.username !== 'admin' && (
            <Button
              size="sm"
              variant="danger"
              icon={<Trash2 size={13} />}
              onClick={() => setDeleteTarget(u)}
            >
              Hapus
            </Button>
          )}
        </div>
      )
    }
  ];

  return (
    <div>
      <PageHeader
        title="Manajemen Operator & Pengguna Sistem"
        subtitle="Kelola hak akses petugas loket, penugasan wilayah RT pencatat meter, dan administrator desa."
        action={
          <Button variant="primary" icon={<Plus size={16} />} onClick={handleOpenCreate}>
            Tambah Operator Baru
          </Button>
        }
      />

      <Card title="Daftar Petugas & Administrator">
        <DataTable columns={columns} data={users} loading={loading} />
      </Card>

      {/* Create / Edit User Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        size="md"
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <UserCheck size={20} color="var(--primary-600)" />
            <span>{editingUser ? 'Edit Data Pengguna' : 'Tambah Operator / Petugas Baru'}</span>
          </div>
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)} disabled={saving}>
              Batal
            </Button>
            <Button variant="primary" onClick={handleFormSubmit} loading={saving}>
              Simpan Pengguna
            </Button>
          </>
        }
      >
        <form onSubmit={handleFormSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Input
              label="Username Akun"
              placeholder="Contoh: operator2"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              required
              disabled={!!editingUser}
            />
            <Input
              label="Nama Lengkap"
              placeholder="Contoh: Ahmad Fauzi"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              required
            />
          </div>

          {!editingUser && (
            <Input
              type="password"
              label="Kata Sandi Awal"
              placeholder="Minimal 6 karakter"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
            />
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Select
              label="Hak Akses (Role)"
              options={[
                { label: 'Operator (Pencatat & Kasir)', value: 'operator' },
                { label: 'Admin (Akses Penuh)', value: 'admin' }
              ]}
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
              required
            />
            <Select
              label="Status Akun"
              options={[
                { label: 'Aktif', value: 'true' },
                { label: 'Nonaktif', value: 'false' }
              ]}
              value={formData.is_active ? 'true' : 'false'}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.value === 'true' })}
            />
          </div>

          {formData.role === 'operator' && (
            <div style={{ marginBottom: 14 }}>
              <Select
                label="Wilayah Penugasan RT (Tugas Lapangan)"
                options={[
                  { label: 'RT 01 (Dusun Krajan)', value: 'RT 01' },
                  { label: 'RT 02 (Dusun Krajan)', value: 'RT 02' },
                  { label: 'RT 03 (Dusun Kebon)', value: 'RT 03' },
                  { label: 'RT 04 (Dusun Kebon)', value: 'RT 04' },
                  { label: 'RT 05 (Dusun Selatan)', value: 'RT 05' },
                  { label: 'Semua RT (Akses Seluruh Wilayah)', value: 'Semua RT' }
                ]}
                value={formData.assigned_rt || 'RT 01'}
                onChange={(e) => setFormData({ ...formData, assigned_rt: e.target.value })}
              />
              <div style={{ fontSize: 11.5, color: 'var(--slate-500)', marginTop: 4 }}>
                * Akun operator ini hanya akan mencatat meter dan mengelola data warga di wilayah RT yang ditugaskan.
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Input
              label="Email (Opsi)"
              placeholder="petugas@desa.id"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
            <Input
              label="No. Telepon / HP"
              placeholder="08123456789"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
          </div>
        </form>
      </Modal>

      {/* Reset Password Modal */}
      <Modal
        isOpen={resetModalOpen}
        onClose={() => setResetModalOpen(false)}
        size="sm"
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <KeyRound size={20} color="var(--primary-600)" />
            <span>Reset Kata Sandi</span>
          </div>
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setResetModalOpen(false)} disabled={saving}>
              Batal
            </Button>
            <Button variant="primary" onClick={handleResetPasswordSubmit} loading={saving}>
              Reset Sandi Sekarang
            </Button>
          </>
        }
      >
        <form onSubmit={handleResetPasswordSubmit}>
          <p style={{ fontSize: 13.5, color: 'var(--slate-600)', marginBottom: 14 }}>
            Reset kata sandi untuk pengguna <strong>{targetUser?.username}</strong> ({targetUser?.full_name}):
          </p>
          <Input
            label="Kata Sandi Baru"
            value={newPasswordInput}
            onChange={(e) => setNewPasswordInput(e.target.value)}
            required
          />
        </form>
      </Modal>

      {/* Delete Dialog */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title="Hapus Pengguna"
        message={`Apakah Anda yakin ingin menghapus pengguna "${deleteTarget?.username}"?`}
        confirmText="Hapus Pengguna"
        variant="danger"
        loading={saving}
      />
    </div>
  );
};
