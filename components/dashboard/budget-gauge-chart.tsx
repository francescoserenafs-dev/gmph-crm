"use client";

import * as echarts from "echarts/core";
import { GaugeChart, type GaugeSeriesOption } from "echarts/charts";
import { TooltipComponent, type TooltipComponentOption } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import { useEffect, useRef } from "react";

echarts.use([GaugeChart, TooltipComponent, CanvasRenderer]);

type EChartsOption = echarts.ComposeOption<GaugeSeriesOption | TooltipComponentOption>;

const euro = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });

export function BudgetGaugeChart({ achievedCents, budgetCents }: { achievedCents: number; budgetCents: number }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = echarts.init(containerRef.current);

    const percent = budgetCents > 0 ? Math.round((achievedCents / budgetCents) * 100) : 0;

    const option: EChartsOption = {
      tooltip: { formatter: () => `${euro.format(achievedCents / 100)} di ${euro.format(budgetCents / 100)}` },
      series: [
        {
          type: "gauge",
          min: 0,
          max: 100,
          startAngle: 210,
          endAngle: -30,
          progress: { show: true, width: 14, itemStyle: { color: "#9b5d43" } },
          axisLine: { lineStyle: { width: 14, color: [[1, "#eee8df"]] } },
          axisTick: { show: false },
          splitLine: { show: false },
          axisLabel: { show: false },
          pointer: { show: false },
          anchor: { show: false },
          detail: {
            valueAnimation: true,
            formatter: "{value}%",
            fontSize: 26,
            fontWeight: 600,
            color: "#27231f",
            offsetCenter: [0, "10%"],
          },
          data: [{ value: Math.min(percent, 100) }],
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
  }, [achievedCents, budgetCents]);

  return <div className="h-40 w-full" ref={containerRef} />;
}
