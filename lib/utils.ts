import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Optimized date utilities
const DATE_CACHE = new Map<string, Date>()

export const parseDateCached = (dateStr: string): Date => {
  if (!DATE_CACHE.has(dateStr)) {
    DATE_CACHE.set(dateStr, new Date(dateStr))
  }
  return DATE_CACHE.get(dateStr)!
}

export const getTodayDate = (): string => {
  return new Date().toISOString().split('T')[0]
}

// Optimized string comparison for ISO dates (faster than Date object creation)
export const compareDates = (a: string, b: string): number => {
  return a.localeCompare(b)
}

// Optimized streak calculation with caching
export function calculateStreak(checkins: string[]): number {
  if (checkins.length === 0) return 0
  
  const sortedDates = checkins.sort(compareDates).reverse()
  const today = getTodayDate()
  
  let streak = 0
  let currentDate = parseDateCached(today)
  
  for (const checkinDate of sortedDates) {
    const checkinDateObj = parseDateCached(checkinDate)
    const diffTime = currentDate.getTime() - checkinDateObj.getTime()
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
    
    if (diffDays === streak) {
      streak++
      currentDate = checkinDateObj
    } else {
      break
    }
  }
  
  return streak
}

// Optimized goal code generation
export function generateGoalCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = ''
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

// Debounce utility for performance
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout
  return (...args: Parameters<T>) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

// Throttle utility for performance
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => inThrottle = false, limit)
    }
  }
}

// Memoization utility
export function memoize<T extends (...args: any[]) => any>(
  func: T,
  resolver?: (...args: Parameters<T>) => string
): T {
  const cache = new Map<string, ReturnType<T>>()
  
  return ((...args: Parameters<T>) => {
    const key = resolver ? resolver(...args) : JSON.stringify(args)
    if (cache.has(key)) {
      return cache.get(key)
    }
    const result = func(...args)
    cache.set(key, result)
    return result
  }) as T
}

export const EMOJI_OPTIONS = [
  '🎯', '🔥', '💪', '⭐', '🚀', '💎', '🏆', '⚡', '🌟', '🎪',
  '🎨', '📚', '🏃', '🧘', '🎵', '🌱', '☀️', '🌙', '🦄', '🐱',
  '🐶', '🐸', '🦊', '🐼', '🐨', '🦁', '🐯', '🐰', '🐻', '🐵'
]
