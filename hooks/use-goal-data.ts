import { useState, useCallback, useMemo } from 'react'
import { getUserIdentity, getSoloGoals, calculateStreak, calculateHighestStreak, hasCheckedInToday, type SoloGoal } from '@/lib/local-storage'
import { supabase, type Goal, type Participant, type Checkin, type GroupStreak, isSupabaseConfigured } from '@/lib/supabase'

export function useGoalData(goalId: string) {
  const [soloGoal, setSoloGoal] = useState<SoloGoal | null>(null)
  const [groupGoal, setGroupGoal] = useState<Goal | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [checkins, setCheckins] = useState<Checkin[]>([])
  const [groupStreaks, setGroupStreaks] = useState<GroupStreak[]>([])
  const [loading, setLoading] = useState(true)

  const userIdentity = useMemo(() => getUserIdentity(), [])

  // Memoized calculations to avoid recalculation on every render
  const goalStats = useMemo(() => {
    if (soloGoal) {
      const streak = calculateStreak(soloGoal.checkins)
      const highestStreak = calculateHighestStreak(soloGoal.checkins)
      const checkedInToday = hasCheckedInToday(soloGoal)
      const isNumericGoal = soloGoal.goal_type && soloGoal.goal_type !== 'habit'
      
      return {
        streak,
        highestStreak,
        checkedInToday,
        isNumericGoal,
        totalCheckins: soloGoal.checkins.length
      }
    }
    return null
  }, [soloGoal])

  const groupStats = useMemo(() => {
    if (groupGoal && participants.length > 0) {
      const groupStreakDates = groupStreaks.map(streak => streak.streak_date)
      const groupStreak = calculateStreak(groupStreakDates)
      const highestGroupStreak = calculateHighestStreak(groupStreakDates)
      
      const today = new Date().toISOString().split('T')[0]
      const todayCheckins = checkins.filter(c => c.checkin_date === today)
      const currentParticipant = participants.find(p => p.nickname === userIdentity?.nickname)
      const userHasCheckedInToday = currentParticipant && todayCheckins.some(c => c.participant_id === currentParticipant.id)
      
      return {
        groupStreak,
        highestGroupStreak,
        userHasCheckedInToday,
        todayCheckins,
        currentParticipant
      }
    }
    return null
  }, [groupGoal, participants, groupStreaks, checkins, userIdentity])

  const loadGoal = useCallback(async () => {
    setLoading(true)
    
    try {
      // First check if it's a solo goal
      const soloGoals = getSoloGoals()
      const solo = soloGoals.find(g => g.id === goalId)
      
      if (solo) {
        setSoloGoal(solo)
        setLoading(false)
        return
      }

      // Check if Supabase is configured for group goals
      if (!isSupabaseConfigured() || !supabase) {
        throw new Error('Supabase not configured')
      }

      // Load group goal from Supabase
      const { data: goal, error: goalError } = await supabase
        .from('goals')
        .select('*')
        .eq('id', goalId)
        .single()

      if (goalError || !goal) {
        throw new Error('Goal not found')
      }

      setGroupGoal(goal)

      // Load participants
      const { data: participantsData } = await supabase
        .from('participants')
        .select('*')
        .eq('goal_id', goalId)

      setParticipants(participantsData || [])

      // Load checkins
      const { data: checkinsData } = await supabase
        .from('checkins')
        .select('*')
        .eq('goal_id', goalId)
        .order('checkin_date', { ascending: false })

      setCheckins(checkinsData || [])

      // Load group streaks
      const { data: streaksData } = await supabase
        .from('group_streaks')
        .select('*')
        .eq('goal_id', goalId)
        .order('streak_date', { ascending: false })

      setGroupStreaks(streaksData || [])
    } catch (error) {
      console.error('Error loading goal:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }, [goalId])

  const refreshSoloGoal = useCallback(() => {
    const updatedGoals = getSoloGoals()
    const updatedGoal = updatedGoals.find(g => g.id === goalId)
    if (updatedGoal) {
      setSoloGoal(updatedGoal)
    }
  }, [goalId])

  return {
    soloGoal,
    groupGoal,
    participants,
    checkins,
    groupStreaks,
    loading,
    userIdentity,
    goalStats,
    groupStats,
    loadGoal,
    refreshSoloGoal,
    setSoloGoal,
    setCheckins,
    setGroupStreaks
  }
}
