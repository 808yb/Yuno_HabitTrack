"use client"

import { useEffect, useState, useRef, useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { getUserIdentity, getSoloGoals, addCheckinToSoloGoal, hasCheckedInToday, calculateStreak, calculateGroupStreak, checkAndUpdateGroupStreak, type SoloGoal } from "@/lib/local-storage"
import { supabase, type Goal, type Participant, type Checkin, type GroupStreak, isSupabaseConfigured } from "@/lib/supabase"
import { ArrowLeft, Users, User, Flame, Calendar, Share2, Copy, Settings } from 'lucide-react'
import Link from "next/link"
import { GoalManagement } from "@/components/goal-management"

export default function GoalPage() {
  const params = useParams()
  const router = useRouter()
  const goalId = params.goalId as string
  
  const [soloGoal, setSoloGoal] = useState<SoloGoal | null>(null)
  const [groupGoal, setGroupGoal] = useState<Goal | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [checkins, setCheckins] = useState<Checkin[]>([])
  const [groupStreaks, setGroupStreaks] = useState<GroupStreak[]>([])
  const [loading, setLoading] = useState(true)
  const [checkingIn, setCheckingIn] = useState(false)
  const [showManagement, setShowManagement] = useState(false)
  const isLoadingRef = useRef(false)
  const subscriptionRef = useRef<string | null>(null)

  const userIdentity = useMemo(() => getUserIdentity(), [])

  useEffect(() => {
    console.log('useEffect triggered:', { goalId, userIdentity: !!userIdentity })
    
    if (!userIdentity) {
      router.push("/setup")
      return
    }

    loadGoal()
  }, [goalId, userIdentity])

  // Temporarily disabled real-time subscription to debug infinite loop
  // useEffect(() => {
  //   // Only set up subscription if Supabase is configured and we have a user identity
  //   if (!userIdentity || !supabase || !isSupabaseConfigured()) return

  //   // Check if this is a group goal (not a solo goal)
  //   const soloGoals = getSoloGoals()
  //   const isSoloGoal = soloGoals.some(g => g.id === goalId)
    
  //   if (isSoloGoal) return // Don't set up subscription for solo goals

  //   // Prevent setting up multiple subscriptions for the same goal
  //   if (subscriptionRef.current === goalId) return

  //   const supabaseClient = supabase
  //   if (!supabaseClient) return

  //   subscriptionRef.current = goalId

  //   const channel = supabaseClient
  //     .channel(`goal-${goalId}`)
  //     .on('postgres_changes', 
  //       { event: '*', schema: 'public', table: 'checkins', filter: `goal_id=eq.${goalId}` },
  //       () => {
  //         // Only reload if not already loading to prevent infinite loops
  //         if (!isLoadingRef.current) {
  //           loadGoal()
  //         }
  //       }
  //     )
  //     .on('postgres_changes',
  //       { event: '*', schema: 'public', table: 'participants', filter: `goal_id=eq.${goalId}` },
  //       () => {
  //         // Only reload if not already loading to prevent infinite loops
  //         if (!isLoadingRef.current) {
  //           loadGoal()
  //         }
  //       }
  //     )
  //     .subscribe()

  //   return () => {
  //     supabaseClient.removeChannel(channel)
  //     subscriptionRef.current = null
  //   }
  // }, [goalId, userIdentity])

  const loadGoal = async () => {
    console.log('loadGoal called:', { goalId, isLoading: isLoadingRef.current })
    
    // Prevent multiple simultaneous calls
    if (isLoadingRef.current) return
    isLoadingRef.current = true

    // First check if it's a solo goal
    const soloGoals = getSoloGoals()
    const solo = soloGoals.find(g => g.id === goalId)
    
    if (solo) {
      setSoloGoal(solo)
      setLoading(false)
      isLoadingRef.current = false
      return
    }

    // Check if Supabase is configured for group goals
    if (!isSupabaseConfigured() || !supabase) {
      router.push("/")
      isLoadingRef.current = false
      return
    }

    // Otherwise, load group goal from Supabase
    try {
      const { data: goal, error: goalError } = await supabase
        .from('goals')
        .select('*')
        .eq('id', goalId)
        .single()

      if (goalError || !goal) {
        router.push("/")
        isLoadingRef.current = false
        return
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
      router.push("/")
    } finally {
      setLoading(false)
      isLoadingRef.current = false
    }
  }

  const handleSoloCheckin = () => {
    if (!soloGoal || hasCheckedInToday(soloGoal)) return

    addCheckinToSoloGoal(goalId)
    
    // Refresh solo goal data
    const updatedGoals = getSoloGoals()
    const updatedGoal = updatedGoals.find(g => g.id === goalId)
    if (updatedGoal) {
      setSoloGoal(updatedGoal)
    }
  }

  const handleGroupCheckin = async () => {
    if (!groupGoal || !userIdentity || !supabase) return

    const participant = participants.find(p => p.nickname === userIdentity.nickname)
    if (!participant) return

    const today = new Date().toISOString().split('T')[0]
    const existingCheckin = checkins.find(
      c => c.participant_id === participant.id && c.checkin_date === today
    )

    if (existingCheckin) return

    setCheckingIn(true)

    try {
      const { error } = await supabase
        .from('checkins')
        .insert({
          goal_id: goalId,
          participant_id: participant.id,
          checkin_date: today,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        })

      if (error) throw error

      // Check if this check-in completes a group streak
      await checkAndUpdateGroupStreak(goalId, participants, [...checkins, {
        goal_id: goalId,
        participant_id: participant.id,
        checkin_date: today,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      }])

      // Reload data
      loadGoal()
    } catch (error) {
      console.error('Error checking in:', error)
      alert('Failed to check in. Please try again.')
    } finally {
      setCheckingIn(false)
    }
  }

  const copyGoalCode = () => {
    navigator.clipboard.writeText(goalId)
    alert('Goal code copied to clipboard!')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">🎯</div>
          <div className="text-lg text-gray-600">Loading goal...</div>
        </div>
      </div>
    )
  }

  if (soloGoal) {
    const streak = calculateStreak(soloGoal.checkins)
    const checkedInToday = hasCheckedInToday(soloGoal)

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="container mx-auto max-w-2xl">
          <div className="mb-6 flex items-center justify-between">
            <Link href="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Home
              </Button>
            </Link>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowManagement(!showManagement)}
            >
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </Button>
          </div>

          {/* Goal Management Panel */}
          {showManagement && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Goal Settings
                </CardTitle>
                <CardDescription>
                  Customize your goal settings
                </CardDescription>
              </CardHeader>
              <CardContent>
                <GoalManagement
                  goalId={goalId}
                  goalName={soloGoal.name}
                  goalEmoji={soloGoal.emoji || '🎯'}
                  isSoloGoal={true}
                  onUpdate={() => {
                    // Refresh solo goal data
                    const updatedGoals = getSoloGoals()
                    const updatedGoal = updatedGoals.find(g => g.id === goalId)
                    if (updatedGoal) {
                      setSoloGoal(updatedGoal)
                    }
                  }}
                />
              </CardContent>
            </Card>
          )}

          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="text-4xl">{soloGoal.emoji || '🎯'}</span>
                    <div>
                      <CardTitle className="text-2xl">{soloGoal.name}</CardTitle>
                      <CardDescription>Solo Goal</CardDescription>
                    </div>
                  </div>
                </div>
                <Badge variant="secondary">
                  <User className="w-3 h-3 mr-1" />
                  Solo
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Flame className="w-5 h-5 text-orange-500" />
                    <span className="text-2xl font-bold">{streak}</span>
                  </div>
                  <p className="text-sm text-gray-600">Day Streak</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Calendar className="w-5 h-5 text-blue-500" />
                    <span className="text-2xl font-bold">{soloGoal.checkins.length}</span>
                  </div>
                  <p className="text-sm text-gray-600">Total Check-ins</p>
                </div>
              </div>

              <div className="text-center">
                {checkedInToday ? (
                  <div className="space-y-4">
                    <div className="text-6xl">✅</div>
                    <p className="text-lg font-semibold text-green-600">
                      Checked in for today!
                    </p>
                    <p className="text-sm text-gray-600">
                      Come back tomorrow to continue your streak.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="text-6xl">⏰</div>
                    <p className="text-lg font-semibold">
                      Ready to check in?
                    </p>
                    <Button onClick={handleSoloCheckin} size="lg" className="w-full">
                      Check In for Today
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Recent Check-ins */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Check-ins</CardTitle>
            </CardHeader>
            <CardContent>
              {soloGoal.checkins.length === 0 ? (
                <p className="text-center text-gray-500 py-4">
                  No check-ins yet. Start your streak today!
                </p>
              ) : (
                <div className="space-y-2">
                  {soloGoal.checkins
                    .slice()
                    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
                    .slice(0, 10)
                    .map((date) => (
                      <div key={date} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
                        <span>{new Date(date).toLocaleDateString()}</span>
                        <span className="text-green-500">✅</span>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>


        </div>
      </div>
    )
  }

  if (!groupGoal) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">❌</div>
          <div className="text-lg text-gray-600">Goal not found</div>
        </div>
      </div>
    )
  }

  const currentParticipant = participants.find(p => p.nickname === userIdentity?.nickname)
  const today = new Date().toISOString().split('T')[0]
  const todayCheckins = checkins.filter(c => c.checkin_date === today)
  const userHasCheckedInToday = currentParticipant && todayCheckins.some(c => c.participant_id === currentParticipant.id)
  
  // Calculate group streak
  const groupStreakDates = groupStreaks.map(streak => streak.streak_date)
  const groupStreak = calculateGroupStreak(groupStreakDates)

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="container mx-auto max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <Link href="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </Link>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowManagement(!showManagement)}
          >
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </Button>
        </div>

        {/* Goal Management Panel */}
        {showManagement && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Goal Settings
              </CardTitle>
              <CardDescription>
                Customize your goal settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <GoalManagement
                goalId={goalId}
                goalName={groupGoal.name}
                goalEmoji={groupGoal.emoji || '🎯'}
                isSoloGoal={false}
                onUpdate={() => {
                  // Reload goal data
                  loadGoal()
                }}
              />
            </CardContent>
          </Card>
        )}

        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <span className="text-4xl">{groupGoal.emoji || '🎯'}</span>
                  <div>
                    <CardTitle className="text-2xl">{groupGoal.name}</CardTitle>
                    <CardDescription>Group Goal</CardDescription>
                  </div>
                </div>
              </div>
              <Badge variant="secondary">
                <Users className="w-3 h-3 mr-1" />
                Group
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Flame className="w-5 h-5 text-orange-500" />
                  <span className="text-2xl font-bold">{groupStreak}</span>
                </div>
                <p className="text-sm text-gray-600">Group Streak</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Users className="w-5 h-5 text-blue-500" />
                  <span className="text-2xl font-bold">{participants.length}/{groupGoal.max_participants}</span>
                </div>
                <p className="text-sm text-gray-600">Members</p>
              </div>
            </div>
            
            <div className="flex justify-center mb-6">
              <Button variant="outline" onClick={copyGoalCode} size="sm">
                <Copy className="w-4 h-4 mr-2" />
                Copy Code
              </Button>
            </div>

            <div className="text-center mb-6">
              {userHasCheckedInToday ? (
                <div className="space-y-4">
                  <div className="text-6xl">✅</div>
                  <p className="text-lg font-semibold text-green-600">
                    You've checked in for today!
                  </p>
                  <p className="text-sm text-gray-600">
                    {todayCheckins.length}/{participants.length} members have checked in today
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="text-6xl">⏰</div>
                  <p className="text-lg font-semibold">
                    Ready to check in?
                  </p>
                  <Button onClick={handleGroupCheckin} size="lg" className="w-full" disabled={checkingIn}>
                    {checkingIn ? "Checking in..." : "Check In for Today"}
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Participants */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Members</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {participants.map((participant) => {
                const hasCheckedIn = todayCheckins.some(c => c.participant_id === participant.id)
                return (
                  <div key={participant.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="text-2xl">{participant.emoji}</div>
                      <div>
                        <p className="font-medium">{participant.nickname}</p>
                        <p className="text-xs text-gray-500">
                          Joined {new Date(participant.joined_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-2xl">
                      {hasCheckedIn ? '✅' : '⏰'}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {checkins.length === 0 ? (
              <p className="text-center text-gray-500 py-4">
                No check-ins yet. Be the first to check in!
              </p>
            ) : (
              <div className="space-y-2">
                {checkins.slice(0, 10).map((checkin) => {
                  const participant = participants.find(p => p.id === checkin.participant_id)
                  return (
                    <div key={checkin.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{participant?.emoji}</span>
                        <span className="font-medium">{participant?.nickname}</span>
                        <span className="text-sm text-gray-500">checked in</span>
                      </div>
                      <span className="text-sm text-gray-500">
                        {new Date(checkin.checkin_date).toLocaleDateString()}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>


      </div>
    </div>
  )
}
