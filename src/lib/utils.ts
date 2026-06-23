import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function toLocalDateString(dateOrStr: Date | string = new Date()): string {
  const date = typeof dateOrStr === 'string' ? new Date(dateOrStr) : dateOrStr;
  // If parsing fails, fallback to current date or a safe value
  if (isNaN(date.getTime())) {
    return new Date().toISOString().split('T')[0];
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
