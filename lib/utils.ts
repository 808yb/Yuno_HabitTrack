import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function calculateStreak(checkins: string[]): number {
  if (checkins.length === 0) return 0
  
  const sortedDates = checkins.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
  const today = new Date().toISOString().split('T')[0]
  
  let streak = 0
  let currentDate = new Date(today)
  
  for (const checkinDate of sortedDates) {
    const checkinDateObj = new Date(checkinDate)
    const diffTime = currentDate.getTime() - checkinDateObj.getTime()
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
    
    if (diffDays === streak) {
      streak++
      currentDate = new Date(checkinDateObj)
    } else {
      break
    }
  }
  
  return streak
}

export function generateGoalCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = ''
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

export const EMOJI_OPTIONS = [
  '🎯', '🔥', '💪', '⭐', '🚀', '💎', '🏆', '⚡', '🌟', '🎪',
  '🎨', '📚', '🏃', '🧘', '🎵', '🌱', '☀️', '🌙', '🦄', '🐱',
  '🐶', '🐸', '🦊', '🐼', '🐨', '🦁', '🐯', '🐰', '🐻', '🐵'
]
