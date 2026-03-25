/**
 * Timezone Utility Module
 * Handles all time zone conversions for the system
 * System Standard: UTC in database + Local timezone display (Asia/Jerusalem by default)
 */

// Default timezone for the system (Palestine/Gaza region)
const SYSTEM_TIMEZONE = "Asia/Jerusalem";

/**
 * Format date as DD-MM-YYYY
 */
export function formatDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

/**
 * Format time as HH:MM:SS
 */
export function formatTime(date: Date): string {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

/**
 * Get current date in DD-MM-YYYY format
 */
export function getCurrentDate(): string {
  return formatDate(new Date());
}

/**
 * Get current time in HH:MM:SS format
 */
export function getCurrentTime(): string {
  return formatTime(new Date());
}

/**
 * Parse DD-MM-YYYY string to Date object (sets to start of day)
 */
export function parseDate(dateStr: string): Date | null {
  if (!dateStr || !/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) return null;
  const [day, month, year] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

/**
 * Parse HH:MM:SS string to duration in minutes
 */
export function parseTime(timeStr: string): { hours: number; minutes: number; seconds: number } | null {
  if (!timeStr) return null;
  
  const match = timeStr.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return null;
  
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const seconds = match[3] ? parseInt(match[3], 10) : 0;
  
  return { hours, minutes, seconds };
}

/**
 * Calculate duration between two times (HH:MM:SS format)
 * Returns { label: "2س 30د", decimal: 2.5 }
 */
export function calculateDuration(
  startTime: string,
  endTime: string
): { label: string; decimal: number } {
  const start = parseTime(startTime);
  const end = parseTime(endTime);
  
  if (!start || !end) {
    return { label: "—", decimal: 0 };
  }
  
  const startMinutes = start.hours * 60 + start.minutes;
  const endMinutes = end.hours * 60 + end.minutes;
  
  const diffMinutes = Math.max(0, endMinutes - startMinutes);
  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;
  
  let label = "";
  if (hours > 0) label += `${hours}س `;
  if (minutes > 0) label += `${minutes}د`;
  if (!label) label = "—";
  
  const decimal = parseFloat((diffMinutes / 60).toFixed(2));
  return { label, decimal };
}

/**
 * Calculate elapsed time from a given date and time to now
 * Returns { label: "2س 30د", decimal: 2.5 }
 */
export function calculateElapsedTime(
  entryDate: string,
  entryTime: string
): { label: string; decimal: number } {
  const start = parseDate(entryDate);
  const time = parseTime(entryTime);
  
  if (!start || !time) {
    return { label: "—", decimal: 0 };
  }
  
  const startDateTime = new Date(start);
  startDateTime.setHours(time.hours, time.minutes, time.seconds);
  
  const now = new Date();
  const elapsedMs = Math.max(0, now.getTime() - startDateTime.getTime());
  const elapsedMinutes = Math.floor(elapsedMs / 60000);
  
  const hours = Math.floor(elapsedMinutes / 60);
  const minutes = elapsedMinutes % 60;
  
  let label = "";
  if (hours > 0) label += `${hours}س `;
  if (minutes > 0 || hours === 0) label += `${minutes}د`;
  
  const decimal = parseFloat((elapsedMs / 3600000).toFixed(2));
  return { label, decimal };
}

/**
 * Compare two dates in DD-MM-YYYY format
 * Returns: -1 if a < b, 0 if a === b, 1 if a > b
 */
export function compareDates(dateA: string, dateB: string): number {
  const a = parseDate(dateA);
  const b = parseDate(dateB);
  
  if (!a || !b) return 0;
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/**
 * Get day of week name in Arabic
 */
export function getDayNameArabic(date: Date): string {
  const names = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
  return names[date.getDay()];
}

/**
 * Get day of week name for a date string (DD-MM-YYYY)
 */
export function getDayNameFromDateString(dateStr: string): string {
  const date = parseDate(dateStr);
  if (!date) return "";
  return getDayNameArabic(date);
}

/**
 * Add days to a date (DD-MM-YYYY format)
 */
export function addDays(dateStr: string, days: number): string {
  const date = parseDate(dateStr);
  if (!date) return "";
  date.setDate(date.getDate() + days);
  return formatDate(date);
}

/**
 * Calculate days remaining until a date
 */
export function getDaysRemaining(expiryDateStr: string): number | null {
  const expiry = parseDate(expiryDateStr);
  if (!expiry) return null;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const daysRemaining = Math.ceil((expiry.getTime() - today.getTime()) / 86400000);
  return daysRemaining;
}

/**
 * Validate date string format (DD-MM-YYYY)
 */
export function isValidDateFormat(dateStr: string): boolean {
  return /^\d{2}-\d{2}-\d{4}$/.test(dateStr);
}

/**
 * Validate time string format (HH:MM or HH:MM:SS)
 */
export function isValidTimeFormat(timeStr: string): boolean {
  return /^\d{1,2}:\d{2}(?::\d{2})?$/.test(timeStr);
}

/**
 * Ensure time string is in HH:MM:SS format
 */
export function normalizeTimeFormat(timeStr: string): string {
  if (!timeStr) return "";
  
  // If format is HH:MM, add :00
  if (/^\d{1,2}:\d{2}$/.test(timeStr)) {
    return timeStr + ":00";
  }
  
  return timeStr;
}

export default {
  formatDate,
  formatTime,
  getCurrentDate,
  getCurrentTime,
  parseDate,
  parseTime,
  calculateDuration,
  calculateElapsedTime,
  compareDates,
  getDayNameArabic,
  getDayNameFromDateString,
  addDays,
  getDaysRemaining,
  isValidDateFormat,
  isValidTimeFormat,
  normalizeTimeFormat,
  SYSTEM_TIMEZONE
};
