'use client';

import React from 'react';
import { Line, LineChart, CartesianGrid, XAxis, YAxis, Legend, ResponsiveContainer } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';

export interface TrendChartSeries {
  dataKey: string;
  label: string;
  color: string;
  yAxisId?: 'left' | 'right';
  unit?: string;
}

interface TrendChartProps {
  data: any[];
  series: TrendChartSeries[];
  title?: string;
}

export function TrendChart({ data, series, title }: TrendChartProps) {
  const chartConfig: ChartConfig = {};
  series.forEach((s) => {
    chartConfig[s.dataKey] = {
      label: s.label,
      color: s.color,
    };
  });

  const hasRightAxis = series.some((s) => s.yAxisId === 'right');

  return (
    <div className="flex h-full flex-col gap-4">
      {title && (
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold">{title}</h3>
        </div>
      )}
      <ChartContainer config={chartConfig} className="aspect-auto h-[240px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              fontSize={12}
            />
            <YAxis
              yAxisId="left"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              fontSize={12}
            />
            {hasRightAxis && (
              <YAxis
                yAxisId="right"
                orientation="right"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                fontSize={12}
              />
            )}
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value, name) => {
                    const s = series.find((item) => item.dataKey === name);
                    const unit = s?.unit || '';
                    const label = s?.label || String(name);
                    return [`${value}${unit}`, label];
                  }}
                />
              }
            />
            <Legend verticalAlign="top" height={36} iconType="circle" />
            {series.map((s) => (
              <Line
                key={s.dataKey}
                yAxisId={s.yAxisId || 'left'}
                type="monotone"
                dataKey={s.dataKey}
                stroke={s.color}
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </ChartContainer>
    </div>
  );
}
