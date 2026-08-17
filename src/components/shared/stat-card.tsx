/**
 * StatCard - dashboard statistics card with icon, value, label, trend.
 */
"use client";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus, type LucideIcon } from "lucide-react";

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  trendLabel?: string;
  iconColor?: string;
  iconBg?: string;
  loading?: boolean;
}

export function StatCard({
  icon: Icon,
  label,
  value,
  trend,
  trendValue,
  trendLabel,
  iconColor = "text-primary",
  iconBg = "bg-primary/10",
  loading = false,
}: StatCardProps) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5">
        {loading ? (
          <div className="space-y-3">
            <div className="h-10 w-10 rounded-lg bg-muted animate-pulse" />
            <div className="h-3 w-20 bg-muted animate-pulse rounded" />
            <div className="h-7 w-24 bg-muted animate-pulse rounded" />
            <div className="h-3 w-16 bg-muted animate-pulse rounded" />
          </div>
        ) : (
          <div className="flex items-start justify-between">
            <div className="space-y-1.5">
              <p className="text-sm font-medium text-muted-foreground">{label}</p>
              <p className="text-2xl font-bold tracking-tight">{value}</p>
              {trend && (
                <div className="flex items-center gap-1 text-xs">
                  {trend === "up" && <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />}
                  {trend === "down" && <TrendingDown className="h-3.5 w-3.5 text-red-500" />}
                  {trend === "neutral" && <Minus className="h-3.5 w-3.5 text-muted-foreground" />}
                  {trendValue && (
                    <span className={cn(
                      "font-medium",
                      trend === "up" && "text-emerald-600",
                      trend === "down" && "text-red-600",
                      trend === "neutral" && "text-muted-foreground"
                    )}>
                      {trendValue}
                    </span>
                  )}
                  {trendLabel && <span className="text-muted-foreground">{trendLabel}</span>}
                </div>
              )}
            </div>
            <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", iconBg)}>
              <Icon className={cn("h-5 w-5", iconColor)} />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
