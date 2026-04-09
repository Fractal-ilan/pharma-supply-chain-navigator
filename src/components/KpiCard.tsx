import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { ReactNode } from "react";

interface KpiCardProps {
  title: string;
  value: string;
  icon: ReactNode;
  trend?: { value: number; direction: "up" | "down" | "neutral" };
  goodDirection?: "up" | "down" | "neutral";
  sparklineData?: number[];
}

export function KpiCard({ title, value, icon, trend, goodDirection = "neutral", sparklineData }: KpiCardProps) {
  const trendColor =
    !trend ? "text-muted-foreground" :
    goodDirection === "neutral" ? "text-primary" :
    (trend.direction === goodDirection) ? "text-success" : "text-destructive";

  const TrendIcon = trend?.direction === "up" ? TrendingUp : trend?.direction === "down" ? TrendingDown : Minus;

  const chartData = sparklineData?.map((v) => ({ v })) ?? [];

  return (
    <Card className="card-hover">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <span className="text-muted-foreground">{icon}</span>
      </CardHeader>
      <CardContent>
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="text-2xl font-bold">{value}</div>
            {trend && (
              <div className={`flex items-center gap-1 text-xs ${trendColor}`}>
                <TrendIcon className="h-3 w-3" />
                <span>{Math.abs(trend.value).toFixed(1)}%</span>
              </div>
            )}
          </div>
          {chartData.length > 0 && (
            <div className="h-10 w-20">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id={`spark-${title.replace(/\s/g, "")}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone"
                    dataKey="v"
                    stroke="hsl(var(--primary))"
                    fill={`url(#spark-${title.replace(/\s/g, "")})`}
                    strokeWidth={1.5}
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
