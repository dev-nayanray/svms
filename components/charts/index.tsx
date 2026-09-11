"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

const PALETTE = ["#6366f1", "#22d3ee", "#22c55e", "#f59e0b", "#ef4444", "#a855f7", "#0d9488"];

export function SimpleBarChart({
  data,
  dataKey = "value",
  nameKey = "name",
}: {
  data: { name: string; value: number }[];
  dataKey?: string;
  nameKey?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
        <XAxis
          dataKey={nameKey}
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          interval={0}
          angle={-15}
          dy={6}
          height={48}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
          contentStyle={{
            borderRadius: "8px",
            border: "1px solid hsl(var(--border))",
            background: "hsl(var(--card))",
            fontSize: "12px",
            color: "hsl(var(--card-foreground))",
          }}
        />
        <Bar dataKey={dataKey} fill="#6366f1" radius={[3, 3, 0, 0]} maxBarSize={48} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function SimplePieChart({ data }: { data: { name: string; value: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          outerRadius={75}
          innerRadius={40}
          label={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
          strokeWidth={2}
          stroke="hsl(var(--card))"
        >
          {data.map((_, i) => (
            <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
          ))}
        </Pie>
        <Legend
          wrapperStyle={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }}
          iconType="circle"
          iconSize={8}
        />
        <Tooltip
          contentStyle={{
            borderRadius: "8px",
            border: "1px solid hsl(var(--border))",
            background: "hsl(var(--card))",
            fontSize: "12px",
            color: "hsl(var(--card-foreground))",
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
