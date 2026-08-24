import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Gauge,
  Tag,
  Receipt,
  CreditCard,
  UserCheck,
  BarChart3,
  Settings,
  History,
  ClipboardPen,
  FileSpreadsheet,
  User,
  Droplets,
  LogOut,
  Megaphone,
  MessageSquareWarning,
  ArrowRightLeft,
  Key,
  Wrench
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { DarkModeToggle } from '../common/DarkModeToggle';

export interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { user, role, logout } = useAuth();
  const { settings } = useSettings();

  const handleNavClick = () => {
    if (window.innerWidth <= 1024) {
      onClose();
    }
  };

  return (
    <>
      <div className={`sidebar-overlay ${isOpen ? 'open' : ''}`} onClick={onClose} />
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        {/* Sidebar Header */}
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <Droplets size={22} />
          </div>
          <div>
            <div className="sidebar-brand-title">
              {settings.app_name || 'Sandmosquito Water'}
            </div>
            <div className="sidebar-brand-sub">{settings.village_name || 'Desa Sandmosquito'}</div>
          </div>
        </div>

        {/* Navigation Items based on Role */}
        <nav className="sidebar-nav">
          {role === 'admin' && (
            <>
              <div className="nav-section-title">Menu Utama</div>
              <NavLink to="/admin/dashboard" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={handleNavClick}>
                <span className="nav-item-icon"><LayoutDashboard size={18} /></span>
                <span>Dashboard</span>
              </NavLink>
              <NavLink to="/admin/announcements" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={handleNavClick}>
                <span className="nav-item-icon"><Megaphone size={18} /></span>
                <span>Pengumuman</span>
              </NavLink>

              <div className="nav-section-title">Layanan Warga</div>
              <NavLink to="/admin/complaints" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={handleNavClick}>
                <span className="nav-item-icon"><MessageSquareWarning size={18} /></span>
                <span>Keluhan Warga</span>
              </NavLink>
              <NavLink to="/admin/subscription-requests" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={handleNavClick}>
                <span className="nav-item-icon"><ArrowRightLeft size={18} /></span>
                <span>Pindah Golongan</span>
              </NavLink>

              <div className="nav-section-title">Kelola Air & Warga</div>
              <NavLink to="/admin/customers" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={handleNavClick}>
                <span className="nav-item-icon"><Users size={18} /></span>
                <span>Data Pelanggan</span>
              </NavLink>
              <NavLink to="/admin/meters" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={handleNavClick}>
                <span className="nav-item-icon"><Gauge size={18} /></span>
                <span>Meter Air</span>
              </NavLink>
              <NavLink to="/admin/tariffs" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={handleNavClick}>
                <span className="nav-item-icon"><Tag size={18} /></span>
                <span>Tarif Bertingkat</span>
              </NavLink>

              <div className="nav-section-title">Keuangan</div>
              <NavLink to="/admin/bills" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={handleNavClick}>
                <span className="nav-item-icon"><Receipt size={18} /></span>
                <span>Tagihan Air</span>
              </NavLink>
              <NavLink to="/admin/payments" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={handleNavClick}>
                <span className="nav-item-icon"><CreditCard size={18} /></span>
                <span>Transaksi Bayar</span>
              </NavLink>
              <NavLink to="/admin/maintenance" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={handleNavClick}>
                <span className="nav-item-icon"><Wrench size={18} /></span>
                <span>Biaya Pemeliharaan</span>
              </NavLink>
              <NavLink to="/admin/reports" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={handleNavClick}>
                <span className="nav-item-icon"><BarChart3 size={18} /></span>
                <span>Laporan & Analitik</span>
              </NavLink>

              <div className="nav-section-title">Administrasi</div>
              <NavLink to="/admin/tokens" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={handleNavClick}>
                <span className="nav-item-icon"><Key size={18} /></span>
                <span>Token Registrasi</span>
              </NavLink>
              <NavLink to="/admin/users" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={handleNavClick}>
                <span className="nav-item-icon"><UserCheck size={18} /></span>
                <span>Kelola Operator</span>
              </NavLink>
              <NavLink to="/admin/audit-logs" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={handleNavClick}>
                <span className="nav-item-icon"><History size={18} /></span>
                <span>Audit Log</span>
              </NavLink>
              <NavLink to="/admin/settings" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={handleNavClick}>
                <span className="nav-item-icon"><Settings size={18} /></span>
                <span>Pengaturan Sistem</span>
              </NavLink>
            </>
          )}

          {role === 'operator' && (
            <>
              <div className="nav-section-title">Operator Menu</div>
              <NavLink to="/operator/dashboard" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={handleNavClick}>
                <span className="nav-item-icon"><LayoutDashboard size={18} /></span>
                <span>Dashboard</span>
              </NavLink>

              <div className="nav-section-title">Operasional Lapangan</div>
              <NavLink to="/operator/readings" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={handleNavClick}>
                <span className="nav-item-icon"><ClipboardPen size={18} /></span>
                <span>Pencatatan Meter</span>
              </NavLink>
              <NavLink to="/operator/bills" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={handleNavClick}>
                <span className="nav-item-icon"><FileSpreadsheet size={18} /></span>
                <span>Generate Tagihan</span>
              </NavLink>
              <NavLink to="/operator/payments" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={handleNavClick}>
                <span className="nav-item-icon"><CreditCard size={18} /></span>
                <span>Kasir Pembayaran</span>
              </NavLink>
              <NavLink to="/operator/customers" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={handleNavClick}>
                <span className="nav-item-icon"><Users size={18} /></span>
                <span>Daftar Pelanggan</span>
              </NavLink>

              <div className="nav-section-title">Layanan Warga</div>
              <NavLink to="/operator/tokens" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={handleNavClick}>
                <span className="nav-item-icon"><Key size={18} /></span>
                <span>Token Registrasi</span>
              </NavLink>
              <NavLink to="/operator/complaints" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={handleNavClick}>
                <span className="nav-item-icon"><MessageSquareWarning size={18} /></span>
                <span>Keluhan Warga</span>
              </NavLink>
              <NavLink to="/operator/subscription-requests" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={handleNavClick}>
                <span className="nav-item-icon"><ArrowRightLeft size={18} /></span>
                <span>Pindah Golongan</span>
              </NavLink>

              <div className="nav-section-title">Laporan</div>
              <NavLink to="/operator/reports" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={handleNavClick}>
                <span className="nav-item-icon"><BarChart3 size={18} /></span>
                <span>Laporan Harian</span>
              </NavLink>
            </>
          )}

          {role === 'customer' && (
            <>
              <div className="nav-section-title">Pelanggan Air</div>
              <NavLink to="/customer/dashboard" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={handleNavClick}>
                <span className="nav-item-icon"><LayoutDashboard size={18} /></span>
                <span>Dashboard Warga</span>
              </NavLink>
              <NavLink to="/customer/usage" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={handleNavClick}>
                <span className="nav-item-icon"><Gauge size={18} /></span>
                <span>Penggunaan Air</span>
              </NavLink>
              <NavLink to="/customer/bills" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={handleNavClick}>
                <span className="nav-item-icon"><Receipt size={18} /></span>
                <span>Tagihan & Tunggakan</span>
              </NavLink>
              <NavLink to="/customer/payments" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={handleNavClick}>
                <span className="nav-item-icon"><CreditCard size={18} /></span>
                <span>Riwayat Pembayaran</span>
              </NavLink>

              <div className="nav-section-title">Bantuan & Layanan</div>
              <NavLink to="/customer/complaints" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={handleNavClick}>
                <span className="nav-item-icon"><MessageSquareWarning size={18} /></span>
                <span>Lapor Keluhan</span>
              </NavLink>
              <NavLink to="/customer/subscription-request" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={handleNavClick}>
                <span className="nav-item-icon"><ArrowRightLeft size={18} /></span>
                <span>Pindah Golongan</span>
              </NavLink>
              <NavLink to="/customer/profile" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={handleNavClick}>
                <span className="nav-item-icon"><User size={18} /></span>
                <span>Profil & Sandi</span>
              </NavLink>
            </>
          )}
        </nav>

        {/* Sidebar Footer with User Info & Logout */}
        <div className="sidebar-footer">
          <div className="user-badge-container">
            <div className="user-avatar">
              {user?.fullName ? user.fullName.substring(0, 2).toUpperCase() : 'US'}
            </div>
            <div className="user-info">
              <div className="user-name">{user?.fullName || 'Pengguna'}</div>
              <div className="user-role-label">{role}</div>
            </div>
            <DarkModeToggle style={{ padding: '4px 6px' }} />
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={logout}
            style={{ width: '100%' }}
          >
            <LogOut size={14} />
            <span>Keluar Sistem</span>
          </button>
        </div>
      </aside>
    </>
  );
};
