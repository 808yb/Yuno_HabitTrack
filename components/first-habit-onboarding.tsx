"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { addSoloGoal, type UserIdentity } from "@/lib/local-storage"
import { Sparkles, Target, Zap } from 'lucide-react'

interface FirstHabitOnboardingProps {
  onComplete: () => void
  userIdentity: UserIdentity
}

const HABIT_SUGGESTIONS = [
  { name: "Daily Exercise", emoji: "🏋️‍♂️" },
  { name: "Read 30 minutes", emoji: "📚" },
  { name: "Drink 8 glasses of water", emoji: "💧" },
  { name: "Meditate 10 minutes", emoji: "🧘‍♀️" },
  { name: "Write in journal", emoji: "✍️" },
  { name: "Get 8 hours sleep", emoji: "😴" },
]

const EMOJI_OPTIONS = [
  '🎯', '💪', '🏃‍♂️', '🧘‍♀️', '📚', '💻', '🎨', '🎵', '🍎', '💧',
  '😴', '🏋️‍♂️', '🚴‍♂️', '🏊‍♀️', '🧠', '💡', '⭐', '🔥', '💎', '🌟',
  '🎪', '🎭', '🎬', '🎤', '🎧', '🎹', '🎸', '🎺', '🥁', '🎮',
  '⚽', '🏀', '🏈', '⚾', '🎾', '🏐', '🏉', '🎱', '🏓', '🏸',
  '🏊‍♂️', '🏄‍♀️', '🏂', '⛷️', '🏔️', '🏕️', '🏖️', '🏝️', '🏜️', '🏟️'
]

export function FirstHabitOnboarding({ onComplete, userIdentity }: FirstHabitOnboardingProps) {
  const [step, setStep] = useState(1)
  const [habitName, setHabitName] = useState("")
  const [selectedSuggestion, setSelectedSuggestion] = useState("")
  const [selectedEmoji, setSelectedEmoji] = useState("🎯")
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSuggestionSelect = (suggestion: string) => {
    setSelectedSuggestion(suggestion)
    setHabitName(suggestion)
  }

  const handleCustomHabit = () => {
    setSelectedSuggestion("")
    setHabitName("")
    setStep(2)
  }

  const handleCreateHabit = async () => {
    if (!habitName.trim()) return

    setLoading(true)

    try {
      const goal = addSoloGoal({
        name: habitName.trim(),
        type: "solo",
        duration_days: null,
        checkins: [],
        emoji: selectedEmoji
      })
      
      // Navigate to the new goal
      router.push(`/goal/${goal.id}`)
    } catch (error) {
      console.error('Error creating first habit:', error)
      alert('Failed to create habit. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleSkip = () => {
    onComplete()
  }

  if (step === 1) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl mx-auto">
          <CardHeader className="text-center">
            <div className="text-4xl sm:text-6xl mb-4">🎉</div>
            <CardTitle className="text-xl sm:text-2xl flex items-center justify-center gap-2">
              <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-500" />
              Welcome, {userIdentity.emoji} {userIdentity.nickname}!
            </CardTitle>
            <CardDescription className="text-sm sm:text-base">
              Let's track your first habit! Choose from popular habits or create your own.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Habit Suggestions */}
            <div>
              <Label className="text-base font-medium mb-3 block">Popular Habits</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {HABIT_SUGGESTIONS.map((habit) => (
                  <button
                    key={habit.name}
                    onClick={() => handleSuggestionSelect(habit.name)}
                    className={`p-4 rounded-lg border-2 transition-all text-left hover:shadow-md ${
                      selectedSuggestion === habit.name
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{habit.emoji}</span>
                      <span className="font-medium text-sm sm:text-base">{habit.name}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>



            {/* Action Buttons */}
            <div className="space-y-3">
              {selectedSuggestion && (
                <Button onClick={handleCreateHabit} className="w-full" size="lg" disabled={loading}>
                  <Target className="w-4 h-4 mr-2" />
                  {loading ? "Creating..." : `Start tracking "${selectedSuggestion}"`}
                </Button>
              )}
              
              <Button onClick={handleCustomHabit} variant="outline" className="w-full">
                <Zap className="w-4 h-4 mr-2" />
                Create Custom Habit
              </Button>
              
              <Button onClick={handleSkip} variant="ghost" className="w-full text-sm">
                Skip for now
              </Button>
            </div>

            {/* Encouragement */}
            <div className="text-center p-4 bg-yellow-50 rounded-lg border border-yellow-200">
              <p className="text-sm text-yellow-800">
                <strong>💡 Tip:</strong> Start small! Even 5 minutes a day can build a powerful habit.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (step === 2) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md mx-auto">
          <CardHeader className="text-center">
            <div className="text-4xl sm:text-6xl mb-4">✨</div>
            <CardTitle className="text-xl sm:text-2xl">Create Your Habit</CardTitle>
            <CardDescription>
              What habit would you like to track?
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="habitName">Habit Name</Label>
              <Input
                id="habitName"
                type="text"
                placeholder="e.g., Walk 10,000 steps, Practice guitar..."
                value={habitName}
                onChange={(e) => setHabitName(e.target.value)}
                maxLength={50}
                className="text-base"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Choose an emoji for your habit</Label>
              <div className="grid grid-cols-10 gap-1 max-h-32 overflow-y-auto border rounded-lg p-3">
                {EMOJI_OPTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => setSelectedEmoji(emoji)}
                    className={`p-2 text-xl rounded transition-all flex items-center justify-center ${
                      selectedEmoji === emoji 
                        ? 'bg-blue-100 border-2 border-blue-300 shadow-md scale-110' 
                        : 'hover:bg-gray-50 hover:scale-105'
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <Button 
                onClick={handleCreateHabit} 
                className="w-full" 
                size="lg" 
                disabled={!habitName.trim() || loading}
              >
                <Target className="w-4 h-4 mr-2" />
                {loading ? "Creating..." : "Create My Habit"}
              </Button>
              
              <Button onClick={() => setStep(1)} variant="outline" className="w-full">
                Back to Suggestions
              </Button>
              
              <Button onClick={handleSkip} variant="ghost" className="w-full text-sm">
                Skip for now
              </Button>
            </div>

            {/* Examples */}
            <div className="text-center p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg border border-purple-200">
              <p className="text-sm text-purple-800 mb-3 font-semibold">
                💡 Try these examples:
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {[
                  { text: "Morning yoga", color: "bg-green-100 text-green-800 border-green-300" },
                  { text: "Learn Spanish", color: "bg-blue-100 text-blue-800 border-blue-300" },
                  { text: "No social media", color: "bg-red-100 text-red-800 border-red-300" },
                  { text: "Drink green tea", color: "bg-emerald-100 text-emerald-800 border-emerald-300" }
                ].map((example) => (
                  <button
                    key={example.text}
                    onClick={() => setHabitName(example.text)}
                    className={`px-3 py-1 rounded-full text-xs font-medium border-2 cursor-pointer transition-all hover:scale-105 ${example.color}`}
                  >
                    {example.text}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return null
}
