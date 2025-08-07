"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { getUserIdentity, getSoloGoals, type UserIdentity, type SoloGoal, hasCheckedInToday, calculateStreak, calculateGroupStreak } from "@/lib/local-storage"
import { supabase, type Goal, type Participant, type GroupStreak, isSupabaseConfigured } from "@/lib/supabase"
import { Plus, Users, User, Target, Flame, Menu, X } from 'lucide-react'
import Link from "next/link"
import { FirstHabitOnboarding } from "@/components/first-habit-onboarding"

export default function HomePage() {
  const [userIdentity, setUserIdentity] = useState<UserIdentity | null>(null)
  const [soloGoals, setSoloGoals] = useState<SoloGoal[]>([])
  const [groupGoals, setGroupGoals] = useState<(Goal & { participants: Participant[]; streaks: GroupStreak[] })[]>([])
  const [loading, setLoading] = useState(true)
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)

  useEffect(() => {
    const identity = getUserIdentity()
    setUserIdentity(identity)
    
    if (identity) {
      // Load solo goals
      const solo = getSoloGoals()
      setSoloGoals(solo)
      
      // Check if this is a new user (no goals yet)
      if (solo.length === 0) {
        setShowOnboarding(true)
      }
      
      // Load group goals where user is a participant
      loadGroupGoals(identity.nickname)
    } else {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (userIdentity) {
      setLoading(false)
    }
  }, [userIdentity])

  const loadGroupGoals = async (nickname: string) => {
    // Skip if Supabase is not configured
    if (!isSupabaseConfigured() || !supabase) {
      return
    }

    try {
      const { data: participants } = await supabase
        .from('participants')
        .select(`
          goal_id,
          goals (
            id,
            name,
            type,
            max_participants,
            duration_days,
            created_at,
            created_by
          )
        `)
        .eq('nickname', nickname)

      if (participants) {
        const goalIds = participants.map(p => p.goal_id)
        
        if (goalIds.length > 0) {
          const { data: allParticipants } = await supabase
            .from('participants')
            .select('*')
            .in('goal_id', goalIds)

          const { data: allStreaks } = await supabase
            .from('group_streaks')
            .select('*')
            .in('goal_id', goalIds)

          const goalsWithParticipants = participants
            .filter(p => p.goals) // Filter out any null goals
            .map(p => ({
              ...(p.goals as unknown as Goal),
              participants: allParticipants?.filter(ap => ap.goal_id === p.goal_id) || [],
              streaks: allStreaks?.filter(s => s.goal_id === p.goal_id) || []
            })) as (Goal & { participants: Participant[]; streaks: GroupStreak[] })[]

          setGroupGoals(goalsWithParticipants)
        }
      }
    } catch (error) {
      console.error('Error loading group goals:', error)
    }
  }

  const handleOnboardingComplete = () => {
    setShowOnboarding(false)
    // Refresh goals after onboarding
    const solo = getSoloGoals()
    setSoloGoals(solo)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="text-4xl mb-4">🎯</div>
          <div className="text-lg text-gray-600">Loading Yuno...</div>
        </div>
      </div>
    )
  }

  if (!userIdentity) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md mx-auto">
          <CardHeader className="text-center">
            <div className="text-6xl mb-4">🎯</div>
            <CardTitle className="text-2xl">Welcome to Yuno</CardTitle>
            <CardDescription>
              Yuno you gotta check in. A minimalist habit tracker for you and your friends.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/setup">
              <Button className="w-full" size="lg">
                Get Started
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Show onboarding for new users
  if (showOnboarding) {
    return <FirstHabitOnboarding onComplete={handleOnboardingComplete} userIdentity={userIdentity} />
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-4 sm:py-8">
        {/* Mobile Header */}
        <div className="flex items-center justify-between mb-6 sm:mb-8">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="text-2xl sm:text-3xl">🎯</div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Yuno</h1>
              <p className="text-xs sm:text-sm text-gray-600 truncate max-w-[150px] sm:max-w-none">
                Hey {userIdentity.emoji} {userIdentity.nickname}!
              </p>
            </div>
          </div>
          
          {/* Desktop Navigation */}
          <div className="hidden sm:flex gap-2">
            <Link href="/create">
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Create Goal
              </Button>
            </Link>
            <Link href="/join">
              <Button variant="outline">
                <Users className="w-4 h-4 mr-2" />
                Join Goal
              </Button>
            </Link>
            <Link href="/profile">
              <Button variant="ghost" size="sm">
                <User className="w-4 h-4 mr-2" />
                Profile
              </Button>
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <Button
            variant="ghost"
            size="sm"
            className="sm:hidden"
            onClick={() => setShowMobileMenu(!showMobileMenu)}
          >
            {showMobileMenu ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>

        {/* Mobile Navigation Menu */}
        {showMobileMenu && (
          <Card className="mb-6 sm:hidden">
            <CardContent className="p-4">
              <div className="flex flex-col gap-2">
                <Link href="/create" onClick={() => setShowMobileMenu(false)}>
                  <Button className="w-full justify-start">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Goal
                  </Button>
                </Link>
                <Link href="/join" onClick={() => setShowMobileMenu(false)}>
                  <Button variant="outline" className="w-full justify-start">
                    <Users className="w-4 h-4 mr-2" />
                    Join Goal
                  </Button>
                </Link>
                <Link href="/profile" onClick={() => setShowMobileMenu(false)}>
                  <Button variant="ghost" className="w-full justify-start">
                    <User className="w-4 h-4 mr-2" />
                    Profile
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Goals Grid */}
        <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {/* Solo Goals */}
          {soloGoals.map((goal) => {
            const streak = calculateStreak(goal.checkins)
            const checkedInToday = hasCheckedInToday(goal)
            
            return (
              <Link key={goal.id} href={`/goal/${goal.id}`}>
                <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{goal.emoji || '🎯'}</span>
                        <CardTitle className="text-base sm:text-lg truncate pr-2">{goal.name}</CardTitle>
                      </div>
                      <Badge variant="secondary" className="shrink-0">
                        <User className="w-3 h-3 mr-1" />
                        Solo
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Flame className="w-4 h-4 text-orange-500" />
                        <span className="font-semibold text-sm sm:text-base">{streak} day streak</span>
                      </div>
                      <div className="text-xl sm:text-2xl">
                        {checkedInToday ? '✅' : '⏰'}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}

          {/* Group Goals */}
          {groupGoals.map((goal) => {
            const groupStreakDates = goal.streaks.map(streak => streak.streak_date)
            const groupStreak = calculateGroupStreak(groupStreakDates)
            
            return (
              <Link key={goal.id} href={`/goal/${goal.id}`}>
                <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{goal.emoji || '🎯'}</span>
                        <CardTitle className="text-base sm:text-lg truncate pr-2">{goal.name}</CardTitle>
                      </div>
                      <Badge variant="secondary" className="shrink-0">
                        <Users className="w-3 h-3 mr-1" />
                        Group
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Flame className="w-4 h-4 text-orange-500" />
                        <span className="font-semibold text-sm sm:text-base">{groupStreak} day streak</span>
                      </div>
                      <div className="flex -space-x-1">
                        {goal.participants.slice(0, 3).map((participant) => (
                          <div
                            key={participant.id}
                            className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-white border-2 border-white flex items-center justify-center text-xs"
                            title={participant.nickname}
                          >
                            {participant.emoji}
                          </div>
                        ))}
                        {goal.participants.length > 3 && (
                          <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center text-xs">
                            +{goal.participants.length - 3}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>

        {/* Empty State */}
        {soloGoals.length === 0 && groupGoals.length === 0 && (
          <Card className="text-center py-8 sm:py-12">
            <CardContent>
              <div className="text-4xl sm:text-6xl mb-4">🎯</div>
              <CardTitle className="mb-2 text-lg sm:text-xl">No goals yet</CardTitle>
              <CardDescription className="mb-6 text-sm sm:text-base">
                Create your first goal or join a friend's goal to get started!
              </CardDescription>
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center max-w-sm mx-auto">
                <Link href="/create" className="flex-1">
                  <Button className="w-full">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Goal
                  </Button>
                </Link>
                <Link href="/join" className="flex-1">
                  <Button variant="outline" className="w-full">
                    <Users className="w-4 h-4 mr-2" />
                    Join Goal
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
