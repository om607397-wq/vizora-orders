/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { formatCurrency } from '../utils';

interface ChartItem {
  label: string;
  value: number;
  color: string;
  percentage?: number;
}

interface DonutChartProps {
  title: string;
  items: ChartItem[];
  totalLabel: string;
  totalValue: number;
}

// Interactive Pure SVG Ring/Donut Chart for high-fidelity presentation
export const DonutChart: React.FC<DonutChartProps> = ({ title, items, totalLabel, totalValue }) => {
  const validItems = items.filter(item => item.value > 0);
  const sum = validItems.reduce((acc, item) => acc + item.value, 0) || 1;

  // SVG dimensions
  const size = 200;
  const strokeWidth = 22;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let accumulatedAngle = 0;

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl p-6 shadow-xs flex flex-col justify-between transition-all duration-300">
      <h3 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 mb-4 font-sans tracking-tight">
        {title}
      </h3>
      <div className="flex flex-col md:flex-row items-center justify-around gap-6">
        {/* SVG Circle */}
        <div className="relative w-[180px] h-[180px] flex items-center justify-center">
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
            {/* Background ring */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="#e4e4e7"
              className="dark:stroke-zinc-800"
              strokeWidth={strokeWidth - 4}
            />
            {/* Colored segments */}
            {validItems.map((item, idx) => {
              const itemPct = item.value / sum;
              const strokeLength = itemPct * circumference;
              const strokeOffset = circumference - strokeLength + accumulatedAngle;
              accumulatedAngle -= strokeLength;

              return (
                <circle
                  key={idx}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke={item.color}
                  strokeWidth={strokeWidth}
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeOffset}
                  strokeLinecap={validItems.length === 1 ? 'butt' : 'round'}
                  className="transition-all duration-500 hover:opacity-85 cursor-pointer"
                  style={{ transformOrigin: 'center' }}
                />
              );
            })}
          </svg>
          {/* Inner stats readout */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-2">
            <span className="text-[10px] uppercase tracking-wider text-zinc-400 dark:text-zinc-500 font-medium">
              {totalLabel}
            </span>
            <span className="text-lg font-bold text-zinc-900 dark:text-white mt-0.5">
              {formatCurrency(totalValue)}
            </span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-col gap-3 w-full md:w-auto min-w-[140px]">
          {items.map((item, idx) => {
            const itemPct = totalValue > 0 ? (item.value / totalValue) * 100 : 0;
            return (
              <div key={idx} className="flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-zinc-600 dark:text-zinc-300 font-medium">
                    {item.label}
                  </span>
                </div>
                <div className="text-right">
                  <span className="font-mono text-zinc-900 dark:text-white font-semibold block">
                    {formatCurrency(item.value)}
                  </span>
                  <span className="text-[10px] text-zinc-400 block -mt-0.5 font-semibold">
                    {itemPct.toFixed(1)}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

interface BarComparisonProps {
  title: string;
  items: ChartItem[];
  maxValueLabel?: string;
}

// Gorgeous elegant comparison bar meter
export const BarComparison: React.FC<BarComparisonProps> = ({ title, items }) => {
  const max = Math.max(...items.map(i => i.value), 1000);

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl p-6 shadow-xs transition-all duration-300">
      <h3 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 mb-6 font-sans tracking-tight">
        {title}
      </h3>
      <div className="space-y-5">
        {items.map((item, idx) => {
          const widthPercent = Math.min((item.value / max) * 100, 100);
          return (
            <div key={idx} className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-zinc-700 dark:text-zinc-300">{item.label}</span>
                <span className="font-mono text-zinc-950 dark:text-white">{formatCurrency(item.value)}</span>
              </div>
              <div className="h-3 w-full bg-zinc-100 dark:bg-zinc-800/80 rounded-full overflow-hidden relative">
                <div
                  className="h-full rounded-full transition-all duration-1000 ease-out"
                  style={{
                    width: `${widthPercent}%`,
                    backgroundColor: item.color
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
