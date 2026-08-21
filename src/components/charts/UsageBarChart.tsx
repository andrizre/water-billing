import React from 'react';
import { formatM3 } from '../../utils/formatters';

export interface UsageChartData {
  period_name: string;
  usage_m3: number;
}

export interface UsageBarChartProps {
  data: UsageChartData[];
  height?: number;
  barColor?: string;
}

export const UsageBarChart: React.FC<UsageBarChartProps> = ({
  data,
  height = 240,
  barColor = 'var(--primary-500)'
}) => {
  if (!data || data.length === 0) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--slate-400)' }}>
        Belum ada riwayat pemakaian air.
      </div>
    );
  }

  const maxVal = Math.max(...data.map((d) => d.usage_m3), 10);
  const chartHeight = height - 40; // reserve 40px for labels

  return (
    <div style={{ width: '100%', height, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      <div
        style={{
          height: chartHeight,
          display: 'flex',
          alignItems: 'flex-end',
          gap: 16,
          padding: '0 8px',
          borderBottom: '1px solid var(--slate-200)'
        }}
      >
        {data.map((item, idx) => {
          const barH = Math.max(6, (item.usage_m3 / maxVal) * (chartHeight - 30));
          return (
            <div
              key={idx}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 6
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--slate-600)' }}>
                {formatM3(item.usage_m3)}
              </span>
              <div
                title={`${item.period_name}: ${item.usage_m3} m³`}
                style={{
                  width: '100%',
                  maxWidth: 48,
                  height: barH,
                  backgroundColor: barColor,
                  borderRadius: '6px 6px 0 0',
                  transition: 'height 0.3s ease',
                  background: 'linear-gradient(180deg, var(--primary-500), var(--primary-700))',
                  boxShadow: '0 2px 6px rgba(2, 132, 199, 0.2)'
                }}
              />
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 16, padding: '8px 8px 0 8px' }}>
        {data.map((item, idx) => (
          <div
            key={idx}
            style={{
              flex: 1,
              textAlign: 'center',
              fontSize: 11.5,
              fontWeight: 600,
              color: 'var(--slate-500)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}
          >
            {item.period_name}
          </div>
        ))}
      </div>
    </div>
  );
};
