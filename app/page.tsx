"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { getUserIdentity, getSoloGoals, type UserIdentity, type SoloGoal, hasCheckedInToday, calculateStreak, calculateGroupStreak, addCheckinToSoloGoal, getTodayDate, checkAndUpdateGroupStreak, deleteSoloGoal, addSoloGoal } from "@/lib/local-storage"
import { supabase, type Goal, type Participant, type GroupStreak, isSupabaseConfigured } from "@/lib/supabase"
import { Plus, Users, User, Target, Flame, Menu, X, Sun, Moon, Check } from 'lucide-react'
import { useTheme } from "next-themes"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { FirstHabitOnboarding } from "@/components/first-habit-onboarding"
import Image from "next/image"

export default function HomePage() {
  const router = useRouter()
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
  const [swipeGoalId, setSwipeGoalId] = useState<string | null>(null)
  const [swipeStartX, setSwipeStartX] = useState<number | null>(null)
  const [swipeOffsetX, setSwipeOffsetX] = useState<number>(0)
  const [isSwiping, setIsSwiping] = useState<boolean>(false)
  const [showCreateSheet, setShowCreateSheet] = useState(false)
  const [quickGoalName, setQuickGoalName] = useState("")
  const [quickSelectedEmoji, setQuickSelectedEmoji] = useState("🎯")
  const [quickCreating, setQuickCreating] = useState(false)
  const EMOJI_OPTIONS = [
    '🎯', '💪', '🏃‍♂️', '🧘‍♀️', '📚', '💻', '🎨', '🎵', '🍎', '💧',
    '😴', '🏋️‍♂️', '🚴‍♂️', '🏊‍♀️', '🧠', '💡', '⭐', '🔥', '💎', '🌟'
  ]

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

  const handleDeleteSoloGoal = (goalId: string) => {
    const confirmDelete = window.confirm('Delete this goal? This cannot be undone.')
    if (!confirmDelete) {
      // Reset swipe state if user cancels
      setSwipeGoalId(null)
      setSwipeOffsetX(0)
      setIsSwiping(false)
      return
    }
    deleteSoloGoal(goalId)
    const updated = getSoloGoals()
    setSoloGoals(updated)
    // Reset swipe state after deletion
    setSwipeGoalId(null)
    setSwipeOffsetX(0)
    setIsSwiping(false)
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
              src="/yuno512.png"
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
            const isActiveSwipe = swipeGoalId === goal.id
            const completedDays = goal.duration_days ? Math.min(goal.checkins.length, goal.duration_days) : null
            const progressPercent = goal.duration_days && completedDays !== null
              ? Math.min(100, Math.max(0, (completedDays / goal.duration_days) * 100))
              : 0
            
            return (
              <div
                key={goal.id}
                className="relative"
                onTouchStart={(e) => {
                  if (e.touches.length !== 1) return
                  setSwipeGoalId(goal.id)
                  setSwipeStartX(e.touches[0].clientX)
                  setIsSwiping(true)
                }}
                onTouchMove={(e) => {
                  if (!isSwiping || swipeGoalId !== goal.id || swipeStartX === null) return
                  const deltaX = e.touches[0].clientX - swipeStartX
                  // Only allow swiping left
                  const offset = Math.min(0, deltaX)
                  setSwipeOffsetX(offset)
                }}
                onTouchEnd={() => {
                  if (!isSwiping || swipeGoalId !== goal.id) return
                  const threshold = -80 // px to trigger delete
                  if (swipeOffsetX <= threshold) {
                    handleDeleteSoloGoal(goal.id)
                  } else {
                    // snap back
                    setSwipeOffsetX(0)
                    setSwipeGoalId(null)
                    setIsSwiping(false)
                  }
                }}
                onTouchCancel={() => {
                  setSwipeOffsetX(0)
                  setSwipeGoalId(null)
                  setIsSwiping(false)
                }}
              >
                {/* Delete background */}
                <div className="absolute inset-0 flex items-center justify-end pr-4 pointer-events-none select-none bg-red-50 dark:bg-red-950/20 rounded-md">
                  <span className="text-red-600 dark:text-red-400 font-medium">Delete</span>
                </div>
                <Link
                  href={`/goal/${goal.id}`}
                  prefetch={false}
                  onClick={(e) => {
                    // Prevent accidental navigation when swiping
                    if (swipeGoalId === goal.id && Math.abs(swipeOffsetX) > 5) {
                      e.preventDefault()
                      e.stopPropagation()
                    }
                  }}
                >
                  <Card
                    className="hover:shadow-lg transition-shadow cursor-pointer h-full will-change-transform relative"
                    style={{ transform: isActiveSwipe ? `translateX(${swipeOffsetX}px)` : undefined, transition: !isActiveSwipe ? 'transform 150ms ease-out' : undefined }}
                  >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="text-2xl">{goal.emoji || '🎯'}</span>
                        <div className="flex items-center gap-3 min-w-0">
                          <CardTitle className="text-base sm:text-lg truncate pr-2">{goal.name}</CardTitle>
                          <Badge variant="secondary" className="shrink-0">
                            <User className="w-3 h-3 mr-1" />
                            Solo
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {goal.duration_days !== null && (
                      <div className="mb-3">
                        <div className="h-2 w-full rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                          <div
                            className="h-2 bg-orange-600 transition-all"
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                        <div className="mt-1 text-[10px] sm:text-xs text-muted-foreground">
                          Day {completedDays} / {goal.duration_days}
                        </div>
                      </div>
                    )}
                    {goal.duration_days === null && (
                      <div className="mb-3">
                        {(() => {
                          const todayStr = getTodayDate()
                          const today = new Date(todayStr)
                          const year = today.getFullYear()
                          const monthIndex = today.getMonth() // 0-based
                          const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
                          const allMonthDates: string[] = []
                          for (let day = 1; day <= daysInMonth; day++) {
                            const d = new Date(year, monthIndex, day)
                            const iso = d.toISOString().split('T')[0]
                            allMonthDates.push(iso)
                          }
                          const streakCount = Math.min(calculateStreak(goal.checkins), daysInMonth)
                          const tileSize = 22 // px; tweak here if you want larger/smaller squares
                            return (
                              <div className="grid grid-cols-12 gap-x-[2px] gap-y-[8px]">
                              {allMonthDates.map((date, idx) => {
                                const isFilled = idx < streakCount
                                return (
                                  <div
                                    key={date}
                                    className="rounded-sm"
                                    style={{
                                      width: `${tileSize}px`,
                                      height: `${tileSize}px`,
                                      backgroundColor: isFilled ? '#E76000' : '#BFBFBF',
                                    }}
                                  />
                                )
                              })}
                            </div>
                          )
                        })()}
                      </div>
                    )}
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
                    </div>
                  </CardContent>
                  {/* Bottom-right log button + label */}
                  <div className="absolute bottom-3 right-3 flex flex-col items-center gap-1">
                    <Button
                      size="icon"
                      variant={checkedInToday ? 'secondary' : 'default'}
                      disabled={checkedInToday || loggingSoloGoalIds.has(goal.id)}
                      className="h-8 w-8 rounded-md"
                      aria-label={checkedInToday ? 'Logged' : 'Log'}
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleSoloLog(goal.id)
                      }}
                    >
                      {checkedInToday ? <Check className="w-5 h-5" /> : null}
                    </Button>
                    <span className="text-[10px] text-muted-foreground">{checkedInToday ? 'Logged' : 'Log'}</span>
                  </div>
                  </Card>
                </Link>
              </div>
            )
          })}

          {/* Group Goals */}
          {groupGoals.map((goal) => {
            const groupStreakDates = goal.streaks.map(streak => streak.streak_date)
            const groupStreak = calculateGroupStreak(groupStreakDates)
            
            return (
              <Link key={goal.id} href={`/goal/${goal.id}`} prefetch={false}>
                <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full relative">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="text-2xl">{goal.emoji || '🎯'}</span>
                        <div className="flex items-center gap-3 min-w-0">
                          <CardTitle className="text-base sm:text-lg truncate pr-2">{goal.name}</CardTitle>
                          <Badge variant="secondary" className="shrink-0">
                            <Users className="w-3 h-3 mr-1" />
                            Group
                          </Badge>
                        </div>
                      </div>
                      <div className="flex -space-x-1 shrink-0">
                        {goal.participants.slice(0, 3).map((participant) => (
                          <div
                            key={participant.id}
                            className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-white border-2 border-white dark:bg-zinc-800 dark:border-zinc-900 flex items-center justify-center text-xs"
                            title={participant.nickname}
                          >
                            {participant.emoji}
                          </div>
                        ))}
                        {goal.participants.length > 3 && (
                          <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-gray-200 dark:bg-zinc-700 border-2 border-white dark:border-zinc-900 flex items-center justify-center text-xs">
                            +{goal.participants.length - 3}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    
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
                      <div />
                    </div>
                  </CardContent>
                  {/* Bottom-right log button + label (group) */}
                  <div className="absolute bottom-3 right-3 flex flex-col items-center gap-1">
                    <Button
                      size="icon"
                      variant={groupCheckedTodayGoalIds.has(goal.id) ? 'secondary' : 'default'}
                      disabled={groupCheckedTodayGoalIds.has(goal.id) || loggingGroupGoalIds.has(goal.id)}
                      className="h-8 w-8 rounded-md"
                      aria-label={groupCheckedTodayGoalIds.has(goal.id) ? 'Logged' : 'Log'}
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleGroupLog(goal)
                      }}
                    >
                      {groupCheckedTodayGoalIds.has(goal.id) ? <Check className="w-5 h-5" /> : null}
                    </Button>
                    <span className="text-[10px] text-muted-foreground">{groupCheckedTodayGoalIds.has(goal.id) ? 'Logged' : 'Log'}</span>
                  </div>
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

        {/* Mobile Floating Action Button (Create) */}
        {!showMobileMenu && (
          <button
            aria-label="Quick create goal"
            onClick={() => setShowCreateSheet(true)}
            className="sm:hidden fixed right-5 bottom-14 z-10 rounded-full h-14 w-14 bg-primary text-primary-foreground shadow-lg shadow-black/20 flex items-center justify-center"
          >
            <Plus className="w-6 h-6" />
          </button>
        )}

        {/* Quick Create Sheet (mobile) */}
        <Sheet open={showCreateSheet} onOpenChange={setShowCreateSheet}>
          <SheetContent side="bottom" className="sm:hidden rounded-t-xl pb-4">
            <SheetHeader>
              <SheetTitle>Quick Create</SheetTitle>
            </SheetHeader>
            <div className="px-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="quickGoalName">Goal Name</Label>
                <Input
                  id="quickGoalName"
                  placeholder="e.g., Read 20m"
                  value={quickGoalName}
                  onChange={(e) => setQuickGoalName(e.target.value)}
                  maxLength={25}
                />
              </div>
              <div className="space-y-2">
                <Label>Emoji</Label>
                <div className="grid grid-cols-10 gap-1 max-h-36 overflow-y-auto p-2 border rounded-lg">
                  {EMOJI_OPTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setQuickSelectedEmoji(emoji)}
                      className={`w-8 h-8 flex items-center justify-center text-xl rounded transition-colors ${
                        quickSelectedEmoji === emoji ? 'bg-blue-100 border-2 border-blue-300' : 'hover:bg-gray-100'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <SheetFooter>
              <Button
                disabled={!quickGoalName.trim() || quickCreating}
                onClick={() => {
                  if (!quickGoalName.trim() || !userIdentity) return
                  setQuickCreating(true)
                  try {
                    const goal = addSoloGoal({
                      name: quickGoalName.trim().slice(0, 10),
                      type: 'solo',
                      duration_days: null,
                      checkins: [],
                      emoji: quickSelectedEmoji,
                    })
                    setShowCreateSheet(false)
                    setQuickGoalName("")
                    router.push(`/goal/${goal.id}`)
                  } finally {
                    setQuickCreating(false)
                  }
                }}
                className="w-full"
              >
                {quickCreating ? 'Creating...' : 'Create Goal'}
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  )
}
