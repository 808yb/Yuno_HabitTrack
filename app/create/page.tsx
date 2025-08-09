"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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

  if (!userIdentity) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!goalName.trim()) return

    setLoading(true)

    try {
      const limitedName = goalName.trim().slice(0, 10)
      if (goalType === "solo") {
        // Create solo goal locally
        const goal = addSoloGoal({
          name: limitedName,
          type: "solo",
          duration_days: duration === "unlimited" ? null : parseInt(duration),
          checkins: [],
          emoji: selectedEmoji
        })
        
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-zinc-900 dark:to-zinc-800 p-4">
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
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="coop" id="coop" disabled={!isSupabaseConfigured()} />
                    <Label htmlFor="coop" className={`flex items-center gap-2 cursor-pointer text-sm sm:text-base ${!isSupabaseConfigured() ? 'opacity-50' : ''}`}>
                      <Users className="w-4 h-4" />
                      Group Goal - With friends
                      {!isSupabaseConfigured() && (
                        <span className="text-xs text-gray-500">(Requires Supabase setup)</span>
                      )}
                    </Label>
                  </div>
                </RadioGroup>
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

              <Button type="submit" className="w-full" size="lg" disabled={!goalName.trim() || loading}>
                {loading ? "Creating..." : "Create Goal"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
