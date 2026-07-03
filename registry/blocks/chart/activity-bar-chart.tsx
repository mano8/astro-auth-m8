"use client";

// Pure-shadcn bar chart preset (recharts-backed) for fa-auth dashboard activity:
// per-model `added` vs `updated` counts. Copied into the consumer via the
// @fa-m8-auth registry; edit freely per app.
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

export interface ActivityDatum {
  model: string;
  added: number;
  updated: number;
}

export interface ActivityBarChartProps {
  data: ActivityDatum[];
  addedLabel?: string;
  updatedLabel?: string;
  className?: string;
}

export function ActivityBarChart({
  data,
  addedLabel = "Added",
  updatedLabel = "Updated",
  className,
}: ActivityBarChartProps) {
  const chartConfig = {
    added: { label: addedLabel, color: "var(--chart-1)" },
    updated: { label: updatedLabel, color: "var(--chart-2)" },
  } satisfies ChartConfig;

  return (
    <ChartContainer config={chartConfig} className={className}>
      <BarChart accessibilityLayer data={data}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="model"
          tickLine={false}
          tickMargin={10}
          axisLine={false}
        />
        <YAxis tickLine={false} axisLine={false} allowDecimals={false} width={32} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="added" fill="var(--color-added)" radius={4} />
        <Bar dataKey="updated" fill="var(--color-updated)" radius={4} />
      </BarChart>
    </ChartContainer>
  );
}
