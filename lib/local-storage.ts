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
}

const USER_IDENTITY_KEY = 'yuno_user_identity'
const SOLO_GOALS_KEY = 'yuno_solo_goals'

// Utility functions
const getTodayDate = (): string => {
  return new Date().toISOString().split('T')[0]
}

const calculateStreak = (checkins: string[]): number => {
  if (checkins.length === 0) return 0
  
  const sortedDates = checkins.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
  const today = getTodayDate() // Use getTodayDate here
  
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

const hasCheckedInToday = (goal: SoloGoal): boolean => {
  const today = getTodayDate() // Use getTodayDate here
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
    goal.checkins.push(today)
    setSoloGoals(goals)
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
  hasCheckedInToday,
  calculateGroupStreak,
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
}
