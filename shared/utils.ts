import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function isBlank(value: string | null | undefined): boolean {
  return value == null || value.trim() === "";
}
