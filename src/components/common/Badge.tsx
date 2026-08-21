import React from 'react';
import { BillStatus } from '../../types';

export interface BadgeProps {
  children?: React.ReactNode;
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  status?: BillStatus | string;
  className?: string;
  style?: React.CSSProperties;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant,
  status,
  className = '',
  style
}) => {
  let resolvedVariant = variant || 'neutral';

  if (status) {
    if (status === 'Lunas' || status === 'Aktif') {
      resolvedVariant = 'success';
    } else if (status === 'Sebagian Dibayar' || status === 'Ditangguhkan') {
      resolvedVariant = 'warning';
    } else if (status === 'Belum Dibayar' || status === 'Jatuh Tempo' || status === 'Nonaktif' || status === 'Rusak') {
      resolvedVariant = 'danger';
    } else {
      resolvedVariant = 'info';
    }
  }

  return (
    <span className={`badge badge-${resolvedVariant} ${className}`.trim()} style={style}>
      {children || status}
    </span>
  );
};
