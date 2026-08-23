import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Receipt,
  CreditCard,
  ClipboardPen,
  MessageSquareWarning,
  User,
  Megaphone,
  Key
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const MobileBottomNav: React.FC = () => {
  const { role } = useAuth();

  if (!role) return null;

  return (
    <nav className="mobile-bottom-nav no-print">
      {role === 'admin' && (
        <>
          <NavLink to="/admin/dashboard" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
            <LayoutDashboard size={20} />
            <span>Dashboard</span>
          </NavLink>
          <NavLink to="/admin/bills" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
            <Receipt size={20} />
            <span>Tagihan</span>
          </NavLink>
          <NavLink to="/admin/payments" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
            <CreditCard size={20} />
            <span>Kas Masuk</span>
          </NavLink>
          <NavLink to="/admin/complaints" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
            <MessageSquareWarning size={20} />
            <span>Keluhan</span>
          </NavLink>
          <NavLink to="/admin/announcements" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
            <Megaphone size={20} />
            <span>Siaran</span>
          </NavLink>
        </>
      )}

      {role === 'operator' && (
        <>
          <NavLink to="/operator/dashboard" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
            <LayoutDashboard size={20} />
            <span>Dashboard</span>
          </NavLink>
          <NavLink to="/operator/readings" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
            <ClipboardPen size={20} />
            <span>Catat Meter</span>
          </NavLink>
          <NavLink to="/operator/payments" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
            <CreditCard size={20} />
            <span>Kasir</span>
          </NavLink>
          <NavLink to="/operator/tokens" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
            <Key size={20} />
            <span>Token</span>
          </NavLink>
          <NavLink to="/operator/complaints" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
            <MessageSquareWarning size={20} />
            <span>Keluhan</span>
          </NavLink>
        </>
      )}

      {role === 'customer' && (
        <>
          <NavLink to="/customer/dashboard" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
            <LayoutDashboard size={20} />
            <span>Home</span>
          </NavLink>
          <NavLink to="/customer/bills" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
            <Receipt size={20} />
            <span>Tagihan</span>
          </NavLink>
          <NavLink to="/customer/complaints" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
            <MessageSquareWarning size={20} />
            <span>Lapor</span>
          </NavLink>
          <NavLink to="/customer/payments" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
            <CreditCard size={20} />
            <span>Riwayat</span>
          </NavLink>
          <NavLink to="/customer/profile" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
            <User size={20} />
            <span>Profil</span>
          </NavLink>
        </>
      )}
    </nav>
  );
};
