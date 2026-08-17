/**
 * Circular progress gauge - used for hiring probability display.
 */
"use client";
import { cn } from "@/lib/utils";

interface CircularProgressProps {
  value: number; // 0..1
  size?: number;
  strokeWidth?: number;
  label?: string;
  sublabel?: string;
  color?: "success" | "danger" | "primary";
  className?: string;
  children?: React.ReactNode;
}

export function CircularProgress({
  value,
  size = 200,
  strokeWidth = 14,
  label,
  sublabel,
  color = "primary",
  className,
  children,
}: CircularProgressProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(1, value));
  const offset = circumference - clamped * circumference;

  const colors = {
    success: "stroke-emerald-500",
    danger: "stroke-red-500",
    primary: "stroke-primary",
  };
  const textColors = {
    success: "text-emerald-500",
    danger: "text-red-500",
    primary: "text-primary",
  };

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          className="stroke-muted fill-none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={cn("fill-none transition-all duration-1000 ease-out", colors[color])}
          style={{ transition: "stroke-dashoffset 1s ease-out" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {children ?? (
          <>
            <div className={cn("text-4xl font-bold", textColors[color])}>
              {(clamped * 100).toFixed(1)}%
            </div>
            {label && <div className="mt-1 text-sm font-medium text-muted-foreground">{label}</div>}
            {sublabel && <div className={cn("mt-2 text-lg font-bold uppercase", textColors[color])}>{sublabel}</div>}
          </>
        )}
      </div>
    </div>
  );
}
