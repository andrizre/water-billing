import React from 'react';
import { Menu, Shield, User, Wrench, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types';

export interface HeaderProps {
  onToggleSidebar: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onToggleSidebar }) => {
  const { role, switchRoleDemo } = useAuth();

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
              fontSize: 12.5,
              fontWeight: 600,
              backgroundColor: 'var(--primary-50)',
              color: 'var(--primary-700)',
              padding: '5px 12px',
              borderRadius: 9999,
              border: '1px solid var(--primary-200)'
            }}
          >
            <Search size={14} />
            <span>Cek Tagihan Warga (Publik)</span>
          </Link>
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
