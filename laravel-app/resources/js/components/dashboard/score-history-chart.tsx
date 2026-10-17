import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
} from "recharts";
import { useTheme } from "next-themes";
import { useHasMounted } from "@/lib/use-has-mounted";

export interface ScorePoint {
  date: string; // short label e.g. "Oct 16"
  score: number;
  domain: string;
}

export function ScoreHistoryChart({ points }: { points: ScorePoint[] }) {
  const mounted = useHasMounted();
  const { resolvedTheme } = useTheme();
  if (!mounted) return <div className="h-56 animate-pulse rounded-md bg-muted" />;

  const grid = resolvedTheme === "dark" ? "#2c3831" : "#e8edea";
  const axis = resolvedTheme === "dark" ? "#93a39a" : "#5d6b64";
  const tooltipBg = resolvedTheme === "dark" ? "#161d18" : "#ffffff";

  return (
    <div className="h-56 w-full" role="img" aria-label="Approval probability history chart">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: -18 }}>
          <CartesianGrid stroke={grid} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: axis }} tickLine={false} axisLine={{ stroke: grid }} />
          <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tick={{ fontSize: 11, fill: axis }} tickLine={false} axisLine={false} />
          <ReferenceLine y={70} stroke="var(--ok)" strokeDasharray="4 4" strokeOpacity={0.6} />
          <Tooltip
            contentStyle={{
              background: tooltipBg, border: "1px solid var(--border)", borderRadius: 6, fontSize: 12,
              color: "var(--foreground)",
            }}
            formatter={(v: number) => [`${v}% approval probability`]}
            labelFormatter={(_, payload) => (payload?.[0]?.payload?.domain ? String(payload[0].payload.domain) : "")}
          />
          <Line
            type="monotone" dataKey="score" stroke="var(--primary)" strokeWidth={2.5}
            dot={{ r: 3.5, fill: "var(--primary)", strokeWidth: 0 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
