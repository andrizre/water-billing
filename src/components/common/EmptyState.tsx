import React from 'react';
import { Inbox } from 'lucide-react';

export interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = 'Belum Ada Data',
  description = 'Tidak ada data yang tersedia untuk ditampilkan.',
  icon = <Inbox size={32} />,
  action
}) => {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <h4 className="empty-title">{title}</h4>
      <p className="empty-desc">{description}</p>
      {action && <div className="empty-action">{action}</div>}
    </div>
  );
};
