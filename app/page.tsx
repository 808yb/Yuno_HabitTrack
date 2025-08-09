"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { getUserIdentity, getSoloGoals, type UserIdentity, type SoloGoal, hasCheckedInToday, calculateStreak, calculateGroupStreak, addCheckinToSoloGoal, getTodayDate, checkAndUpdateGroupStreak } from "@/lib/local-storage"
import { supabase, type Goal, type Participant, type GroupStreak, isSupabaseConfigured } from "@/lib/supabase"
import { Plus, Users, User, Target, Flame, Menu, X, Sun, Moon } from 'lucide-react'
import { useTheme } from "next-themes"
import Link from "next/link"
import { FirstHabitOnboarding } from "@/components/first-habit-onboarding"
import Image from "next/image"

export default function HomePage() {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [visualIsDark, setVisualIsDark] = useState<boolean | null>(null)
  const [isTogglingTheme, setIsTogglingTheme] = useState(false)
  useEffect(() => {
    setVisualIsDark(resolvedTheme === 'dark')
  }, [resolvedTheme])
  const isDarkVisual = visualIsDark ?? (resolvedTheme === 'dark')
  const [userIdentity, setUserIdentity] = useState<UserIdentity | null>(null)
  const [soloGoals, setSoloGoals] = useState<SoloGoal[]>([])
  const [groupGoals, setGroupGoals] = useState<(Goal & { participants: Participant[]; streaks: GroupStreak[] })[]>([])
  const [loading, setLoading] = useState(true)
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [loggingSoloGoalIds, setLoggingSoloGoalIds] = useState<Set<string>>(new Set())
  const [loggingGroupGoalIds, setLoggingGroupGoalIds] = useState<Set<string>>(new Set())
  const [groupCheckedTodayGoalIds, setGroupCheckedTodayGoalIds] = useState<Set<string>>(new Set())

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
            created_by,
            emoji
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

          // Determine which group goals the current user already checked in today
          try {
            const today = getTodayDate()
            const myParticipantIds = goalsWithParticipants
              .map(g => g.participants.find(pp => pp.nickname === nickname)?.id)
              .filter((id): id is string => Boolean(id))

            if (myParticipantIds.length > 0) {
              const { data: todaysCheckins } = await supabase
                .from('checkins')
                .select('goal_id, participant_id, checkin_date')
                .in('participant_id', myParticipantIds)
                .eq('checkin_date', today)

              const checkedSet = new Set<string>()
              todaysCheckins?.forEach(ci => checkedSet.add(ci.goal_id))
              setGroupCheckedTodayGoalIds(checkedSet)
            } else {
              setGroupCheckedTodayGoalIds(new Set())
            }
          } catch (e) {
            // Fallback: if unable to load, keep as empty set
            setGroupCheckedTodayGoalIds(new Set())
          }
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

  const handleSoloLog = (goalId: string) => {
    // Prevent duplicate actions
    if (loggingSoloGoalIds.has(goalId)) return
    const goal = soloGoals.find(g => g.id === goalId)
    if (goal && hasCheckedInToday(goal)) return

    setLoggingSoloGoalIds(prev => {
      const next = new Set(prev)
      next.add(goalId)
      return next
    })

    try {
      addCheckinToSoloGoal(goalId)
      const updated = getSoloGoals()
      setSoloGoals(updated)
    } finally {
      setLoggingSoloGoalIds(prev => {
        const done = new Set(prev)
        done.delete(goalId)
        return done
      })
    }
  }

  const handleGroupLog = async (goal: Goal & { participants: Participant[] }) => {
    if (!isSupabaseConfigured() || !supabase || !userIdentity) return
    if (loggingGroupGoalIds.has(goal.id)) return

    const participant = goal.participants.find(p => p.nickname === userIdentity.nickname)
    if (!participant) return

    setLoggingGroupGoalIds(prev => {
      const start = new Set(prev)
      start.add(goal.id)
      return start
    })

    const today = getTodayDate()
    try {
      const { error } = await supabase
        .from('checkins')
        .insert({
          goal_id: goal.id,
          participant_id: participant.id,
          checkin_date: today,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        })

      // Ignore unique violation errors (already checked in)
      if (error && (error as any).code !== '23505') {
        throw error
      }

      // Refresh today's check-ins for this goal and update group streak if needed
      const { data: todaysCheckins } = await supabase
        .from('checkins')
        .select('*')
        .eq('goal_id', goal.id)
        .eq('checkin_date', today)

      await checkAndUpdateGroupStreak(goal.id, goal.participants, todaysCheckins || [])

      setGroupCheckedTodayGoalIds(prev => {
        const checked = new Set(prev)
        checked.add(goal.id)
        return checked
      })
    } catch (e) {
      console.error('Error checking in:', e)
      alert('Failed to check in. Please try again.')
    } finally {
      setLoggingGroupGoalIds(prev => {
        const done = new Set(prev)
        done.delete(goal.id)
        return done
      })
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-zinc-900 dark:to-zinc-800 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="text-4xl mb-4">🎯</div>
          <div className="text-lg text-gray-600">Loading Yuno...</div>
        </div>
      </div>
    )
  }

  if (!userIdentity) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-zinc-900 dark:to-zinc-800 flex items-center justify-center p-4">
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-zinc-900 dark:to-zinc-800">
      <div className="container mx-auto px-4 py-4 sm:py-8">
        {/* Mobile Header */}
        <div className="flex items-center justify-between mb-6 sm:mb-8">
          <div className="flex items-center gap-2 sm:gap-3">
            <Image
              src="/yuno180.png"
              alt="Yuno"
              width={32}
              height={32}
              className="w-6 h-6 sm:w-8 sm:h-8"
              priority
            />
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-foreground">Yuno</h1>
              <p className="text-xs sm:text-sm text-muted-foreground truncate max-w-[150px] sm:max-w-none">
                Hey {userIdentity.emoji} {userIdentity.nickname}!
              </p>
            </div>
          </div>
          
          {/* Desktop Navigation */}
          <div className="hidden sm:flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={isTogglingTheme}
              onClick={() => {
                if (isTogglingTheme || isDarkVisual === null) return
                setIsTogglingTheme(true)
                const targetIsDark = !isDarkVisual
                setVisualIsDark(targetIsDark)
                window.setTimeout(() => {
                  document.documentElement.classList.add('theme-transition')
                  setTheme(targetIsDark ? 'dark' : 'light')
                  window.setTimeout(() => {
                    document.documentElement.classList.remove('theme-transition')
                    setIsTogglingTheme(false)
                  }, 500)
                }, 400)
              }}
            >
              <span className="relative w-4 h-4 mr-2 inline-block">
                <Sun
                  className={`absolute inset-0 transition-all duration-500 ease-in-out ${
                    isDarkVisual
                      ? 'opacity-100 rotate-0 scale-100'
                      : 'opacity-0 -rotate-90 scale-75'
                  }`}
                />
                <Moon
                  className={`absolute inset-0 transition-all duration-500 ease-in-out ${
                    isDarkVisual
                      ? 'opacity-0 rotate-90 scale-75'
                      : 'opacity-100 rotate-0 scale-100'
                  }`}
                />
              </span>
              Toggle Theme
            </Button>
            <Link href="/create" prefetch={false}>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Create Goal
              </Button>
            </Link>
            <Link href="/join" prefetch={false}>
              <Button variant="secondary">
                <Users className="w-4 h-4 mr-2" />
                Join Goal
              </Button>
            </Link>
            <Link href="/profile" prefetch={false}>
              <Button variant="secondary" size="sm">
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
            aria-label="Toggle menu"
            aria-expanded={showMobileMenu}
            onClick={() => setShowMobileMenu(!showMobileMenu)}
          >
            <span className="relative inline-block w-6 h-4">
              <span
                className={`absolute left-0 top-0 block h-[2px] w-6 bg-foreground transition-transform duration-300 ease-in-out ${
                  showMobileMenu ? 'translate-y-[7px] rotate-45' : ''
                }`}
              />
              <span
                className={`absolute left-0 top-1/2 -translate-y-1/2 block h-[2px] w-6 bg-foreground transition-all duration-300 ease-in-out ${
                  showMobileMenu ? 'opacity-0 scale-x-0' : 'opacity-100 scale-x-100'
                }`}
              />
              <span
                className={`absolute left-0 bottom-0 block h-[2px] w-6 bg-foreground transition-transform duration-300 ease-in-out ${
                  showMobileMenu ? '-translate-y-[7px] -rotate-45' : ''
                }`}
              />
            </span>
          </Button>
        </div>

          {/* Mobile Navigation Menu (expands in-flow to push content down) */}
          <div
            className={`sm:hidden grid transition-all duration-200 ease-out ${
              showMobileMenu ? 'grid-rows-[1fr] opacity-100 mb-6' : 'grid-rows-[0fr] opacity-0 mb-0'
            }`}
            aria-hidden={!showMobileMenu}
          >
            <div className="overflow-hidden">
              <Card>
                <CardContent className="p-4">
                  <div className="flex flex-col gap-2">
                    <Button
                      variant="secondary"
                      className="w-full justify-start"
                      disabled={isTogglingTheme}
                      onClick={() => {
                        if (isTogglingTheme || isDarkVisual === null) return
                        setIsTogglingTheme(true)
                        const targetIsDark = !isDarkVisual
                        setVisualIsDark(targetIsDark)
                        window.setTimeout(() => {
                          document.documentElement.classList.add('theme-transition')
                          setTheme(targetIsDark ? 'dark' : 'light')
                          window.setTimeout(() => {
                            document.documentElement.classList.remove('theme-transition')
                            setIsTogglingTheme(false)
                          }, 500)
                        }, 400)
                      }}
                    >
                      <span className="relative w-4 h-4 mr-2 inline-block">
                        <Sun
                          className={`absolute inset-0 transition-all duration-500 ease-in-out ${
                            isDarkVisual ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-90 scale-75'
                          }`}
                        />
                        <Moon
                          className={`absolute inset-0 transition-all duration-500 ease-in-out ${
                            isDarkVisual ? 'opacity-0 rotate-90 scale-75' : 'opacity-100 rotate-0 scale-100'
                          }`}
                        />
                      </span>
                      Toggle Theme
                    </Button>
                    <Link href="/create" prefetch={false} onClick={() => setShowMobileMenu(false)}>
                      <Button className="w-full justify-start">
                        <Plus className="w-4 h-4 mr-2" />
                        Create Goal
                      </Button>
                    </Link>
                    <Link href="/join" prefetch={false} onClick={() => setShowMobileMenu(false)}>
                      <Button variant="secondary" className="w-full justify-start">
                        <Users className="w-4 h-4 mr-2" />
                        Join Goal
                      </Button>
                    </Link>
                    <Link href="/profile" prefetch={false} onClick={() => setShowMobileMenu(false)}>
                      <Button variant="secondary" className="w-full justify-start">
                        <User className="w-4 h-4 mr-2" />
                        Profile
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

        {/* Goals Grid */}
        <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {/* Solo Goals */
          }
          {soloGoals.map((goal) => {
            const streak = calculateStreak(goal.checkins)
            const checkedInToday = hasCheckedInToday(goal)
            
            return (
              <Link key={goal.id} href={`/goal/${goal.id}`} prefetch={false}>
                <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="text-2xl">{goal.emoji || '🎯'}</span>
                        <CardTitle className="text-base sm:text-lg truncate pr-2">{goal.name}</CardTitle>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="secondary" className="shrink-0">
                        <User className="w-3 h-3 mr-1" />
                        Solo
                      </Badge>
                      <Button
                        size="sm"
                        variant={checkedInToday ? 'secondary' : 'default'}
                        disabled={checkedInToday || loggingSoloGoalIds.has(goal.id)}
                        className="shrink-0"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          handleSoloLog(goal.id)
                        }}
                      >
                        {checkedInToday ? 'Logged' : 'Log'}
                      </Button>
                    </div>
                    <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Flame
                        className={`w-4 h-4 ${
                          streak > 0
                            ? (checkedInToday
                                ? 'text-orange-500'
                                : 'text-gray-400 dark:text-gray-500')
                            : 'text-gray-300 dark:text-gray-600'
                        }`}
                      />
                      <span
                        className={`font-semibold text-sm sm:text-base ${
                          streak > 0 && checkedInToday ? 'text-orange-600 dark:text-orange-400' : ''
                        }`}
                      >
                        {streak} day streak
                      </span>
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
              <Link key={goal.id} href={`/goal/${goal.id}`} prefetch={false}>
                <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="text-2xl">{goal.emoji || '🎯'}</span>
                        <CardTitle className="text-base sm:text-lg truncate pr-2">{goal.name}</CardTitle>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="secondary" className="shrink-0">
                        <Users className="w-3 h-3 mr-1" />
                        Group
                      </Badge>
                      <Button
                        size="sm"
                        variant={groupCheckedTodayGoalIds.has(goal.id) ? 'secondary' : 'default'}
                        disabled={groupCheckedTodayGoalIds.has(goal.id) || loggingGroupGoalIds.has(goal.id)}
                        className="shrink-0"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          handleGroupLog(goal)
                        }}
                      >
                        {groupCheckedTodayGoalIds.has(goal.id) ? 'Logged' : 'Log'}
                      </Button>
                    </div>
                    <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Flame
                        className={`w-4 h-4 ${
                          groupStreak > 0
                            ? (groupCheckedTodayGoalIds.has(goal.id)
                                ? 'text-orange-500'
                                : 'text-gray-400 dark:text-gray-500')
                            : 'text-gray-300 dark:text-gray-600'
                        }`}
                      />
                      <span
                        className={`font-semibold text-sm sm:text-base ${
                          groupStreak > 0 && groupCheckedTodayGoalIds.has(goal.id)
                            ? 'text-orange-600 dark:text-orange-400'
                            : ''
                        }`}
                      >
                        {groupStreak} day streak
                      </span>
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
                <Link href="/create" prefetch={false} className="flex-1">
                  <Button className="w-full">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Goal
                  </Button>
                </Link>
                <Link href="/join" prefetch={false} className="flex-1">
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
