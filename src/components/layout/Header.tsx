import React, { useState, useEffect } from 'react';
import { Menu, Shield, User, Wrench, Search, Database, Cloud, HardDrive, RefreshCw, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getActiveBackend } from '../../services/api';
import { isSupabaseConfigured } from '../../services/supabaseClient';

export interface HeaderProps {
  onToggleSidebar: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onToggleSidebar }) => {
  const { role, switchRoleDemo } = useAuth();
  const [backend, setBackend] = useState<string>('detecting');

  useEffect(() => {
    // Check active backend
    const checkBackend = () => {
      const active = getActiveBackend();
      setBackend(active);
    };

    checkBackend();
    const interval = setInterval(checkBackend, 3000);
    return () => clearInterval(interval);
  }, []);

  const getBackendBadge = () => {
    switch (backend) {
      case 'supabase':
        return {
          label: 'Supabase Cloud',
          icon: <Cloud size={13} className="text-emerald-500" />,
          bgColor: '#ecfdf5',
          textColor: '#047857',
          borderColor: '#a7f3d0',
          dotColor: '#10b981',
          tooltip: 'Terhubung otomatis ke Supabase Cloud Database'
        };
      case 'sqlite':
        return {
          label: 'SQLite Lokal',
          icon: <HardDrive size={13} className="text-blue-500" />,
          bgColor: '#eff6ff',
          textColor: '#1d4ed8',
          borderColor: '#bfdbfe',
          dotColor: '#3b82f6',
          tooltip: 'Terhubung ke server SQLite lokal (port 3001)'
        };
      case 'gas':
        return {
          label: 'Google Sheets',
          icon: <Database size={13} className="text-amber-500" />,
          bgColor: '#fffbeb',
          textColor: '#b45309',
          borderColor: '#fde68a',
          dotColor: '#f59e0b',
          tooltip: 'Terhubung ke Google Apps Script backend'
        };
      default:
        return {
          label: isSupabaseConfigured() ? 'Supabase Ready' : 'Demo Mock',
          icon: <Zap size={13} className="text-purple-500" />,
          bgColor: '#faf5ff',
          textColor: '#7e22ce',
          borderColor: '#e9d5ff',
          dotColor: '#a855f7',
          tooltip: isSupabaseConfigured()
            ? 'Supabase siap digunakan (otomatis terhubung)'
            : 'Mode simulasi offline di browser'
        };
    }
  };

  const badgeInfo = getBackendBadge();

  return (
    <header className="top-header no-print">
      <div className="header-left">
        <button
          type="button"
          className="menu-toggle-btn"
          onClick={onToggleSidebar}
          aria-label="Toggle Menu"
        >
          <Menu size={22} />
        </button>

        <div className="header-title-badge">
          <Link
            to="/cek-tagihan"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
              fontWeight: 600,
              backgroundColor: 'var(--primary-50)',
              color: 'var(--primary-700)',
              padding: '5px 10px',
              borderRadius: 9999,
              border: '1px solid var(--primary-200)',
              transition: 'all 0.2s ease',
              whiteSpace: 'nowrap',
            }}
            className="hover-lift"
          >
            <Search size={13} />
            <span className="desktop-text-only">Cek Tagihan Warga</span>
          </Link>

          {/* Dynamic Backend Status Indicator */}
          <div
            title={badgeInfo.tooltip}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              fontSize: 11,
              fontWeight: 600,
              backgroundColor: badgeInfo.bgColor,
              color: badgeInfo.textColor,
              padding: '3px 8px',
              borderRadius: 9999,
              border: `1px solid ${badgeInfo.borderColor}`,
              cursor: 'default',
              userSelect: 'none',
              transition: 'all 0.3s ease',
              whiteSpace: 'nowrap',
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                backgroundColor: badgeInfo.dotColor,
                display: 'inline-block',
                boxShadow: `0 0 6px ${badgeInfo.dotColor}`,
                animation: 'pulse 2s infinite',
              }}
            />
            {badgeInfo.icon}
            <span>{badgeInfo.label}</span>
          </div>
        </div>
      </div>

      <div className="header-right">
        {/* Role Demo Switcher */}
        <div className="demo-role-switcher" title="Ganti role cepat untuk pengujian fitur">
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--slate-400)', padding: '0 4px' }}>
            ROLE:
          </span>
          <button
            type="button"
            className={`demo-role-btn ${role === 'admin' ? 'active' : ''}`}
            onClick={() => switchRoleDemo('admin')}
          >
            <Shield size={13} style={{ marginRight: 3, verticalAlign: -2 }} />
            Admin
          </button>
          <button
            type="button"
            className={`demo-role-btn ${role === 'operator' ? 'active' : ''}`}
            onClick={() => switchRoleDemo('operator')}
          >
            <Wrench size={13} style={{ marginRight: 3, verticalAlign: -2 }} />
            Operator
          </button>
          <button
            type="button"
            className={`demo-role-btn ${role === 'customer' ? 'active' : ''}`}
            onClick={() => switchRoleDemo('customer')}
          >
            <User size={13} style={{ marginRight: 3, verticalAlign: -2 }} />
            Customer
          </button>
        </div>
      </div>
    </header>
  );
};
