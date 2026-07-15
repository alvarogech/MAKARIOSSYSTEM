import { type InputHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/cn";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  hasError?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, hasError, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "h-11 w-full rounded-[var(--radius-sm)] border bg-white px-3 text-sm text-neutral-900",
          "placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-brand-blue",
          hasError
            ? "border-danger focus:ring-danger"
            : "border-neutral-200 focus:border-brand-blue",
          className,
        )}
        {...props}
      />
    );
  },
);

Input.displayName = "Input";
