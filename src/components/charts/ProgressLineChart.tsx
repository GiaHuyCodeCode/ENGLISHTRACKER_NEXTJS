"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";

interface ProgressLineChartProps {
  data: any[];
}

export function ProgressLineChart({ data }: ProgressLineChartProps) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
          <XAxis 
            dataKey="date" 
            stroke="var(--color-muted-foreground)" 
            fontSize={12} 
            tickLine={false} 
            axisLine={false} 
          />
          <YAxis 
            stroke="var(--color-muted-foreground)" 
            fontSize={12} 
            tickLine={false} 
            axisLine={false} 
            domain={[0, 100]}
          />
          <Tooltip 
            contentStyle={{ backgroundColor: "var(--color-card)", borderColor: "var(--color-border)", borderRadius: "8px" }}
            itemStyle={{ color: "var(--color-primary)" }}
          />
          <Line 
            type="monotone" 
            dataKey="score" 
            stroke="var(--color-primary)" 
            strokeWidth={3}
            dot={{ fill: "var(--color-background)", stroke: "var(--color-primary)", strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6, fill: "var(--color-primary)", stroke: "var(--color-background)" }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
