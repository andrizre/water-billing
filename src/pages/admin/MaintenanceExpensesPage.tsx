import React, { useState, useEffect, useCallback } from "react";
import {
  Wrench,
  Plus,
  Trash2,
  Calendar,
  Filter,
  DollarSign,
  FileSpreadsheet,
  Camera,
  AlertCircle,
  Zap,
  Droplets,
  Package,
  Users
} from "lucide-react";
import { PageHeader } from "../../components/layout/PageHeader";
import { Card } from "../../components/common/Card";
import { Button } from "../../components/common/Button";
import { Input } from "../../components/common/Input";
import { Select } from "../../components/common/Select";
import { Badge } from "../../components/common/Badge";
import { Modal } from "../../components/common/Modal";
import { DataTable } from "../../components/common/DataTable";
import { StatCard } from "../../components/common/StatCard";
import { useToast } from "../../context/ToastContext";
import { api } from "../../services/api";
import { MaintenanceExpense, MaintenanceExpenseCategory } from "../../types";
import { formatRupiah, formatDate, formatDateTime, todayLocalISO } from "../../utils/formatters";
import { exportToCsv } from "../../utils/exportCsv";

const CATEGORIES: MaintenanceExpenseCategory[] = [
  "Perbaikan Pipa & Kebocoran",
  "Listrik PLN Pompa",
  "Obat & Klorin Air",
  "Suku Cadang & Meteran",
  "Honor & Operasional Lapangan",
  "Lainnya"
];

export const MaintenanceExpensesPage: React.FC = () => {
  const [expenses, setExpenses] = useState<MaintenanceExpense[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [selectedPhotoPreview, setSelectedPhotoPreview] = useState<string | null>(null);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  // Form states
  const [category, setCategory] = useState<MaintenanceExpenseCategory>("Perbaikan Pipa & Kebocoran");
  const [title, setTitle] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [expenseDate, setExpenseDate] = useState<string>(todayLocalISO());
  const [photoUrl, setPhotoUrl] = useState<string>("");

  const { success, error: toastError } = useToast();

  const fetchExpenses = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getMaintenanceExpenses({
        category: selectedCategory || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined
      });
      setExpenses(data || []);
    } catch (err: any) {
      toastError(err.message || "Gagal memuat data biaya pemeliharaan.");
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, startDate, endDate, toastError]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      toastError("Ukuran foto nota terlalu besar (maksimal 3MB).");
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      setPhotoUrl(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) {
      toastError("Masukkan jumlah nominal biaya yang valid.");
      return;
    }
    setSaving(true);
    try {
      await api.createMaintenanceExpense({
        category,
        title,
        description,
        amount: Number(amount),
        expense_date: expenseDate,
        receipt_photo_url: photoUrl,
        recorded_by: "Admin BUMDes"
      });
      success("Biaya pemeliharaan berhasil dicatat!");
      setModalOpen(false);
      setTitle("");
      setDescription("");
      setAmount("");
      setPhotoUrl("");
      fetchExpenses();
    } catch (err: any) {
      toastError(err.message || "Gagal mencatat biaya pemeliharaan.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Yakin ingin menghapus catatan biaya pemeliharaan ini?")) return;
    try {
      await api.deleteMaintenanceExpense(id);
      success("Catatan pemeliharaan berhasil dihapus.");
      fetchExpenses();
    } catch (err: any) {
      toastError(err.message || "Gagal menghapus catatan.");
    }
  };

  const handleExportCsv = () => {
    const headers = ["No. Biaya", "Kategori", "Keperluan", "Keterangan", "Nominal (Rp)", "Tanggal", "Pencatat"];
    const rows = expenses.map((e) => [
      e.expense_no,
      e.category,
      e.title,
      e.description || "-",
      e.amount,
      e.expense_date,
      e.recorded_by || "Admin"
    ]);
    exportToCsv("laporan_biaya_pemeliharaan_air.csv", headers, rows);
    success("Laporan biaya pemeliharaan berhasil diekspor!");
  };

  // Stats calculation
  const totalExpense = expenses.reduce((acc, curr) => acc + (curr.amount || 0), 0);
  const pipeLeakExpense = expenses
    .filter((e) => e.category === "Perbaikan Pipa & Kebocoran")
    .reduce((acc, curr) => acc + (curr.amount || 0), 0);
  const electricityExpense = expenses
    .filter((e) => e.category === "Listrik PLN Pompa")
    .reduce((acc, curr) => acc + (curr.amount || 0), 0);

  const getCategoryBadgeVariant = (cat: MaintenanceExpenseCategory) => {
    switch (cat) {
      case "Perbaikan Pipa & Kebocoran": return "danger";
      case "Listrik PLN Pompa": return "warning";
      case "Obat & Klorin Air": return "info";
      case "Suku Cadang & Meteran": return "neutral";
      default: return "neutral";
    }
  };

  return (
    <div className="fade-in">
      <PageHeader
        title="Biaya Pemeliharaan & Operasional Air"
        subtitle="Pencatatan pengeluaran perbaikan pipa bocor, token listrik PLN pompa, klorin tandon, dan suku cadang BUMDes."
        action={
          <div style={{ display: "flex", gap: 8 }}>
            <Button variant="secondary" icon={<FileSpreadsheet size={15} />} onClick={handleExportCsv}>
              Ekspor CSV
            </Button>
            <Button variant="primary" icon={<Plus size={16} />} onClick={() => setModalOpen(true)}>
              Catat Biaya Baru
            </Button>
          </div>
        }
      />

      {/* Stats Summary Grid */}
      <div className="responsive-grid-3" style={{ marginBottom: 24 }}>
        <StatCard
          title="Total Biaya Pemeliharaan"
          value={formatRupiah(totalExpense)}
          subtitle={`${expenses.length} transaksi pengeluaran`}
          icon={<DollarSign size={20} />}
          color="var(--danger-600)"
          bg="var(--danger-50)"
        />
        <StatCard
          title="Perbaikan Pipa & Kebocoran"
          value={formatRupiah(pipeLeakExpense)}
          subtitle="Pemeliharaan jaringan pipa warga"
          icon={<Wrench size={20} />}
          color="var(--warning-600)"
          bg="var(--warning-50)"
        />
        <StatCard
          title="Listrik PLN Pompa Desa"
          value={formatRupiah(electricityExpense)}
          subtitle="Operasional pompa air sumur"
          icon={<Zap size={20} />}
          color="var(--primary-600)"
          bg="var(--primary-50)"
        />
      </div>

      {/* Filter Card */}
      <Card style={{ marginBottom: 20 }}>
        <div className="form-grid-3" style={{ alignItems: "flex-end" }}>
          <Select
            label="Filter Kategori"
            options={[
              { label: "Semua Kategori", value: "" },
              ...CATEGORIES.map((c) => ({ label: c, value: c }))
            ]}
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          />
          <Input
            type="date"
            label="Dari Tanggal"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <Input
            type="date"
            label="Sampai Tanggal"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
      </Card>

      {/* Expenses Table */}
      <DataTable
        columns={[
          {
            header: "No. Transaksi",
            render: (e: MaintenanceExpense) => (
              <span style={{ fontWeight: 700, color: "var(--primary-700)" }}>{e.expense_no}</span>
            )
          },
          {
            header: "Tanggal",
            render: (e: MaintenanceExpense) => formatDate(e.expense_date)
          },
          {
            header: "Kategori",
            render: (e: MaintenanceExpense) => (
              <Badge variant={getCategoryBadgeVariant(e.category)}>{e.category}</Badge>
            )
          },
          {
            header: "Keperluan & Keterangan",
            render: (e: MaintenanceExpense) => (
              <div>
                <div style={{ fontWeight: 700, color: "var(--slate-900)" }}>{e.title}</div>
                {e.description && (
                  <div style={{ fontSize: 12, color: "var(--slate-500)", maxWidth: 300 }}>{e.description}</div>
                )}
              </div>
            )
          },
          {
            header: "Nominal Biaya",
            render: (e: MaintenanceExpense) => (
              <span style={{ fontWeight: 800, color: "var(--danger-700)", fontSize: 14 }}>
                {formatRupiah(e.amount)}
              </span>
            )
          },
          {
            header: "Bukti Nota",
            render: (e: MaintenanceExpense) => (
              e.receipt_photo_url ? (
                <button
                  type="button"
                  onClick={() => setSelectedPhotoPreview(e.receipt_photo_url!)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "4px 8px",
                    borderRadius: 6,
                    border: "1px solid var(--primary-200)",
                    backgroundColor: "var(--primary-50)",
                    color: "var(--primary-700)",
                    fontSize: 11.5,
                    fontWeight: 600,
                    cursor: "pointer"
                  }}
                >
                  Lihat Nota
                </button>
              ) : (
                <span style={{ fontSize: 11, color: "var(--slate-400)" }}>-</span>
              )
            )
          },
          {
            header: "Aksi",
            align: "right" as const,
            render: (e: MaintenanceExpense) => (
              <Button
                size="sm"
                variant="danger"
                icon={<Trash2 size={13} />}
                onClick={() => handleDelete(e.id)}
              >
                Hapus
              </Button>
            )
          }
        ]}
        data={expenses}
        loading={loading}
        emptyTitle="Belum Ada Biaya Pemeliharaan"
        emptyMessage="Catat pengeluaran biaya perbaikan pipa, listrik, klorin, atau suku cadang air desa."
      />

      {/* Modal Add Expense */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Catat Biaya Pemeliharaan & Operasional Air"
      >
        <form onSubmit={handleCreateExpense}>
          <Select
            label="Kategori Pemeliharaan"
            options={CATEGORIES.map((c) => ({ label: c, value: c }))}
            value={category}
            onChange={(e) => setCategory(e.target.value as any)}
            required
          />

          <Input
            label="Judul / Keperluan Pengeluaran"
            placeholder="Contoh: Perbaikan Pipa PVC 2 Inch RT 02 Dusun Barat"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />

          <div className="form-grid-2">
            <Input
              type="number"
              label="Nominal Biaya (Rp)"
              placeholder="Contoh: 150000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
            <Input
              type="date"
              label="Tanggal Pengeluaran"
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Keterangan / Rincian Belanja</label>
            <textarea
              className="form-control"
              rows={2}
              placeholder="Contoh: Pembelian lem PVC, sambungan soket, upah tukang gali tanah 1 orang"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Photo Receipt Upload */}
          <div
            style={{
              border: "1px dashed var(--slate-300)",
              padding: 12,
              borderRadius: "var(--radius-md)",
              backgroundColor: "var(--slate-50)",
              marginBottom: 16
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--slate-800)", display: "flex", alignItems: "center", gap: 6 }}>
                <Camera size={15} color="var(--primary-600)" />
                Foto Kuitansi / Nota Pembelian (Opsional)
              </span>
              {photoUrl && (
                <button
                  type="button"
                  onClick={() => setPhotoUrl("")}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--danger-600)",
                    fontSize: 11.5,
                    cursor: "pointer"
                  }}
                >
                  Hapus Foto
                </button>
              )}
            </div>

            {photoUrl ? (
              <div style={{ textAlign: "center", marginTop: 4 }}>
                <img
                  src={photoUrl}
                  alt="Nota bukti belanja"
                  style={{ maxHeight: 140, objectFit: "contain", borderRadius: 6, border: "1px solid var(--slate-200)" }}
                />
              </div>
            ) : (
              <label
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "12px 6px",
                  cursor: "pointer",
                  borderRadius: 6,
                  backgroundColor: "var(--slate-50)",
                  border: "1px solid var(--slate-200)"
                }}
              >
                <Camera size={20} color="var(--slate-400)" style={{ marginBottom: 2 }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--primary-700)" }}>
                  Upload / Foto Nota Bukti
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  style={{ display: "none" }}
                />
              </label>
            )}
          </div>

          <div className="modal-footer" style={{ padding: "14px 0 0 0" }}>
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>
              Batal
            </Button>
            <Button variant="primary" type="submit" loading={saving}>
              Simpan Biaya Pemeliharaan
            </Button>
          </div>
        </form>
      </Modal>

      {/* Photo Preview Modal */}
      {selectedPhotoPreview && (
        <Modal
          isOpen={!!selectedPhotoPreview}
          onClose={() => setSelectedPhotoPreview(null)}
          title="Bukti Nota / Kuitansi Belanja"
        >
          <div style={{ textAlign: "center", padding: 8 }}>
            <img
              src={selectedPhotoPreview}
              alt="Nota bukti"
              style={{ width: "100%", maxHeight: 420, objectFit: "contain", borderRadius: 8 }}
            />
          </div>
          <div className="modal-footer" style={{ marginTop: 16 }}>
            <Button variant="secondary" onClick={() => setSelectedPhotoPreview(null)}>
              Tutup Pratinjau
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
};

