import * as React from "react";
import { Slot } from "@radix-ui/react-slot";

import { cn } from "@/lib/utils";

type LegacyVariant = "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
type LegacySize = "default" | "sm" | "lg" | "icon";

export interface ButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "type"> {
  variant?: LegacyVariant;
  size?: LegacySize;
  asChild?: boolean;
}

const legacyButtonClasses: Record<LegacyVariant, string> = {
  default: "openui-button-base-primary",
  destructive: "openui-button-base-destructive-primary",
  outline: "openui-button-base-secondary border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
  secondary: "openui-button-base-secondary bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
  ghost: "openui-button-base-tertiary shadow-none hover:bg-accent hover:text-accent-foreground",
  link: "openui-button-base-tertiary shadow-none text-primary underline-offset-4 hover:underline",
};

const legacySizeClasses: Record<LegacySize, string> = {
  default: "openui-button-base-medium h-9 px-4 py-2",
  sm: "openui-button-base-small h-8 rounded-md px-3 text-xs",
  lg: "openui-button-base-large h-10 rounded-md px-8",
  icon: "openui-button-base-small h-9 w-9 p-0",
};

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", asChild = false, children, ...props }, ref) => {
    if (asChild) {
      return (
        <Slot
          ref={ref}
          className={cn(
            "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
            legacyButtonClasses[variant],
            legacySizeClasses[size],
            className,
          )}
          {...props}
        >
          {children}
        </Slot>
      );
    }

    return (
      <button
        ref={ref}
        className={cn(
          "openui-button-base inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
          legacyButtonClasses[variant],
          legacySizeClasses[size],
          className,
        )}
        {...props}
      >
        {children}
      </button>
    );
  },
);
Button.displayName = "OpenUIButtonAdapter";

export { Button };
