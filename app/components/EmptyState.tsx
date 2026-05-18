import * as React from "react";

type EmptyStateProps = {
  title: string;
  description?: string;
  action?: React.ReactNode;
};

export default function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="rounded-lg border border-dashed border-border/80 bg-card/80 p-10 text-card-foreground shadow-sm">
      <div className="mx-auto max-w-xl space-y-3 text-center">
        <div className="text-base font-semibold">{title}</div>
        {description ? (
          <div className="text-sm text-muted-foreground">{description}</div>
        ) : null}
        {action ? <div className="pt-2 flex justify-center">{action}</div> : null}
      </div>
    </div>
  );
}
