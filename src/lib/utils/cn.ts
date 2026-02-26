import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge Tailwind classes with proper conflict resolution.
 * Usage: cn("px-4 py-2", condition && "bg-blue-500", "text-white")
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
