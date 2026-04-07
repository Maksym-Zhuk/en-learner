import { forwardRef } from "react";
import { cn } from "./utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  leftIcon?: React.ReactNode;
  rightElement?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, leftIcon, rightElement, ...props }, ref) => {
    if (leftIcon || rightElement) {
      return (
        <div className="relative flex items-center">
          {leftIcon && (
            <span className="absolute left-3 text-gray-400 dark:text-gray-500">
              {leftIcon}
            </span>
          )}
          <input
            ref={ref}
            className={cn(
              "input",
              leftIcon && "pl-10",
              rightElement && "pr-10",
              className
            )}
            {...props}
          />
          {rightElement && (
            <span className="absolute right-3">{rightElement}</span>
          )}
        </div>
      );
    }

    return (
      <input
        ref={ref}
        className={cn("input", className)}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";
