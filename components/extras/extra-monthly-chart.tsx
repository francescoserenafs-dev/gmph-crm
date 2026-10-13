"use client";

import * as echarts from "echarts/core";
import { BarChart, type BarSeriesOption, LineChart, type LineSeriesOption } from "echarts/charts";
import { GridComponent, type GridComponentOption, TooltipComponent, type TooltipComponentOption } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import { useEffect, useRef } from "react";

echarts.use([BarChart, LineChart, GridComponent, TooltipComponent, CanvasRenderer]);

type EChartsOption = echarts.ComposeOption<BarSeriesOption | LineSeriesOption | GridComponentOption | TooltipComponentOption>;

const euro = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const percent = new Intl.NumberFormat("it-IT", { style: "percent", maximumFractionDigits: 1 });

export function ExtraMonthlyChart({ labels, values, kind }: { labels: string[]; values: (number | null)[]; kind: "euro" | "percent" }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = echarts.init(containerRef.current);
    const format = (value: number) => (kind === "euro" ? euro.format(value) : percent.format(value));

    const option: EChartsOption = {
      tooltip: { trigger: "axis", valueFormatter: (value) => (value === null || value === undefined || value === "-" ? "—" : format(Number(value))) },
      grid: { left: 56, right: 12, top: 16, bottom: 28 },
      xAxis: { type: "category", data: labels },
      yAxis: { type: "value", min: 0, max: kind === "percent" ? 1 : undefined, axisLabel: { formatter: (value: number) => format(value) } },
      series: [
        kind === "euro"
          ? { type: "bar", data: values.map((value) => (value === null ? 0 : value / 100)), itemStyle: { color: "#9b5d43" } }
          : { type: "line", data: values, connectNulls: false, symbol: "circle", symbolSize: 6, itemStyle: { color: "#3f6f9b" }, lineStyle: { color: "#3f6f9b", width: 2.5 } },
      ],
    };

    chart.setOption(option);
    const handleResize = () => chart.resize();
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      chart.dispose();
    };
  }, [labels, values, kind]);

  return <div className="h-64 w-full" ref={containerRef} />;
}
