import { supabase, isSupabaseConfigured } from "@/lib/supabase"

export interface UserIdentity {
  nickname: string
  emoji: string
}

export interface SoloGoal {
  id: string
  name: string
  type: 'solo'
  duration_days: number | null
  created_at: string
  checkins: string[] // array of dates in YYYY-MM-DD format
  emoji: string
  // New fields for numeric goals
  goal_type?: 'habit' | 'increasing' | 'decreasing' // 'habit' is the default for backward compatibility
  current_value?: number
  target_value?: number
  start_value?: number // Starting value for decreasing goals
  unit?: string // e.g., 'kg', 'days', 'books', etc.
}

const USER_IDENTITY_KEY = 'yuno_user_identity'
const SOLO_GOALS_KEY = 'yuno_solo_goals'
const XP_STATE_KEY = 'yuno_xp_state'

// Utility functions
const getTodayDate = (): string => {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// Memoized date parsing to avoid repeated Date object creation
const parseDate = (dateStr: string): Date => {
  return new Date(dateStr)
}

// Optimized streak calculation with early termination
const calculateStreak = (checkins: string[]): number => {
  if (checkins.length === 0) return 0
  
  // Sort dates once and cache the result
  const sortedDates = checkins.sort((a, b) => b.localeCompare(a)) // String comparison is faster for ISO dates
  const today = getTodayDate()
  
  let streak = 0
  let currentDate = parseDate(today)
  
  for (const checkinDate of sortedDates) {
    const checkinDateObj = parseDate(checkinDate)
    const diffTime = currentDate.getTime() - checkinDateObj.getTime()
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
    
    if (diffDays === streak) {
      streak++
      currentDate = checkinDateObj
    } else {
      break // Early termination when streak breaks
    }
  }
  
  return streak
}

// Optimized highest streak calculation
const calculateHighestStreak = (checkins: string[]): number => {
  if (checkins.length === 0) return 0
  
  const sortedDates = checkins.sort((a, b) => a.localeCompare(b)) // String comparison is faster
  let highestStreak = 0
  let currentStreak = 0
  let previousDate: Date | null = null
  
  for (const checkinDate of sortedDates) {
    const currentDate = parseDate(checkinDate)
    
    if (previousDate === null) {
      currentStreak = 1
    } else {
      const diffTime = currentDate.getTime() - previousDate.getTime()
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
      
      if (diffDays === 1) {
        currentStreak++
      } else {
        currentStreak = 1
      }
    }
    
    highestStreak = Math.max(highestStreak, currentStreak)
    previousDate = currentDate
  }
  
  return highestStreak
}

// Optimized today check with memoization
const hasCheckedInToday = (goal: SoloGoal): boolean => {
  const today = getTodayDate()
  return goal.checkins.includes(today)
}

// Storage functions
const getUserIdentity = (): UserIdentity | null => {
  if (typeof window === 'undefined') return null
  
  const stored = localStorage.getItem(USER_IDENTITY_KEY)
  return stored ? JSON.parse(stored) : null
}

const setUserIdentity = (identity: UserIdentity): void => {
  if (typeof window === 'undefined') return
  
  localStorage.setItem(USER_IDENTITY_KEY, JSON.stringify(identity))
}

const getSoloGoals = (): SoloGoal[] => {
  if (typeof window === 'undefined') return []
  
  const stored = localStorage.getItem(SOLO_GOALS_KEY)
  return stored ? JSON.parse(stored) : []
}

const setSoloGoals = (goals: SoloGoal[]): void => {
  if (typeof window === 'undefined') return
  
  localStorage.setItem(SOLO_GOALS_KEY, JSON.stringify(goals))
}

// Fallback UUID generation function
const generateUUID = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  // Fallback for environments where crypto.randomUUID is not available
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

const addSoloGoal = (goal: Omit<SoloGoal, 'id' | 'created_at'>): SoloGoal => {
  const newGoal: SoloGoal = {
    ...goal,
    id: generateUUID(),
    created_at: new Date().toISOString(),
    emoji: goal.emoji || '🎯', // Default emoji if not provided
  }
  
  const goals = getSoloGoals()
  goals.push(newGoal)
  setSoloGoals(goals)
  
  return newGoal
}

const updateSoloGoal = (goalId: string, updates: Partial<SoloGoal>): void => {
  const goals = getSoloGoals()
  const index = goals.findIndex(g => g.id === goalId)
  
  if (index !== -1) {
    goals[index] = { ...goals[index], ...updates }
    setSoloGoals(goals)
  }
}

const addCheckinToSoloGoal = (goalId: string): void => {
  const goals = getSoloGoals()
  const goal = goals.find(g => g.id === goalId)
  
  if (goal && !hasCheckedInToday(goal)) { // Use hasCheckedInToday here
    const today = getTodayDate() // Use getTodayDate here
    const prevCount = goal.checkins.length
    goal.checkins.push(today)
    setSoloGoals(goals)

    // Award XP for habit completion according to rules
    try {
      awardXpForSoloCheckin(goal)
      // Perfect day bonus: all habit-type goals checked in today
      const allHabitGoals = goals.filter(g => !g.goal_type || g.goal_type === 'habit')
      if (allHabitGoals.length > 0 && allHabitGoals.every(g => hasCheckedInToday(g))) {
        const bonus = 20 + Math.floor(Math.random() * 31) // 20-50 inclusive
        addXp(bonus)
      }
      // Time-limited habit completion bonus
      if (goal.duration_days && goal.duration_days > 0) {
        // Trigger only when just reached completion
        if (prevCount + 1 === goal.duration_days) {
          if (goal.duration_days === 7) addXp(50)
          if (goal.duration_days === 14) addXp(100)
        }
      }
    } catch {}
  }
}

// Solo goal management functions
const deleteSoloGoal = (goalId: string): void => {
  const goals = getSoloGoals()
  const filteredGoals = goals.filter(g => g.id !== goalId)
  setSoloGoals(filteredGoals)
}

const renameSoloGoal = (goalId: string, newName: string): void => {
  updateSoloGoal(goalId, { name: newName })
}

const updateSoloGoalEmoji = (goalId: string, emoji: string): void => {
  updateSoloGoal(goalId, { emoji })
}

// New functions for numeric goals
const updateNumericGoalValue = (goalId: string, newValue: number): void => {
  const goals = getSoloGoals()
  const goal = goals.find(g => g.id === goalId)
  
  if (goal && (goal.goal_type === 'increasing' || goal.goal_type === 'decreasing')) {
    const wasCompleted = isNumericGoalCompleted(goal)
    goal.current_value = newValue
    setSoloGoals(goals)
    const nowCompleted = isNumericGoalCompleted(goal)
    if (!wasCompleted && nowCompleted) {
      // Completion bonus for increasing/decreasing goals
      addXp(100)
    }
  }
}

const isNumericGoalCompleted = (goal: SoloGoal): boolean => {
  if (!goal.goal_type || goal.goal_type === 'habit') return false
  if (goal.current_value === undefined || goal.target_value === undefined) return false
  
  if (goal.goal_type === 'increasing') {
    return goal.current_value >= goal.target_value
  } else if (goal.goal_type === 'decreasing') {
    return goal.current_value <= goal.target_value
  }
  
  return false
}

const getNumericGoalProgress = (goal: SoloGoal): { progress: number; remaining: number } => {
  if (!goal.goal_type || goal.goal_type === 'habit') {
    return { progress: 0, remaining: 0 }
  }
  
  if (goal.current_value === undefined || goal.target_value === undefined) {
    return { progress: 0, remaining: 0 }
  }
  
  let progress: number
  let remaining: number
  
  if (goal.goal_type === 'increasing') {
    progress = Math.min((goal.current_value / goal.target_value) * 100, 100)
    remaining = Math.max(goal.target_value - goal.current_value, 0)
  } else {
    // For decreasing goals, use start_value if available, otherwise estimate
    const startValue = goal.start_value || (goal.current_value + Math.abs(goal.target_value - goal.current_value))
    const totalDistance = startValue - goal.target_value
    const currentDistance = startValue - goal.current_value
    progress = Math.min((currentDistance / totalDistance) * 100, 100)
    remaining = Math.max(goal.current_value - goal.target_value, 0)
  }
  
  return { progress, remaining }
}

// =====================
// XP SYSTEM - LOCAL ONLY
// =====================

interface XpState { xp: number }

const getXpState = (): XpState => {
  if (typeof window === 'undefined') return { xp: 0 }
  const raw = localStorage.getItem(XP_STATE_KEY)
  return raw ? JSON.parse(raw) as XpState : { xp: 0 }
}

const setXpState = (state: XpState): void => {
  if (typeof window === 'undefined') return
  localStorage.setItem(XP_STATE_KEY, JSON.stringify(state))
}

const addXp = (amount: number): void => {
  if (!Number.isFinite(amount)) return
  const current = getXpState()
  const next = { xp: Math.max(0, Math.floor(current.xp + amount)) }
  setXpState(next)
}

// Leveling: level 1 requires 100 xp, each level requirement grows by 1.2x
const getLevelRequirement = (level: number): number => {
  if (level <= 1) return 100
  // requirement for this level (not cumulative)
  return Math.round(100 * Math.pow(1.2, level - 1))
}

const getLevelInfoFromXp = (totalXp: number): { level: number; currentLevelXp: number; nextLevelRequirement: number; progressPercent: number } => {
  let level = 1
  let remainingXp = Math.max(0, Math.floor(totalXp))
  while (true) {
    const req = getLevelRequirement(level)
    if (remainingXp < req) {
      const progressPercent = req === 0 ? 0 : Math.min(100, Math.max(0, (remainingXp / req) * 100))
      return { level, currentLevelXp: req - Math.max(0, req - remainingXp), nextLevelRequirement: req, progressPercent }
    }
    remainingXp -= req
    level += 1
    if (level > 9999) {
      return { level: 9999, currentLevelXp: 0, nextLevelRequirement: getLevelRequirement(9999), progressPercent: 0 }
    }
  }
}

const getStreakXpMultiplier = (streak: number): number => {
  if (streak >= 100) return 2.5
  if (streak >= 30) return 2
  if (streak >= 7) return 1.5
  return 1
}

const awardXpForSoloCheckin = (goal: SoloGoal): void => {
  // Base points: 10 per completed habit
  // Apply streak-based multiplier
  const streak = calculateStreak(goal.checkins)
  const multiplier = getStreakXpMultiplier(streak)
  const gained = Math.round(10 * multiplier)
  addXp(gained)
}

// Group streak functions
const calculateGroupStreak = (streakDates: string[]): number => {
  if (streakDates.length === 0) return 0
  
  const sortedDates = streakDates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
  const today = getTodayDate()
  
  let streak = 0
  let currentDate = new Date(today)
  
  for (const streakDate of sortedDates) {
    const streakDateObj = new Date(streakDate)
    const diffTime = currentDate.getTime() - streakDateObj.getTime()
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
    
    if (diffDays === streak) {
      streak++
      currentDate = new Date(streakDateObj)
    } else {
      break
    }
  }
  
  return streak
}

const calculateHighestGroupStreak = (streakDates: string[]): number => {
  if (streakDates.length === 0) return 0
  
  const sortedDates = streakDates.sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
  let highestStreak = 0
  let currentStreak = 0
  let previousDate: Date | null = null
  
  for (const streakDate of sortedDates) {
    const currentDate = new Date(streakDate)
    
    if (previousDate === null) {
      currentStreak = 1
    } else {
      const diffTime = currentDate.getTime() - previousDate.getTime()
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
      
      if (diffDays === 1) {
        // Consecutive day
        currentStreak++
      } else {
        // Gap in streak, reset
        currentStreak = 1
      }
    }
    
    highestStreak = Math.max(highestStreak, currentStreak)
    previousDate = currentDate
  }
  
  return highestStreak
}

const checkAndUpdateGroupStreak = async (goalId: string, participants: any[], checkins: any[]): Promise<void> => {
  if (!supabase || !isSupabaseConfigured()) return

  const today = getTodayDate()
  
  // Check if all participants have checked in today
  const todayCheckins = checkins.filter(c => c.checkin_date === today)
  const allCheckedIn = participants.every(participant => 
    todayCheckins.some(checkin => checkin.participant_id === participant.id)
  )

  if (allCheckedIn) {
    // Check if we already have a streak entry for today
    const { data: existingStreak } = await supabase
      .from('group_streaks')
      .select('*')
      .eq('goal_id', goalId)
      .eq('streak_date', today)
      .single()

    if (!existingStreak) {
      // Add new group streak entry
      await supabase
        .from('group_streaks')
        .insert({
          goal_id: goalId,
          streak_date: today
        })
    }
  }
}

// Export all functions at the end
export {
  getTodayDate,
  calculateStreak,
  calculateHighestStreak,
  hasCheckedInToday,
  calculateGroupStreak,
  calculateHighestGroupStreak,
  checkAndUpdateGroupStreak,
  getUserIdentity,
  setUserIdentity,
  getSoloGoals,
  setSoloGoals,
  addSoloGoal,
  updateSoloGoal,
  addCheckinToSoloGoal,
  deleteSoloGoal,
  renameSoloGoal,
  updateSoloGoalEmoji,
  updateNumericGoalValue,
  isNumericGoalCompleted,
  getNumericGoalProgress,
  // XP
  getXpState,
  addXp,
  getLevelInfoFromXp,
}
