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
        gap: 16,
        marginBottom: 24
      }}
    >
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--slate-900)', lineHeight: 1.2 }}>
          {title}
        </h1>
        {subtitle && (
          <p style={{ fontSize: 13.5, color: 'var(--slate-500)', marginTop: 4 }}>
            {subtitle}
          </p>
        )}
      </div>
      {action && <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>{action}</div>}
    </div>
  );
};
