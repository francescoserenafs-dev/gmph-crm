"use client";

import * as echarts from "echarts/core";
import { BarChart, type BarSeriesOption } from "echarts/charts";
import {
  GridComponent,
  type GridComponentOption,
  LegendComponent,
  type LegendComponentOption,
  TooltipComponent,
  type TooltipComponentOption,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import { useEffect, useRef } from "react";

echarts.use([BarChart, GridComponent, LegendComponent, TooltipComponent, CanvasRenderer]);

type EChartsOption = echarts.ComposeOption<BarSeriesOption | GridComponentOption | LegendComponentOption | TooltipComponentOption>;

export function RetentionMonthlyChart({ labels, newClients, returningClients }: { labels: string[]; newClients: number[]; returningClients: number[] }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = echarts.init(containerRef.current);
    const option: EChartsOption = {
      tooltip: { trigger: "axis" },
      legend: { top: 0, left: 0, textStyle: { color: "#675f57" } },
      grid: { left: 36, right: 12, top: 40, bottom: 28 },
      xAxis: { type: "category", data: labels },
      yAxis: { type: "value", minInterval: 1 },
      series: [
        { name: "Nuovi clienti", type: "bar", data: newClients, itemStyle: { color: "#d8b7a5" }, barGap: "10%" },
        { name: "Clienti di ritorno", type: "bar", data: returningClients, itemStyle: { color: "#668b82" } },
      ],
    };
    chart.setOption(option);
    const handleResize = () => chart.resize();
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      chart.dispose();
    };
  }, [labels, newClients, returningClients]);

  return <div className="h-80 w-full" ref={containerRef} />;
}