import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

export interface DarkModeToggleProps {
  className?: string;
  style?: React.CSSProperties;
  showLabel?: boolean;
}

export const DarkModeToggle: React.FC<DarkModeToggleProps> = ({ className = '', style = {}, showLabel = false }) => {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={isDark ? 'Beralih ke Mode Terang' : 'Beralih ke Mode Gelap'}
      aria-label={isDark ? 'Mode Terang' : 'Mode Gelap'}
      className={`hover-lift ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        background: 'var(--slate-50)',
        border: '1px solid var(--slate-200)',
        borderRadius: 'var(--radius-md)',
        padding: '6px 10px',
        cursor: 'pointer',
        color: 'var(--slate-700)',
        fontSize: 12.5,
        fontWeight: 600,
        transition: 'all 0.2s ease',
        ...style
      }}
    >
      {isDark ? (
        <>
          <Sun size={15} color="#f59e0b" />
          {showLabel && <span>Mode Terang</span>}
        </>
      ) : (
        <>
          <Moon size={15} color="var(--slate-600)" />
          {showLabel && <span>Mode Gelap</span>}
        </>
      )}
    </button>
  );
};
