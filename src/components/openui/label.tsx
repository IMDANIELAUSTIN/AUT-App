import * as React from "react";

import { cn } from "@/lib/utils";

type LabelProps = React.LabelHTMLAttributes<HTMLLabelElement> & {
  disabled?: boolean;
  required?: boolean;
};

const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, disabled, required, children, ...props }, ref) => (
    <label
      ref={ref}
      className={cn(
        "openui-label text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
        disabled && "cursor-not-allowed opacity-70",
        className,
      )}
      {...props}
    >
      {children}
      {required && <span aria-hidden="true"> *</span>}
    </label>
  ),
);
Label.displayName = "OpenUILabelAdapter";

export { Label };
