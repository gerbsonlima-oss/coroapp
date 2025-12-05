import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-lg border px-3 py-1 text-xs font-semibold transition-all shadow-subtle backdrop-blur-sm",
  {
    variants: {
      variant: {
        default: "border-primary/20 bg-primary/15 text-primary hover:bg-primary/25 hover:shadow-glow",
        secondary: "border-border/50 bg-secondary/50 text-secondary-foreground hover:bg-secondary/70",
        destructive: "border-destructive/20 bg-destructive/15 text-destructive hover:bg-destructive/25",
        outline: "text-foreground border-border/50 hover:bg-accent/50",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
