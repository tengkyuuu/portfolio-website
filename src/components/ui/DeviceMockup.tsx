import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

type Props = {
  variant?: "laptop" | "phone";
  children: ReactNode;
  className?: string;
};

/**
 * Pure-CSS device mockup. Wraps children (a screenshot, gradient placeholder,
 * or any node) inside a stylized laptop or phone frame.
 */
export function DeviceMockup({ variant = "laptop", children, className }: Props) {
  if (variant === "phone") {
    return (
      <div
        className={cn(
          "relative mx-auto w-[200px] rounded-[28px] border border-border-strong bg-bg-elevated p-2 shadow-[0_24px_48px_-24px_rgba(0,0,0,0.8)]",
          className
        )}
      >
        <div className="absolute left-1/2 top-2.5 z-10 h-1 w-12 -translate-x-1/2 rounded-full bg-border-strong" />
        <div className="aspect-[9/19] overflow-hidden rounded-[20px] bg-bg">
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("relative", className)}>
      <div className="rounded-t-xl border border-b-0 border-border-strong bg-bg-elevated p-2.5 shadow-[0_24px_48px_-24px_rgba(0,0,0,0.8)]">
        <div className="flex items-center gap-1.5 pb-2.5 pl-1">
          <span className="h-2 w-2 rounded-full bg-border-strong" />
          <span className="h-2 w-2 rounded-full bg-border-strong" />
          <span className="h-2 w-2 rounded-full bg-border-strong" />
        </div>
        <div className="aspect-[16/10] overflow-hidden rounded-md border border-border bg-bg">
          {children}
        </div>
      </div>
      {/* Laptop base */}
      <div className="relative mx-auto h-2 w-[104%] -translate-x-[2%] rounded-b-xl bg-gradient-to-b from-border-strong to-bg-elevated" />
      <div className="mx-auto h-1.5 w-[40%] rounded-b-md bg-bg-elevated" />
    </div>
  );
}
