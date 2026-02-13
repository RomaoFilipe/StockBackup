import React from "react";

export default function Loading() {
  return (
    <div className="pointer-events-none fixed inset-0 z-[120] flex items-center justify-center bg-background/35 backdrop-blur-[2px]">
      <div className="pointer-events-auto rounded-2xl border border-border/70 bg-[hsl(var(--surface-1)/0.96)] px-5 py-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
          <div>
            <p className="text-sm font-medium">A carregar</p>
            <p className="text-xs text-muted-foreground">A preparar interface...</p>
          </div>
        </div>
      </div>
    </div>
  );
}
