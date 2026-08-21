import React from 'react';

export interface CardProps {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  style?: React.CSSProperties;
}

export const Card: React.FC<CardProps> = ({
  title,
  subtitle,
  action,
  footer,
  children,
  className = '',
  bodyClassName = '',
  style
}) => {
  return (
    <div className={`card ${className}`.trim()} style={style}>
      {(title || action) && (
        <div className="card-header">
          <div>
            {title && <h3 className="card-title">{title}</h3>}
            {subtitle && <p className="card-subtitle">{subtitle}</p>}
          </div>
          {action && <div className="card-action">{action}</div>}
        </div>
      )}
      <div className={`card-body ${bodyClassName}`.trim()}>{children}</div>
      {footer && <div className="card-footer">{footer}</div>}
    </div>
  );
};
