import { forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-xl text-sm font-medium transition-[color,background-color,border-color,box-shadow,transform] duration-200 " +
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 " +
    "active:scale-[0.99] disabled:pointer-events-none disabled:opacity-50 select-none",
  {
    variants: {
      variant: {
        primary:
          "bg-brand-600 text-white shadow-sm hover:bg-brand-700 focus-visible:outline-brand-600 active:bg-brand-800",
        secondary:
          "border border-gray-300 bg-white text-gray-700 shadow-sm hover:border-gray-400 hover:bg-gray-50 " +
          "dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:border-gray-600 dark:hover:bg-gray-800",
        ghost:
          "text-gray-600 hover:bg-gray-100/90 hover:text-gray-900 " +
          "dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100",
        danger: "bg-red-600 text-white hover:bg-red-700",
        soft:
          "bg-brand-50 text-brand-700 hover:bg-brand-100 dark:bg-brand-950/60 dark:text-brand-300 dark:hover:bg-brand-900/60",
        link: "text-brand-600 underline-offset-4 hover:underline dark:text-brand-400 p-0 h-auto",
      },
      size: {
        xs: "px-2 py-1 text-xs rounded",
        sm: "px-3 py-1.5",
        md: "px-4 py-2.5",
        lg: "px-5 py-3 text-base",
        icon: "h-10 w-10 p-0",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading && (
          <svg
            className="h-4 w-4 animate-spin"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        )}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
