import * as React from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

type SelectContextValue = {
  value: string;
  onValueChange: (value: string) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
};

const SelectContext = React.createContext<SelectContextValue | null>(null);

function useSelectContext() {
  const context = React.useContext(SelectContext);
  if (!context) throw new Error("OpenUI Select components must be used inside <Select>");
  return context;
}

function Select({
  value,
  onValueChange,
  children,
}: {
  value: string;
  onValueChange: (value: string) => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <SelectContext.Provider value={{ value, onValueChange, open, setOpen }}>
      <div className="relative">{children}</div>
    </SelectContext.Provider>
  );
}

const SelectTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, children, ...props }, ref) => {
  const { open, setOpen } = useSelectContext();
  return (
    <button
      ref={ref}
      type="button"
      aria-haspopup="listbox"
      aria-expanded={open}
      onClick={() => setOpen(!open)}
      className={cn(
        "openui-select-trigger openui-select-trigger-md flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        className,
      )}
      {...props}
    >
      {children}
      <ChevronDown className="openui-select-trigger-icon h-4 w-4 opacity-70" />
    </button>
  );
});
SelectTrigger.displayName = "OpenUISelectTriggerAdapter";

function SelectValue({ placeholder = "Select..." }: { placeholder?: string }) {
  const { value } = useSelectContext();
  return <span className="truncate">{value || placeholder}</span>;
}

function SelectContent({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const { open } = useSelectContext();
  if (!open) return null;
  return (
    <div
      role="listbox"
      className={cn(
        "openui-select-content absolute z-50 mt-1 max-h-72 min-w-full overflow-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-lg",
        className,
      )}
    >
      {children}
    </div>
  );
}

const SelectItem = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { value: string }
>(({ className, children, value, ...props }, ref) => {
  const context = useSelectContext();
  const selected = context.value === value;
  return (
    <button
      ref={ref}
      type="button"
      role="option"
      aria-selected={selected}
      onClick={() => {
        context.onValueChange(value);
        context.setOpen(false);
      }}
      className={cn(
        "openui-select-item flex w-full cursor-pointer items-center rounded-sm px-2 py-1.5 text-left text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground",
        selected && "bg-accent text-accent-foreground",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
});
SelectItem.displayName = "OpenUISelectItemAdapter";

export { Select, SelectContent, SelectItem, SelectTrigger, SelectValue };
