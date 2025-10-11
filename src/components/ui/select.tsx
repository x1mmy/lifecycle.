/**
 * Dropdown Menu Select Component
 *
 * A customizable dropdown select component built on top of Radix UI's Select primitive.
 * Provides a clean, accessible, and highly customizable select interface for forms.
 *
 * Features:
 * - Full keyboard navigation support
 * - Screen reader accessibility
 * - Customizable styling with Tailwind CSS
 * - Scrollable dropdown with custom scrollbar
 * - Hover and focus states
 * - Custom icons and animations
 *
 * Used primarily for:
 * - Category selection in product forms
 * - Any dropdown selection needs throughout the app
 *
 * @fileoverview Reusable Dropdown Menu Select component with enhanced UI/UX
 */

"use client";

import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";

import { cn } from "~/lib/utils";

// Root component that manages the select state and context
const Select = SelectPrimitive.Root;

// Groups related select items together (optional)
const SelectGroup = SelectPrimitive.Group;

// Displays the selected value or placeholder text
const SelectValue = SelectPrimitive.Value;

/**
 * SelectTrigger Component
 *
 * The clickable button that opens the select dropdown.
 * Styled with enhanced UI/UX including:
 * - Larger height (h-11) for better touch targets
 * - Rounded corners and smooth transitions
 * - Hover and focus states with indigo accent colors
 * - Proper accessibility attributes
 */
const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      "flex h-11 w-full items-center justify-between rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm ring-offset-white transition-colors placeholder:text-gray-400 hover:border-gray-400 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1",
      className,
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="h-4 w-4 opacity-50" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

/**
 * SelectScrollUpButton Component
 *
 * Button that appears at the top of the dropdown when there are items above the visible area.
 * Allows users to scroll up through the select options.
 * Only visible when there are items to scroll to above the current view.
 */
const SelectScrollUpButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollUpButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollUpButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollUpButton
    ref={ref}
    className={cn(
      "flex cursor-default items-center justify-center py-1",
      className,
    )}
    {...props}
  >
    <ChevronUp className="h-4 w-4" />
  </SelectPrimitive.ScrollUpButton>
));
SelectScrollUpButton.displayName = SelectPrimitive.ScrollUpButton.displayName;

/**
 * SelectScrollDownButton Component
 *
 * Button that appears at the bottom of the dropdown when there are items below the visible area.
 * Allows users to scroll down through the select options.
 * Only visible when there are items to scroll to below the current view.
 */
const SelectScrollDownButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollDownButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollDownButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollDownButton
    ref={ref}
    className={cn(
      "flex cursor-default items-center justify-center py-1",
      className,
    )}
    {...props}
  >
    <ChevronDown className="h-4 w-4" />
  </SelectPrimitive.ScrollDownButton>
));
SelectScrollDownButton.displayName =
  SelectPrimitive.ScrollDownButton.displayName;

/**
 * SelectContent Component
 *
 * The dropdown container that holds all select options.
 * Features enhanced styling and scrollable behavior:
 * - Clean white background with subtle shadow
 * - Rounded corners and smooth animations
 * - Maximum height of 10.5rem (≈5 items) with scrollbar
 * - Custom scrollbar styling for better UX
 * - Responsive positioning (popper or absolute)
 */
const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = "popper", ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      className={cn(
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 relative z-50 max-h-[10.5rem] min-w-[12rem] overflow-hidden rounded-lg border border-gray-200 bg-white text-gray-900 shadow-lg",
        position === "popper" &&
          "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
        className,
      )}
      position={position}
      {...props}
    >
      <SelectScrollUpButton />
      {/* Scrollable viewport with custom scrollbar styling */}
      <SelectPrimitive.Viewport
        className={cn(
          "max-h-[10rem] overflow-y-auto p-2 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300 hover:[&::-webkit-scrollbar-thumb]:bg-gray-400 [&::-webkit-scrollbar-track]:bg-gray-100",
          position === "popper" &&
            "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]",
        )}
      >
        {children}
      </SelectPrimitive.Viewport>
      <SelectScrollDownButton />
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
));
SelectContent.displayName = SelectPrimitive.Content.displayName;

/**
 * SelectLabel Component
 *
 * Optional label component for grouping select items.
 * Provides semantic grouping and accessibility benefits.
 * Styled with proper spacing and typography.
 */
const SelectLabel = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Label
    ref={ref}
    className={cn("py-1.5 pr-2 pl-8 text-sm font-semibold", className)}
    {...props}
  />
));
SelectLabel.displayName = SelectPrimitive.Label.displayName;

/**
 * SelectItem Component
 *
 * Individual selectable option within the dropdown.
 * Enhanced with improved UI/UX features:
 * - Larger touch targets (py-2.5) for better mobile experience
 * - Smooth hover transitions with gray background
 * - Rounded corners for modern appearance
 * - Custom check icon with indigo color
 * - Proper cursor pointer for better interaction feedback
 *
 * Used for both regular options and special actions like "Add new category"
 */
const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      "focus:bg-accent focus:text-accent-foreground relative flex w-full cursor-pointer items-center rounded-md py-2.5 pr-3 pl-8 text-sm transition-colors outline-none select-none hover:bg-gray-50 data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className,
    )}
    {...props}
  >
    {/* Check icon that appears when item is selected */}
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="h-4 w-4 text-indigo-600" />
      </SelectPrimitive.ItemIndicator>
    </span>

    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
));
SelectItem.displayName = SelectPrimitive.Item.displayName;

/**
 * SelectSeparator Component
 *
 * Visual separator line between groups of select items.
 * Provides clear visual distinction between different sections of options.
 * Styled with subtle gray color and proper spacing.
 */
const SelectSeparator = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator
    ref={ref}
    className={cn("bg-muted -mx-1 my-1 h-px", className)}
    {...props}
  />
));
SelectSeparator.displayName = SelectPrimitive.Separator.displayName;

/**
 * Export all Select components for use throughout the application.
 *
 * Usage example:
 * ```tsx
 * import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
 *
 * <Select>
 *   <SelectTrigger>
 *     <SelectValue placeholder="Select an option..." />
 *   </SelectTrigger>
 *   <SelectContent>
 *     <SelectItem value="option1">Option 1</SelectItem>
 *     <SelectItem value="option2">Option 2</SelectItem>
 *   </SelectContent>
 * </Select>
 * ```
 */
export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
};
