"use client";

import * as echarts from "echarts/core";
import { LineChart, type LineSeriesOption } from "echarts/charts";
import {
  GridComponent,
  type GridComponentOption,
  TooltipComponent,
  type TooltipComponentOption,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import { useEffect, useRef } from "react";

echarts.use([LineChart, GridComponent, TooltipComponent, CanvasRenderer]);

type EChartsOption = echarts.ComposeOption<LineSeriesOption | GridComponentOption | TooltipComponentOption>;

const euro = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });

export function IncomeTrendChart({ labels, values }: { labels: string[]; values: number[] }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = echarts.init(containerRef.current);

    const option: EChartsOption = {
      tooltip: {
        trigger: "axis",
        valueFormatter: (value) => euro.format(Number(value)),
      },
      grid: { left: 56, right: 20, top: 20, bottom: 32 },
      xAxis: {
        type: "category",
        data: labels,
        boundaryGap: false,
      },
      yAxis: {
        type: "value",
        axisLabel: { formatter: (value: number) => euro.format(value) },
      },
      series: [
        {
          type: "line",
          smooth: true,
          symbol: "circle",
          symbolSize: 6,
          itemStyle: { color: "#9b5d43" },
          lineStyle: { color: "#9b5d43", width: 2.5 },
          areaStyle: { color: "rgba(155, 93, 67, 0.12)" },
          data: values.map((value) => value / 100),
        },
      ],
    };

    chart.setOption(option);

    const handleResize = () => chart.resize();
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      chart.dispose();
    };
  }, [labels, values]);

  return <div className="h-80 w-full" ref={containerRef} />;
}
