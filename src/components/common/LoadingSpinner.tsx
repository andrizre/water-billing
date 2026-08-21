import React from 'react';

export interface LoadingSpinnerProps {
  text?: string;
  size?: number;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  text = 'Memuat data...',
  size = 32
}) => {
  return (
    <div className="spinner-wrapper">
      <div className="spinner" style={{ width: size, height: size }} />
      {text && <span>{text}</span>}
    </div>
  );
};
