'use client';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { cn } from '@/libs/utils/cn';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

export type TelemetrySeries = {
  label: string;
  color: string;
  /** One value per label; `null` where the series has no point at that label (the line skips across it). */
  data: Array<number | null>;
};

type TelemetryTimeSeriesChartProps = {
  title: string;
  subtitle?: string;
  labels: string[];
  series: TelemetrySeries[];
  yUnit?: string;
  className?: string;
};

export function TelemetryTimeSeriesChart({
  title,
  subtitle,
  labels,
  series,
  yUnit,
  className,
}: TelemetryTimeSeriesChartProps) {
  const chartData = {
    labels,
    datasets: series.map((s) => ({
      label: s.label,
      data: s.data,
      borderColor: s.color,
      backgroundColor: s.color,
      pointRadius: 2,
      pointHoverRadius: 4,
      tension: 0.3,
      borderWidth: 1.75,
      spanGaps: true,
    })),
  };

  return (
    <div className={cn('rounded-xl border border-border bg-surface-raised p-5 shadow-sm', className)}>
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-text-secondary">{subtitle}</p>}
        </div>
        {yUnit && <span className="text-xs text-text-secondary">Unit: {yUnit}</span>}
      </div>
      <Line
        data={chartData}
        aria-label={title}
        options={{
          responsive: true,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11 }, padding: 10 } },
            tooltip: { mode: 'index', intersect: false },
          },
          scales: {
            x: { grid: { display: false }, ticks: { font: { size: 10 }, maxRotation: 0 } },
            y: { ticks: { font: { size: 11 } }, grid: { color: 'rgba(0,0,0,0.04)' } },
          },
        }}
      />
    </div>
  );
}
