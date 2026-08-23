// Consumer-owned shadcn `chart` primitive, stubbed at the shape the skins use.
import * as React from "react";

export interface ChartConfigEntry {
  label?: React.ReactNode;
  color?: string;
  icon?: React.ComponentType;
  theme?: Record<string, string>;
}

export type ChartConfig = Record<string, ChartConfigEntry>;

export interface ChartContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  config: ChartConfig;
}

export function ChartContainer({ config: _config, ...props }: ChartContainerProps) {
  return <div {...props} />;
}

export function ChartTooltip(_props: Record<string, unknown>): React.JSX.Element {
  return <div />;
}

export function ChartTooltipContent(_props: Record<string, unknown>): React.JSX.Element {
  return <div />;
}

export function ChartLegend(_props: Record<string, unknown>): React.JSX.Element {
  return <div />;
}

export function ChartLegendContent(_props: Record<string, unknown>): React.JSX.Element {
  return <div />;
}
