import React from 'react';

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, action }) => {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        marginBottom: 16
      }}
    >
      <div>
        <h1 style={{ fontSize: 18, fontWeight: 800, color: 'var(--slate-900)', lineHeight: 1.2 }}>
          {title}
        </h1>
        {subtitle && (
          <p style={{ fontSize: 12.5, color: 'var(--slate-500)', marginTop: 3 }}>
            {subtitle}
          </p>
        )}
      </div>
      {action && <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>{action}</div>}
    </div>
  );
};
