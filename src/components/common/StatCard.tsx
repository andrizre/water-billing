import React from 'react';

export interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  color?: string;
  bg?: string;
  trend?: {
    value: number | string;
    isPositive: boolean;
  };
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  color = 'var(--primary-600)',
  bg = 'var(--primary-50)'
}) => {
  return (
    <div
      className="stat-card"
      style={{ '--stat-color': color, '--stat-bg': bg } as React.CSSProperties}
    >
      <div className="stat-content">
        <span className="stat-title">{title}</span>
        <span className="stat-value">{value}</span>
        {subtitle && <span className="stat-subtitle">{subtitle}</span>}
      </div>
      <div className="stat-icon">{icon}</div>
    </div>
  );
};
