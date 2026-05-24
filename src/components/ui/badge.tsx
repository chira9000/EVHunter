import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
        secondary: "border-white/10 bg-white/5 text-zinc-300",
        destructive: "border-red-500/30 bg-red-500/10 text-red-400",
        warning: "border-amber-500/30 bg-amber-500/10 text-amber-400",
        elite: "border-violet-500/40 bg-violet-500/15 text-violet-300",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
