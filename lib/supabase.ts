import { createClient } from '@supabase/supabase-js'

// Check if Supabase environment variables are available
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Only create client if environment variables are present
export const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

// Helper function to check if Supabase is configured
export const isSupabaseConfigured = () => {
  return supabaseUrl && supabaseAnonKey && supabase !== null
}

export type Goal = {
  id: string
  name: string
  type: 'solo' | 'coop'
  max_participants: number
  duration_days: number | null
  created_at: string
  created_by: string
  emoji: string
}

export type Participant = {
  id: string
  goal_id: string
  nickname: string
  emoji: string
  joined_at: string
}

export type Checkin = {
  id: string
  goal_id: string
  participant_id: string
  checkin_date: string
  checkin_time: string
  timezone: string
}

export type GroupStreak = {
  id: string
  goal_id: string
  streak_date: string
  created_at: string
}
