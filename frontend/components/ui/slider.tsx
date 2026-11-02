"use client";

import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { cn } from "@/lib/utils";

export const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn("relative flex w-full touch-none select-none items-center py-2", className)}
    {...props}
  >
    <SliderPrimitive.Track className="relative h-[3px] w-full grow overflow-hidden bg-line-2">
      <SliderPrimitive.Range className="absolute h-full bg-lime" />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb
      aria-label={props["aria-label"]}
      className="block h-4 w-2.5 bg-fg shadow-[0_0_0_3px_#151a20] transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-lime"
    />
  </SliderPrimitive.Root>
));
Slider.displayName = "Slider";
