"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { getUserIdentity } from "@/lib/local-storage"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { ArrowLeft, Users } from 'lucide-react'
import Link from "next/link"

export default function JoinGoalPage() {
  const [goalCode, setGoalCode] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const router = useRouter()

  const userIdentity = getUserIdentity()

  if (!userIdentity) {
    router.push("/setup")
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!goalCode.trim()) return

    // Check if Supabase is configured
    if (!isSupabaseConfigured() || !supabase) {
      setError("Group goals are not available. Supabase configuration is required.")
      return
    }

    setLoading(true)
    setError("")

    try {
      // Find goal by ID (assuming goalCode is the goal ID for now)
      const { data: goal, error: goalError } = await supabase
        .from('goals')
        .select('*')
        .eq('id', goalCode.trim())
        .single()

      if (goalError || !goal) {
        setError("Goal not found. Please check the code and try again.")
        return
      }

      // Check if goal is full
      const { data: participants, error: participantsError } = await supabase
        .from('participants')
        .select('*')
        .eq('goal_id', goal.id)

      if (participantsError) throw participantsError

      if (participants.length >= goal.max_participants) {
        setError("This goal is full. No more participants can join.")
        return
      }

      // Check if user is already a participant
      const existingParticipant = participants.find(p => p.nickname === userIdentity.nickname)
      if (existingParticipant) {
        setError("You're already a member of this goal!")
        return
      }

      // Add user as participant
      const { error: joinError } = await supabase
        .from('participants')
        .insert({
          goal_id: goal.id,
          nickname: userIdentity.nickname,
          emoji: userIdentity.emoji
        })

      if (joinError) throw joinError

      router.push(`/goal/${goal.id}`)
    } catch (error) {
      console.error('Error joining goal:', error)
      setError("Failed to join goal. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
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
            <div className="text-4xl mb-4">🤝</div>
            <CardTitle className="text-2xl">Join a Goal</CardTitle>
            <CardDescription>
              {isSupabaseConfigured() 
                ? "Enter the goal code shared by your friend to join their goal."
                : "Group goals require Supabase configuration. Please set up Supabase to join group goals."
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="goalCode">Goal Code</Label>
                <Input
                  id="goalCode"
                  type="text"
                  placeholder="Enter goal code"
                  value={goalCode}
                  onChange={(e) => setGoalCode(e.target.value.toUpperCase())}
                  maxLength={36} // UUID length
                  required
                />
                <p className="text-xs text-gray-500">
                  Ask your friend to share their goal code with you.
                </p>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              <div className="text-center">
                <div className="text-2xl mb-2">{userIdentity.emoji}</div>
                <p className="text-sm text-gray-600">
                  You'll join as <strong>{userIdentity.nickname}</strong>
                </p>
              </div>

              <Button type="submit" className="w-full" size="lg" disabled={!goalCode.trim() || loading}>
                <Users className="w-4 h-4 mr-2" />
                {loading ? "Joining..." : "Join Goal"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
