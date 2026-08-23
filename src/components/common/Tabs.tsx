import React from 'react';

export interface TabItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  badge?: string | number;
}

export interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (tabId: string) => void;
}

export const Tabs: React.FC<TabsProps> = ({ tabs, activeTab, onChange }) => {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        borderBottom: '1px solid var(--slate-200)',
        marginBottom: 12,
        overflowX: 'auto',
        paddingBottom: 2
      }}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 12px',
              fontSize: 13,
              fontWeight: isActive ? 700 : 500,
              color: isActive ? 'var(--primary-700)' : 'var(--slate-600)',
              backgroundColor: isActive ? 'var(--primary-50)' : 'transparent',
              border: 'none',
              borderBottom: isActive ? '2px solid var(--primary-600)' : '2px solid transparent',
              borderRadius: '6px 6px 0 0',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease'
            }}
          >
            {tab.icon && <span>{tab.icon}</span>}
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  backgroundColor: isActive ? 'var(--primary-600)' : 'var(--slate-200)',
                  color: isActive ? '#ffffff' : 'var(--slate-700)',
                  padding: '2px 8px',
                  borderRadius: 9999
                }}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
