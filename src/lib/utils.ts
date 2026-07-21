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

export function toLocal2359ISOString(dateOrStr: Date | string = new Date()): string {
  const date = typeof dateOrStr === 'string' ? new Date(dateOrStr) : dateOrStr;
  const safeDate = isNaN(date.getTime()) ? new Date() : date;
  const d = new Date(
    safeDate.getFullYear(),
    safeDate.getMonth(),
    safeDate.getDate(),
    23,
    59,
    59
  );
  return d.toISOString();
}
export function generateUUID(): string {
  if (typeof window !== 'undefined' && typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // RFC4122 v4 compliant uuid generator
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
