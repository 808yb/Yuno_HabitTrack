"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { getUserIdentity, addSoloGoal } from "@/lib/local-storage"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { ArrowLeft, Users, User, Palette } from 'lucide-react'
import Link from "next/link"

export default function CreateGoalPage() {
  const [goalName, setGoalName] = useState("")
  const [goalType, setGoalType] = useState<"solo" | "coop">("solo")
  const [maxParticipants, setMaxParticipants] = useState("2")
  const [duration, setDuration] = useState("unlimited")
  const [selectedEmoji, setSelectedEmoji] = useState("🎯")
  const [loading, setLoading] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  
  // New state for numeric goals
  const [goalCategory, setGoalCategory] = useState<"habit" | "increasing" | "decreasing">("habit")
  const [currentValue, setCurrentValue] = useState("")
  const [targetValue, setTargetValue] = useState("")
  const [unit, setUnit] = useState("")

  // Reset goal category to habit when switching to group goals
  useEffect(() => {
    if (goalType === "coop" && goalCategory !== "habit") {
      setGoalCategory("habit")
      setCurrentValue("")
      setTargetValue("")
      setUnit("")
    }
  }, [goalType, goalCategory])

  // Switch to solo goal when selecting numeric goal categories
  useEffect(() => {
    if (goalCategory !== "habit" && goalType === "coop") {
      setGoalType("solo")
    }
  }, [goalCategory, goalType])

  const EMOJI_OPTIONS = [
    '🎯', '💪', '🏃‍♂️', '🧘‍♀️', '📚', '💻', '🎨', '🎵', '🍎', '💧',
    '😴', '🏋️‍♂️', '🚴‍♂️', '🏊‍♀️', '🧠', '💡', '⭐', '🔥', '💎', '🌟',
    '🎪', '🎭', '🎬', '🎤', '🎧', '🎹', '🎸', '🎺', '🥁', '🎮',
    '⚽', '🏀', '🏈', '⚾', '🎾', '🏐', '🏉', '🎱', '🏓', '🏸',
    '🏊‍♂️', '🏄‍♀️', '🏂', '⛷️', '🏔️', '🏕️', '🏖️', '🏝️', '🏜️', '🏟️'
  ]
  const router = useRouter()

  const userIdentity = getUserIdentity()

  useEffect(() => {
    if (!userIdentity) {
      router.replace("/setup")
    }
  }, [userIdentity, router])

  useEffect(() => {
    const raf = requestAnimationFrame(() => setIsVisible(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  if (!userIdentity) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!goalName.trim()) return
    

    
    // Validate numeric goal inputs
    if (goalCategory !== "habit") {
      if (!currentValue.trim() || !targetValue.trim()) {
        alert("Please enter both current and target values for numeric goals.")
        return
      }
      
      const current = parseFloat(currentValue)
      const target = parseFloat(targetValue)
      
      if (isNaN(current) || isNaN(target)) {
        alert("Please enter valid numbers for current and target values.")
        return
      }
      
      if (goalCategory === "increasing" && current >= target) {
        alert("For increasing goals, your current value should be less than your target value.")
        return
      }
      
      if (goalCategory === "decreasing" && current <= target) {
        alert("For decreasing goals, your current value should be greater than your target value.")
        return
      }
    }

    setLoading(true)

    try {
      const limitedName = goalName.trim().slice(0, 10)
      if (goalType === "solo") {
        // Create solo goal locally
        const goalData: any = {
          name: limitedName,
          type: "solo",
          duration_days: duration === "unlimited" ? null : parseInt(duration),
          checkins: [],
          emoji: selectedEmoji,
          goal_type: goalCategory
        }
        
        // Add numeric goal data if applicable
        if (goalCategory !== "habit") {
          goalData.current_value = parseFloat(currentValue) || 0
          goalData.target_value = parseFloat(targetValue) || 0
          goalData.unit = unit.trim()
          
          // For decreasing goals, set start_value to current_value
          if (goalCategory === "decreasing") {
            goalData.start_value = parseFloat(currentValue) || 0
          }
        }
        
        const goal = addSoloGoal(goalData)
        
        router.push(`/goal/${goal.id}`)
      } else {
        // Check if Supabase is configured for group goals
        if (!isSupabaseConfigured() || !supabase) {
          alert('Group goals are not available. Supabase configuration is required.')
          return
        }

        // Create cooperative goal in Supabase
        const { data: goal, error: goalError } = await supabase
          .from('goals')
          .insert({
            name: limitedName,
            type: 'coop',
            max_participants: parseInt(maxParticipants),
            duration_days: duration === "unlimited" ? null : parseInt(duration),
            created_by: userIdentity.nickname,
            emoji: selectedEmoji
          })
          .select()
          .single()

        if (goalError) throw goalError

        // Add creator as first participant
        const { error: participantError } = await supabase
          .from('participants')
          .insert({
            goal_id: goal.id,
            nickname: userIdentity.nickname,
            emoji: userIdentity.emoji
          })

        if (participantError) throw participantError

        router.push(`/goal/${goal.id}`)
      }
    } catch (error) {
      console.error('Error creating goal:', error)
      alert('Failed to create goal. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className={`min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-zinc-900 dark:to-zinc-800 p-4 transition-all duration-300 ease-out will-change-transform ${
        isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
      }`}
    >
      <div className="container mx-auto max-w-md">
        <div className="mb-6">
          <Link href="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </Link>
        </div>

        <Card>
          <CardHeader className="text-center">
            <div className="text-4xl mb-4">🎯</div>
            <CardTitle className="text-xl sm:text-2xl">Create New Goal</CardTitle>
            <CardDescription className="text-sm sm:text-base">
              Set up a new habit or goal to track your progress.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="goalName">Goal Name</Label>
                <Input
                  id="goalName"
                  type="text"
                  placeholder="e.g., Daily Exercise, Read 30 minutes"
                  value={goalName}
                  onChange={(e) => setGoalName(e.target.value)}
                  maxLength={25}
                  className="text-base"
                  required
                  autoFocus
                />
              </div>

              <div className="space-y-3">
                <Label>Goal Category</Label>
                <RadioGroup value={goalCategory} onValueChange={(value: "habit" | "increasing" | "decreasing") => setGoalCategory(value)}>
                  <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors">
                    <RadioGroupItem value="habit" id="habit" />
                    <Label htmlFor="habit" className="cursor-pointer text-sm sm:text-base flex-1">
                      <div className="font-medium">Habit Tracker</div>
                      <div className="text-xs text-gray-500">Daily check-ins and streak tracking</div>
                    </Label>
                  </div>
                  <div className={`flex items-center space-x-2 p-3 border rounded-lg transition-colors ${
                    goalType === "coop" 
                      ? 'opacity-50 bg-gray-100 dark:bg-zinc-800 cursor-not-allowed' 
                      : 'hover:bg-gray-50 dark:hover:bg-zinc-800'
                  }`}>
                    <RadioGroupItem value="increasing" id="increasing" disabled={goalType === "coop"} />
                    <Label htmlFor="increasing" className={`cursor-pointer text-sm sm:text-base flex-1 ${goalType === "coop" ? 'cursor-not-allowed' : ''}`}>
                      <div className="font-medium">Increasing Goal</div>
                      <div className="text-xs text-gray-500">
                        Build up to a target (e.g., read 10 books, save $1000)
                        {goalType === "coop" && <span className="text-red-500"> - Solo only</span>}
                      </div>
                    </Label>
                  </div>
                  <div className={`flex items-center space-x-2 p-3 border rounded-lg transition-colors ${
                    goalType === "coop" 
                      ? 'opacity-50 bg-gray-100 dark:bg-zinc-800 cursor-not-allowed' 
                      : 'hover:bg-gray-50 dark:hover:bg-zinc-800'
                  }`}>
                    <RadioGroupItem value="decreasing" id="decreasing" disabled={goalType === "coop"} />
                    <Label htmlFor="decreasing" className={`cursor-pointer text-sm sm:text-base flex-1 ${goalType === "coop" ? 'cursor-not-allowed' : ''}`}>
                      <div className="font-medium">Decreasing Goal</div>
                      <div className="text-xs text-gray-500">
                        Reduce to a target (e.g., lose weight, quit smoking days)
                        {goalType === "coop" && <span className="text-red-500"> - Solo only</span>}
                      </div>
                    </Label>
                  </div>
                </RadioGroup>
                {goalType === "coop" && (
                  <p className="text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/20 p-2 rounded">
                    💡 Group goals only support habit tracking. Numeric goals are available for solo goals only.
                  </p>
                )}
              </div>

              {goalCategory !== "habit" && (
                <div className="space-y-4 p-4 border rounded-lg bg-gray-50 dark:bg-zinc-800">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="currentValue">Current Value</Label>
                      <Input
                        id="currentValue"
                        type="number"
                        placeholder={goalCategory === "increasing" ? "0" : "100"}
                        value={currentValue}
                        onChange={(e) => setCurrentValue(e.target.value)}
                        className="text-base"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="targetValue">Target Value</Label>
                      <Input
                        id="targetValue"
                        type="number"
                        placeholder={goalCategory === "increasing" ? "10" : "70"}
                        value={targetValue}
                        onChange={(e) => setTargetValue(e.target.value)}
                        className="text-base"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="unit">Unit</Label>
                      <Input
                        id="unit"
                        type="text"
                        placeholder={goalCategory === "increasing" ? "books, $, km..." : "kg, days, cigarettes..."}
                        value={unit}
                        onChange={(e) => setUnit(e.target.value)}
                        className="text-base"
                        maxLength={10}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-gray-500">
                    {goalCategory === "increasing" 
                      ? "Track your progress as you build up to your target value."
                      : "Track your progress as you reduce to your target value."
                    }
                  </p>
                </div>
              )}

              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <Palette className="w-4 h-4" />
                  Goal Emoji
                </Label>
                <div className="grid grid-cols-10 gap-1 max-h-40 overflow-y-auto p-2 border rounded-lg">
                  {EMOJI_OPTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setSelectedEmoji(emoji)}
                      className={`w-8 h-8 flex items-center justify-center text-xl rounded hover:bg-gray-100 transition-colors ${
                        selectedEmoji === emoji ? 'bg-blue-100 border-2 border-blue-300' : ''
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-500">Selected: {selectedEmoji}</p>
              </div>

              <div className="space-y-3">
                <Label>Goal Type</Label>
                <RadioGroup value={goalType} onValueChange={(value: "solo" | "coop") => setGoalType(value)}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="solo" id="solo" />
                    <Label htmlFor="solo" className="flex items-center gap-2 cursor-pointer text-sm sm:text-base">
                      <User className="w-4 h-4" />
                      Solo Goal - Just for you
                    </Label>
                  </div>
                  <div className={`flex items-center space-x-2 ${
                    goalCategory !== "habit" ? 'opacity-50' : ''
                  }`}>
                    <RadioGroupItem 
                      value="coop" 
                      id="coop" 
                      disabled={!isSupabaseConfigured() || goalCategory !== "habit"} 
                    />
                    <Label htmlFor="coop" className={`flex items-center gap-2 cursor-pointer text-sm sm:text-base ${
                      !isSupabaseConfigured() || goalCategory !== "habit" ? 'opacity-50 cursor-not-allowed' : ''
                    }`}>
                      <Users className="w-4 h-4" />
                      Group Goal - With friends
                      {!isSupabaseConfigured() && (
                        <span className="text-xs text-gray-500">(Requires Supabase setup)</span>
                      )}
                      {goalCategory !== "habit" && (
                        <span className="text-xs text-red-500">(Habit goals only)</span>
                      )}
                    </Label>
                  </div>
                </RadioGroup>
                {goalCategory !== "habit" && (
                  <p className="text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/20 p-2 rounded">
                    💡 Numeric goals (increasing/decreasing) are only available for solo goals.
                  </p>
                )}
              </div>

              {goalType === "coop" && (
                <div className="space-y-2">
                  <Label htmlFor="maxParticipants">Maximum Participants</Label>
                  <Select value={maxParticipants} onValueChange={setMaxParticipants}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                        <SelectItem key={num} value={num.toString()}>
                          {num} people
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {goalCategory === "habit" && (
                <div className="space-y-2">
                  <Label htmlFor="duration">Duration</Label>
                  <Select value={duration} onValueChange={setDuration}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unlimited">Unlimited</SelectItem>
                      <SelectItem value="7">7 days</SelectItem>
                      <SelectItem value="14">14 days</SelectItem>
                      <SelectItem value="21">21 days</SelectItem>
                      <SelectItem value="30">30 days</SelectItem>
                      <SelectItem value="60">60 days</SelectItem>
                      <SelectItem value="90">90 days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              {goalCategory !== "habit" && (
                <div className="space-y-2">
                  <Label>Goal Completion</Label>
                  <div className="p-3 border rounded-lg bg-blue-50 dark:bg-blue-950/20">
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                      💡 This goal will be completed when you reach your target value. 
                      No time limit applies - focus on steady progress!
                    </p>
                  </div>
                </div>
              )}

              <Button 
                type="submit" 
                className="w-full" 
                size="lg" 
                disabled={
                  !goalName.trim() || 
                  loading || 
                  (goalType === "coop" && goalCategory !== "habit") ||
                  (goalCategory !== "habit" && (!currentValue.trim() || !targetValue.trim()))
                }
              >
                {loading ? "Creating..." : "Create Goal"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
