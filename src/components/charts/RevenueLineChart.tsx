import React from 'react';
import { formatRupiah } from '../../utils/formatters';
import { MonthlyTrend } from '../../types';

export interface RevenueLineChartProps {
  data: MonthlyTrend[];
  height?: number;
}

export const RevenueLineChart: React.FC<RevenueLineChartProps> = ({ data, height = 240 }) => {
  if (!data || data.length === 0) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--slate-400)' }}>
        Belum ada data pendapatan.
      </div>
    );
  }

  const maxVal = Math.max(
    ...data.map((d) => Math.max(d.billed_amount || 0, d.collected_amount || 0)),
    50000
  );
  const chartHeight = height - 40;

  return (
    <div style={{ width: '100%', height, display: 'flex', flexDirection: 'column' }}>
      {/* Legend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12, justifyContent: 'flex-end', fontSize: 12, fontWeight: 600 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: 'var(--primary-600)' }} />
          <span>Total Tagihan</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: 'var(--success-500)' }} />
          <span>Penerimaan (Lunas)</span>
        </div>
      </div>

      {/* Chart Bars */}
      <div
        style={{
          height: chartHeight - 20,
          display: 'flex',
          alignItems: 'flex-end',
          gap: 12,
          padding: '0 8px',
          borderBottom: '1px solid var(--slate-200)'
        }}
      >
        {data.map((item, idx) => {
          const billedH = Math.max(4, ((item.billed_amount || 0) / maxVal) * (chartHeight - 40));
          const paidH = Math.max(4, ((item.collected_amount || 0) / maxVal) * (chartHeight - 40));

          return (
            <div
              key={idx}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'center',
                gap: 4
              }}
            >
              {/* Billed Bar */}
              <div
                title={`Tagihan ${item.period_name}: ${formatRupiah(item.billed_amount)}`}
                style={{
                  flex: 1,
                  maxWidth: 24,
                  height: billedH,
                  backgroundColor: 'var(--primary-500)',
                  borderRadius: '4px 4px 0 0',
                  transition: 'height 0.3s ease'
                }}
              />
              {/* Paid Bar */}
              <div
                title={`Lunas ${item.period_name}: ${formatRupiah(item.collected_amount)}`}
                style={{
                  flex: 1,
                  maxWidth: 24,
                  height: paidH,
                  backgroundColor: 'var(--success-500)',
                  borderRadius: '4px 4px 0 0',
                  transition: 'height 0.3s ease'
                }}
              />
            </div>
          );
        })}
      </div>

      {/* Bottom Labels */}
      <div style={{ display: 'flex', gap: 12, padding: '8px 8px 0 8px' }}>
        {data.map((item, idx) => (
          <div
            key={idx}
            style={{
              flex: 1,
              textAlign: 'center',
              fontSize: 11,
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
