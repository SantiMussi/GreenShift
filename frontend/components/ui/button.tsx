import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-[12px] font-medium transition-colors duration-150 disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-3.5 [&_svg]:shrink-0 select-none",
  {
    variants: {
      variant: {
        default: "bg-fg text-bg hover:brightness-125",
        ghost: "text-fg-2 hover:text-fg hover:bg-fg/[0.04]",
        outline: "border border-line-2 text-fg-2 hover:text-fg hover:border-fg-2/60 bg-bg-2/60",
        accent: "bg-lime text-bg hover:brightness-110",
        segment:
          "text-muted hover:text-fg data-[active=true]:text-bg data-[active=true]:bg-fg",
      },
      size: {
        default: "h-8 px-3",
        sm: "h-7 px-2.5",
        icon: "h-8 w-8",
      },
    },
    defaultVariants: { variant: "outline", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";
