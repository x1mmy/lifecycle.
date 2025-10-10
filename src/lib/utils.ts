// Import required dependencies for class name handling
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combines and merges class names using clsx and tailwind-merge
 * @param inputs - Array of class names or class value objects
 * @returns Merged and deduplicated class name string
 * 
 * This utility function:
 * 1. Takes any number of class name arguments
 * 2. Uses clsx to combine them into a single string
 * 3. Uses tailwind-merge to properly merge Tailwind CSS classes
 *    and remove duplicates/conflicts
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}