import React, { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

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
  bg = 'var(--primary-50)',
  trend
}) => {
  const [displayValue, setDisplayValue] = useState<string | number>(value);
  const [isHovered, setIsHovered] = useState(false);

  // Animated update on value change
  useEffect(() => {
    setDisplayValue(value);
  }, [value]);

  return (
    <div
      className="stat-card"
      style={{
        '--stat-color': color,
        '--stat-bg': bg,
        transform: isHovered ? 'translateY(-3px)' : 'translateY(0)',
        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        cursor: 'default'
      } as React.CSSProperties}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="stat-content">
        <span className="stat-title">{title}</span>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span className="stat-value" style={{ transition: 'color 0.2s ease' }}>
            {displayValue}
          </span>
          {trend && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 2,
                fontSize: 12,
                fontWeight: 700,
                color: trend.isPositive ? 'var(--success-600)' : 'var(--danger-600)',
                backgroundColor: trend.isPositive ? 'var(--success-50)' : 'var(--danger-50)',
                padding: '2px 6px',
                borderRadius: 4,
              }}
            >
              {trend.isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {trend.value}
            </span>
          )}
        </div>
        {subtitle && <span className="stat-subtitle">{subtitle}</span>}
      </div>
      <div
        className="stat-icon"
        style={{
          transform: isHovered ? 'scale(1.08) rotate(3deg)' : 'scale(1)',
          transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {icon}
      </div>
    </div>
  );
};
