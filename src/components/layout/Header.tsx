import React, { useState, useEffect } from 'react';
import { Menu, Search, Database, Cloud, HardDrive, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { DarkModeToggle } from '../common/DarkModeToggle';
import { getActiveBackend } from '../../services/api';
import { isSupabaseConfigured } from '../../services/supabaseClient';

export interface HeaderProps {
  onToggleSidebar: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onToggleSidebar }) => {
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
              gap: 5,
              fontSize: 11.5,
              fontWeight: 600,
              backgroundColor: 'var(--primary-50)',
              color: 'var(--primary-700)',
              padding: '4px 8px',
              borderRadius: 9999,
              border: '1px solid var(--primary-200)',
              transition: 'all 0.2s ease',
              whiteSpace: 'nowrap',
            }}
            className="hover-lift"
            title="Cek Tagihan Warga Mandiri"
          >
            <Search size={13} />
            <span className="desktop-text-only">Cek Tagihan</span>
          </Link>

          {/* Dynamic Backend Status Indicator (Clickable to Settings) */}
          <Link
            to="/admin/settings"
            title={`${badgeInfo.tooltip} (Klik untuk ganti database)`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 11,
              fontWeight: 600,
              backgroundColor: badgeInfo.bgColor,
              color: badgeInfo.textColor,
              padding: '3px 7px',
              borderRadius: 9999,
              border: `1px solid ${badgeInfo.borderColor}`,
              cursor: 'pointer',
              userSelect: 'none',
              transition: 'all 0.3s ease',
              whiteSpace: 'nowrap',
              textDecoration: 'none'
            }}
            className="hover-lift"
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
                flexShrink: 0
              }}
            />
            {badgeInfo.icon}
            <span className="desktop-text-only">{badgeInfo.label}</span>
          </Link>
        </div>
      </div>

      <div className="header-right" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <DarkModeToggle />
      </div>
    </header>
  );
};
