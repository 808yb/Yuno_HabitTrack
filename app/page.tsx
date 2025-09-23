"use client"

import { useEffect, useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { getUserIdentity, getSoloGoals, type UserIdentity, type SoloGoal, hasCheckedInToday, calculateStreak, calculateGroupStreak, addCheckinToSoloGoal, getTodayDate, checkAndUpdateGroupStreak, deleteSoloGoal, addSoloGoal, isNumericGoalCompleted, getNumericGoalProgress, updateNumericGoalValue, getXpState, getLevelInfoFromXp, addXp } from "@/lib/local-storage"
import { supabase, type Goal, type Participant, type GroupStreak, isSupabaseConfigured } from "@/lib/supabase"
import { Plus, Users, User, Target, Flame, Menu, X, Sun, Moon, Check, Trophy } from 'lucide-react'
import { useTheme } from "next-themes"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FirstHabitOnboarding } from "@/components/first-habit-onboarding"
import Image from "next/image"
import { Progress } from "@/components/ui/progress"

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
  
  // State for numeric goal updates
  const [showUpdateDialog, setShowUpdateDialog] = useState(false)
  const [updatingGoal, setUpdatingGoal] = useState<SoloGoal | null>(null)
  const [newValue, setNewValue] = useState("")
  const [updatingValue, setUpdatingValue] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [showFab, setShowFab] = useState(true)
  const lastScrollYRef = useRef(0)
  const [xp, setXp] = useState<number>(0)
  const [levelInfo, setLevelInfo] = useState<{ level: number; currentLevelXp: number; nextLevelRequirement: number; progressPercent: number } | null>(null)
  const [leaderboard, setLeaderboard] = useState<Array<{ name: string; emoji: string; level: number; totalXp: number; progressPercent: number }>>([])
  const LEADERBOARD_KEY = 'yuno_dummy_leaderboard'
  const [showLeaderboard, setShowLeaderboard] = useState(false)
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

      // Load XP
      refreshXp()
    } else {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (userIdentity) {
      setLoading(false)
    }
  }, [userIdentity])

  // Keep user row (#2) in leaderboard updated as XP/level change
  useEffect(() => {
    if (!userIdentity || !levelInfo) return
    try {
      const raw = localStorage.getItem(LEADERBOARD_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed) || parsed.length < 2) return
      const updated = [...parsed]
      updated[1] = {
        ...updated[1],
        name: `${userIdentity.nickname} (You)`,
        emoji: userIdentity.emoji,
        level: levelInfo.level,
        totalXp: xp,
        progressPercent: levelInfo.progressPercent,
      }
      setLeaderboard(updated)
      localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(updated))
    } catch {}
  }, [xp, levelInfo, userIdentity])

  // Mobile detection
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const refreshXp = () => {
    const state = getXpState()
    setXp(state.xp)
    setLevelInfo(getLevelInfoFromXp(state.xp))
  }

  // Leaderboard generation helpers (dummy data)
  const requirementForLevel = (lvl: number) => Math.round(100 * Math.pow(1.2, Math.max(0, lvl - 1)))
  const cumulativeXpForLevelStart = (lvl: number) => {
    // total xp required to reach the start of this level
    let total = 0
    for (let i = 1; i < lvl; i++) {
      total += requirementForLevel(i)
    }
    return total
  }
  const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))

  useEffect(() => {
    if (!userIdentity) return
    // Try to load cached leaderboard
    const loadCached = () => {
      try {
        const raw = typeof window !== 'undefined' ? localStorage.getItem(LEADERBOARD_KEY) : null
        if (raw) {
          const parsed = JSON.parse(raw)
          if (Array.isArray(parsed) && parsed.length >= 6) {
            setLeaderboard(parsed)
            return true
          }
        }
      } catch {}
      return false
    }
    if (loadCached()) return

    // Generate once and cache
    const baseLevel = levelInfo ? levelInfo.level : 1
    const baseXp = xp
    const candidates = [
      { name: 'Darth Vader', emoji: '🖤' },
      { name: 'Indiana Jones', emoji: '🤠' },
      { name: 'Ellen Ripley', emoji: '👩‍🚀' },
      { name: 'James Bond', emoji: '🕶️' },
      { name: 'Hermione Granger', emoji: '🪄' },
      { name: 'Gandalf', emoji: '🧙‍♂️' },
      { name: 'Neo', emoji: '🕳️' },
      { name: 'Lara Croft', emoji: '🏹' },
      { name: 'Rocky Balboa', emoji: '🥊' },
      { name: 'John Wick', emoji: '🗡️' },
    ]
    // pick 5 unique random characters
    const shuffled = [...candidates].sort(() => Math.random() - 0.5)
    const picks = shuffled.slice(0, 5)

    // Build entries: #1 slightly higher level, user #2, others lower/around
    const userEntry = {
      name: `${userIdentity.nickname} (You)`,
      emoji: userIdentity.emoji,
      level: baseLevel,
      totalXp: baseXp,
      progressPercent: levelInfo ? levelInfo.progressPercent : 0,
    }

    const topLevel = baseLevel + clamp(Math.round(Math.random() * 3) + 1, 1, 4)
    const topReq = requirementForLevel(topLevel)
    const topBase = cumulativeXpForLevelStart(topLevel)
    const topProgress = clamp(20 + Math.random() * 60, 0, 99.9)
    const topTotal = Math.floor(topBase + (topReq * topProgress) / 100)

    const rest = picks.map((p, idx) => {
      const delta = [-2, -1, -1, 0, -3][idx % 5]
      const lvl = clamp(baseLevel + delta + Math.round(Math.random() * 1), 1, Math.max(2, baseLevel + 1))
      const req = requirementForLevel(lvl)
      const base = cumulativeXpForLevelStart(lvl)
      const prog = clamp(10 + Math.random() * 80, 0, 99.9)
      const total = Math.floor(base + (req * prog) / 100)
      return { name: p.name, emoji: p.emoji, level: lvl, totalXp: total, progressPercent: prog }
    })

    const entries = [
      // rank 1
      { name: picks[0].name, emoji: picks[0].emoji, level: topLevel, totalXp: topTotal, progressPercent: topProgress },
      // rank 2 user
      userEntry,
      // rank 3-6
      ...rest.slice(1, 5),
    ]

    setLeaderboard(entries)
    try {
      localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(entries))
    } catch {}
  }, [userIdentity])

  // Hide mobile FAB when scrolling down; show when scrolling up
  useEffect(() => {
    const onScroll = () => {
      const currentY = window.scrollY || 0
      const lastY = lastScrollYRef.current
      const delta = currentY - lastY
      // Update last scroll position
      lastScrollYRef.current = currentY
      // Always show near top
      if (currentY < 10) {
        if (!showFab) setShowFab(true)
        return
      }
      // If scrolling down significantly, hide; if up, show
      if (delta > 4) {
        if (showFab) setShowFab(false)
      } else if (delta < -4) {
        if (!showFab) setShowFab(true)
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [showFab])

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
      // XP changed on check-in
      refreshXp()
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

  const handleNumericGoalUpdate = () => {
    if (!updatingGoal || !newValue.trim()) return
    
    const value = parseFloat(newValue)
    if (isNaN(value)) return
    
    // Validate the new value based on goal type
    if (updatingGoal.goal_type === 'increasing' && value < updatingGoal.current_value!) {
      alert(`For increasing goals, you cannot update to a lower value. Current: ${updatingGoal.current_value}, New: ${value}`)
      return
    }
    
    if (updatingGoal.goal_type === 'decreasing' && value > updatingGoal.current_value!) {
      alert(`For decreasing goals, you cannot update to a higher value. Current: ${updatingGoal.current_value}, New: ${value}`)
      return
    }
    
    setUpdatingValue(true)
    
    try {
      updateNumericGoalValue(updatingGoal.id, value)
      
      // Refresh solo goals data
      const updated = getSoloGoals()
      setSoloGoals(updated)

      // XP may change upon completion
      refreshXp()
      
      setNewValue("")
      setShowUpdateDialog(false)
      setUpdatingGoal(null)
    } catch (error) {
      console.error('Error updating goal value:', error)
      alert('Failed to update goal value. Please try again.')
    } finally {
      setUpdatingValue(false)
    }
  }

  const openUpdateDialog = (goal: SoloGoal) => {
    setUpdatingGoal(goal)
    setNewValue(goal.current_value?.toString() || "")
    setShowUpdateDialog(true)
  }

  const generateNumberOptions = (goal: SoloGoal) => {
    if (!goal.current_value || !goal.target_value) return []
    
    const current = goal.current_value
    const target = goal.target_value
    const options: number[] = []
    
    if (goal.goal_type === 'increasing') {
      // For increasing goals, start from current value and go up to target + some buffer
      const max = Math.max(target, current) + Math.ceil((target - current) * 0.3)
      for (let i = current; i <= max; i++) {
        options.push(i)
      }
    } else if (goal.goal_type === 'decreasing') {
      // For decreasing goals, generate from min to current value (ascending order for better UX)
      // Never go below 0 for practical reasons
      const min = Math.max(0, Math.min(target, current) - Math.ceil((current - target) * 0.3))
      for (let i = min; i <= current; i++) {
        options.push(i)
      }
    }
    
    return options
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

      // Coop bonus: if at least one partner also checked in today
      try {
        const anyPartnerChecked = (todaysCheckins || []).some(ci => ci.participant_id !== participant.id)
        if (anyPartnerChecked) {
          addXp(5)
          refreshXp()
        }
      } catch {}
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
            <CardTitle className="text-2x1">Welcome to Yuno</CardTitle>
            <CardDescription
              className="text-sm text-10px text-gray-500"
            >
              Yuno you gotta check in. A gamified habit tracker for you and your friends.
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
              <p className="text-xs sm:text-sm text-muted-foreground truncate max-w-[150px] sm:max-w-none">Hey {userIdentity.emoji} {userIdentity.nickname}!</p>
              {levelInfo && (
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-[10px] sm:text-xs font-semibold">Lvl {levelInfo.level}</span>
                  <div className="w-24 sm:w-36">
                    <Progress value={levelInfo.progressPercent} />
                  </div>
                </div>
              )}
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
              onClick={() => setShowLeaderboard(true)}
            >
              <Trophy className="w-4 h-4 mr-2" />
              Leaderboard
            </Button>
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
                      onClick={() => {
                        setShowMobileMenu(false)
                        setShowLeaderboard(true)
                      }}
                    >
                      <Trophy className="w-4 h-4 mr-2" />
                      Leaderboard
                    </Button>
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
          {/* Leaderboard moved to modal */}
          {/* Solo Goals */}
          {soloGoals.map((goal) => {
            const streak = calculateStreak(goal.checkins)
            const checkedInToday = hasCheckedInToday(goal)
            const isActiveSwipe = swipeGoalId === goal.id
            const isNumericGoal = goal.goal_type && goal.goal_type !== 'habit'
            const isCompleted = isNumericGoal ? isNumericGoalCompleted(goal) : false
            const progress = isNumericGoal ? getNumericGoalProgress(goal) : { progress: 0, remaining: 0 }
            
            // For duration-based goals
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
                  {/* Type badge in top-right */}
                  <div className="absolute top-2 right-2 z-10">
                    <Badge variant="secondary" className="shrink-0">
                      <User className="w-3 h-3 mr-1" />
                      Solo
                    </Badge>
                  </div>
                  <CardHeader className="pb-1 pr-16">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="text-2xl">{goal.emoji || '🎯'}</span>
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          <CardTitle className="text-base sm:text-lg pr-2 min-w-0 flex-1 whitespace-normal break-words leading-tight">
                            {goal.name}
                          </CardTitle>
                          {isNumericGoal && (
                            <div className="flex gap-1 shrink-0">
                              <Badge variant="outline" className="shrink-0 text-xs">
                                {goal.goal_type === 'increasing' ? '📈' : '📉'}
                              </Badge>
                            </div>
                          )}
                        </div>
                      </div>
                    
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 min-h-[160px]">
                    {isNumericGoal ? (
                      <div className="mb-3">
                        <div className="text-center mb-2">
                          <div className="text-lg font-bold">
                            {goal.current_value} {goal.unit || ''}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            of {goal.target_value} {goal.unit || ''}
                          </div>
                        </div>
                        <div className="h-2 w-full rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                          <div
                            className="h-2 transition-all"
                            style={{ 
                              width: `${Math.min(progress.progress, 100)}%`, 
                              background: isCompleted 
                                ? 'linear-gradient(to right, #10B981, #059669)' 
                                : 'linear-gradient(to right, #386641, #6A994E)' 
                            }}
                          />
                        </div>
                        <div className="mt-1 text-[10px] sm:text-xs text-muted-foreground text-center">
                          {isCompleted 
                            ? `Goal achieved! 🎉`
                            : `${Math.round(progress.progress)}% complete`
                          }
                        </div>
                      </div>
                    ) : (
                      <>
                        {goal.duration_days !== null && (
                          <div className="mb-3">
                            <div className="h-2 w-full rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                              <div
                                className="h-2 transition-all"
                                style={{ width: `${progressPercent}%`, background: 'linear-gradient(to right, #386641, #6A994E)' }}
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
                              const todayIso = today.toISOString().split('T')[0]
                              // Show last 16 weeks ending this week
                              const end = new Date(today)
                              const dayNum = end.getDay() === 0 ? 7 : end.getDay() // 1..7 (Mon=1)
                              // align to Sunday of current week
                              end.setDate(end.getDate() + (7 - dayNum))
                              const start = new Date(end)
                              const totalDays = 16 * 7
                              start.setDate(end.getDate() - (totalDays - 1))
                              // align start to Monday
                              const startDay = start.getDay() === 0 ? 7 : start.getDay()
                              start.setDate(start.getDate() - (startDay - 1))
                              // Build columns by week, each column has 7 rows (Mon..Sun)
                              const weeks: string[][] = []
                              const checked = new Set<string>(goal.checkins)
                              const toLocalYmd = (d: Date) => {
                                const y = d.getFullYear()
                                const m = String(d.getMonth() + 1).padStart(2, '0')
                                const dd = String(d.getDate()).padStart(2, '0')
                                return `${y}-${m}-${dd}`
                              }
                              let cursor = new Date(start)
                              while (cursor <= end) {
                                const col: string[] = []
                                for (let r = 0; r < 7; r++) {
                                  col.push(toLocalYmd(cursor))
                                  cursor.setDate(cursor.getDate() + 1)
                                }
                                weeks.push(col)
                              }
                              const numWeeks = weeks.length
                              const cell = 10 // px; compact dot size
                              // Build month labels for columns (show label where a new month starts)
                              const monthLabels = weeks.map((col) => {
                                const firstOfMonthIso = col.find((iso) => new Date(iso).getDate() === 1)
                                if (firstOfMonthIso) {
                                  const labelDate = new Date(firstOfMonthIso)
                                  return labelDate.toLocaleString(undefined, { month: 'short' })
                                }
                                return ''
                              })

                              return (
                                <div className="w-full">
                                  {/* Month labels row aligned with calendar, with left spacer equal to weekday column */}
                                  <div className="flex items-center mb-0.5">
                                    <div style={{ width: `${cell + 4}px` }} />
                                    <div className="flex-1">
                                      <div
                                        className="grid gap-1"
                                        style={{ gridTemplateColumns: `repeat(${numWeeks}, 1fr)` }}
                                      >
                                        {monthLabels.map((label, i) => (
                                          <div key={i} className="text-[10px] text-muted-foreground text-center h-3 leading-3">
                                            {label}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                  {/* Calendar grid with weekday labels aligned to dot rows */}
                                  <div className="flex w-full items-start gap-2">
                                    <div
                                      className="grid gap-1"
                                      style={{ gridTemplateRows: 'repeat(7, 1fr)', width: `${cell + 4}px` }}
                                    >
                                      {['M','T','W','T','F','S','S'].map((label, idx) => (
                                        <div
                                          key={`wd-${idx}`}
                                          className="text-[10px] text-muted-foreground text-center"
                                          style={{ height: `${cell}px`, lineHeight: `${cell}px` }}
                                        >
                                          {label}
                                        </div>
                                      ))}
                                    </div>
                                    <div className="flex-1">
                                      <div
                                        className="grid gap-1"
                                        style={{ gridTemplateRows: 'repeat(7, 1fr)', gridTemplateColumns: `repeat(${numWeeks}, 1fr)`, gridAutoFlow: 'column' }}
                                      >
                                      {weeks.map((col, cIdx) => (
                                        <div key={cIdx} className="contents">
                                          {col.map((iso) => {
                                            const isChecked = checked.has(iso)
                                            const isToday = iso === todayIso
                                            return (
                                              <div
                                                key={iso}
                                                className={`rounded-full border border-black/10 dark:border-white/10 ${isChecked ? 'bg-[#6A994E]' : 'bg-zinc-200 dark:bg-zinc-800'} ${isToday ? 'ring-2 ring-[#6A994E]' : ''}`}
                                                title={iso}
                                                style={{
                                                  width: `${cell}px`,
                                                  height: `${cell}px`,
                                                }}
                                              />
                                            )
                                          })}
                                        </div>
                                      ))}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )
                            })()}
                          </div>
                        )}
                      </>
                    )}
                    <div className="flex items-center justify-between">
                      {isNumericGoal ? (
                        <div className="flex items-center gap-2">
                          <Target
                            className={`w-4 h-4 ${
                              isCompleted
                                ? 'text-[#10B981]'
                                : 'text-gray-400 dark:text-gray-500'
                            }`}
                          />
                          <span
                            className={`font-semibold text-sm sm:text-base ${
                              isCompleted ? 'text-[#10B981]' : ''
                            }`}
                          >
                            {isCompleted ? 'Completed!' : `${progress.remaining} ${goal.unit || ''} left`}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Flame
                            className={`w-4 h-4 ${
                              streak > 0
                                ? (checkedInToday
                                    ? 'text-[#6A994E]'
                                    : 'text-gray-400 dark:text-gray-500')
                                : 'text-gray-300 dark:text-gray-600'
                            }`}
                          />
                          <span
                            className={`font-semibold text-sm sm:text-base ${
                              streak > 0 && checkedInToday ? 'text-[#6A994E]' : ''
                            }`}
                          >
                            {streak} day streak
                          </span>
                        </div>
                      )}
                      {/* Right-aligned action button inside content */
                      }
                      <div className="shrink-0 flex flex-col items-center gap-1">
                        {isNumericGoal ? (
                          <>
                            <Button
                              size="icon"
                              variant={isCompleted ? 'secondary' : 'default'}
                              disabled={isCompleted || loggingSoloGoalIds.has(goal.id)}
                              className="h-8 w-8 rounded-md"
                              aria-label={isCompleted ? 'Completed' : 'Update'}
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                openUpdateDialog(goal)
                              }}
                            >
                              {isCompleted ? <Check className="w-5 h-5" /> : <Target className="w-5 h-5" />}
                            </Button>
                            <span className="text-[10px] text-muted-foreground">{isCompleted ? 'Completed' : 'Update'}</span>
                          </>
                        ) : (
                          <>
                            <Button
                              size="icon"
                              variant={checkedInToday ? 'secondary' : 'default'}
                              disabled={checkedInToday || loggingSoloGoalIds.has(goal.id)}
                              className="h-8 w-8 rounded-md bg-[#BFBFBF] text-black hover:bg-[#BFBFBF] hover:opacity-90 disabled:opacity-100"
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
                          </>
                        )}
                      </div>
                    </div>
                  </CardContent>
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
                  {/* Type badge in top-right */}
                  <div className="absolute top-2 right-2 z-10">
                    <Badge variant="secondary" className="shrink-0">
                      <Users className="w-3 h-3 mr-1" />
                      Group
                    </Badge>
                  </div>
                  <CardHeader className="pb-1 pr-16">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="text-2xl">{goal.emoji || '🎯'}</span>
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                        <CardTitle className="text-base sm:text-lg pr-2 min-w-0 flex-1 whitespace-normal break-words leading-tight">
{goal.name}</CardTitle>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="flex -space-x-1">
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
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 min-h-[140px]">
                    <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Flame
                        className={`w-4 h-4 ${
                          groupStreak > 0
                            ? (groupCheckedTodayGoalIds.has(goal.id)
                                ? 'text-[#6A994E]'
                                : 'text-gray-400 dark:text-gray-500')
                            : 'text-gray-300 dark:text-gray-600'
                        }`}
                      />
                      <span
                        className={`font-semibold text-sm sm:text-base ${
                          groupStreak > 0 && groupCheckedTodayGoalIds.has(goal.id)
                            ? 'text-[#6A994E]'
                            : ''
                        }`}
                      >
                        {groupStreak} day streak
                      </span>
                    </div>
                    {/* Right-aligned action button inside content for group */}
                    <div className="shrink-0 flex flex-col items-center gap-1">
                      <Button
                        size="icon"
                        variant={groupCheckedTodayGoalIds.has(goal.id) ? 'secondary' : 'default'}
                        disabled={groupCheckedTodayGoalIds.has(goal.id) || loggingGroupGoalIds.has(goal.id)}
                        className="h-8 w-8 rounded-md bg-[#BFBFBF] text-black hover:bg-[#BFBFBF] hover:opacity-90 disabled:opacity-100"
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

        {/* Mobile Floating Action Button (Create) */}
        {!showMobileMenu && (
          <button
            aria-label="Quick create goal"
            onClick={() => setShowCreateSheet(true)}
            className={`sm:hidden fixed right-5 bottom-14 z-10 rounded-full h-14 w-14 bg-primary text-primary-foreground shadow-lg shadow-black/20 flex items-center justify-center transition-opacity duration-300 ${showFab ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          >
            <Plus className="w-6 h-6" />
          </button>
        )}

        {/* Quick Create Sheet (mobile) */}
        <Sheet open={showCreateSheet} onOpenChange={setShowCreateSheet}>
          <SheetContent
            side="bottom"
            className="sm:hidden rounded-t-xl pb-4"
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
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
                  maxLength={55}
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
                      name: quickGoalName.trim().slice(0, 55),
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

        {/* Numeric Goal Update Dialog */}
        <Dialog open={showUpdateDialog} onOpenChange={setShowUpdateDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Update {updatingGoal?.name}</DialogTitle>
              <DialogDescription>
                Enter your current value to track your progress.
              </DialogDescription>
              {updatingGoal && (
                <div className="text-sm text-muted-foreground">
                  Current: {updatingGoal.current_value} {updatingGoal.unit} | Target: {updatingGoal.target_value} {updatingGoal.unit}
                </div>
              )}
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newValue">Current Value ({updatingGoal?.unit})</Label>
                {isMobile && updatingGoal ? (
                  <div className="space-y-3">
                    <div className="text-center mb-2">
                      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                        {updatingGoal.goal_type === 'increasing' ? (
                          <>
                            <span>📈</span>
                            <span>Scroll up to increase</span>
                          </>
                        ) : (
                          <>
                            <span>📉</span>
                            <span>Scroll down to decrease</span>
                          </>
                        )}
                      </div>
                    </div>
                    <Select value={newValue} onValueChange={setNewValue}>
                      <SelectTrigger className="h-14 text-xl font-semibold">
                        <SelectValue placeholder="Select value" />
                      </SelectTrigger>
                      <SelectContent className="max-h-60">
                        {generateNumberOptions(updatingGoal).map((value) => (
                          <SelectItem 
                            key={value} 
                            value={value.toString()} 
                            className="text-lg py-4 text-center"
                          >
                            <div className="flex items-center justify-center gap-2">
                              <span className="font-semibold">{value}</span>
                              <span className="text-muted-foreground">{updatingGoal.unit}</span>
                              {value === updatingGoal.current_value && (
                                <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded">
                                  Current
                                </span>
                              )}
                              {value === updatingGoal.target_value && (
                                <span className="text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-1 rounded">
                                  Target
                                </span>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Input
                      id="newValue"
                      type="number"
                      placeholder="Enter current value"
                      value={newValue}
                      onChange={(e) => setNewValue(e.target.value)}
                      autoFocus
                    />
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">
                        {updatingGoal?.goal_type === 'increasing' 
                          ? `📈 Type a value ${updatingGoal?.current_value} or higher`
                          : `📉 Type a value ${updatingGoal?.current_value} or lower`
                        }
                      </p>
                    </div>
                  </div>
                )}
                {updatingGoal && (
                  <div className="mt-2">
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>Progress</span>
                      <span>{Math.round(getNumericGoalProgress(updatingGoal).progress)}%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                      <div
                        className="h-2 transition-all"
                        style={{ 
                          width: `${Math.min(getNumericGoalProgress(updatingGoal).progress, 100)}%`, 
                          background: isNumericGoalCompleted(updatingGoal)
                            ? 'linear-gradient(to right, #10B981, #059669)' 
                            : 'linear-gradient(to right, #386641, #6A994E)' 
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Button 
                  onClick={handleNumericGoalUpdate} 
                  disabled={!newValue.trim() || updatingValue}
                  className="flex-1"
                >
                  {updatingValue ? "Updating..." : "Update"}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setShowUpdateDialog(false)
                    setUpdatingGoal(null)
                    setNewValue("")
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Leaderboard Dialog */}
        <Dialog open={showLeaderboard} onOpenChange={setShowLeaderboard}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Trophy className="w-5 h-5" /> Leaderboard</DialogTitle>
              <DialogDescription>Legendary lineup (dummy data)</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              {leaderboard.map((entry, idx) => (
                <div key={`${entry.name}-${idx}`} className={`flex items-center gap-3 p-2 rounded-md ${idx === 1 ? 'bg-primary/5' : 'bg-transparent'}`}>
                  <div className="w-6 text-sm font-bold text-muted-foreground">{idx + 1}</div>
                  <div className="w-8 h-8 rounded-full bg-white dark:bg-zinc-800 border border-black/10 dark:border-white/10 flex items-center justify-center">
                    <span className="text-base">{entry.emoji}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="truncate font-semibold text-sm">{entry.name}</div>
                      <Badge variant="secondary" className="shrink-0">Lvl {entry.level}</Badge>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <div className="w-44 sm:w-64">
                        <Progress value={entry.progressPercent} />
                      </div>
                      <div className="text-[10px] sm:text-xs text-muted-foreground truncate">XP {entry.totalXp.toLocaleString()}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
