"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { setUserIdentity, type UserIdentity } from "@/lib/local-storage"
import { EMOJI_OPTIONS } from "@/lib/utils"

export default function SetupPage() {
  const [nickname, setNickname] = useState("")
  const [selectedEmoji, setSelectedEmoji] = useState(EMOJI_OPTIONS[0])
  const router = useRouter()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!nickname.trim()) return

    const identity: UserIdentity = {
      nickname: nickname.trim(),
      emoji: selectedEmoji
    }

    setUserIdentity(identity)
    router.push("/")
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-zinc-900 dark:to-zinc-800 flex items-center justify-center p-4">
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="text-center">
          <div className="text-4xl sm:text-6xl mb-4">🎯</div>
          <CardTitle className="text-xl sm:text-2xl">Set Up Your Identity</CardTitle>
          <CardDescription className="text-sm sm:text-base">
            Choose a nickname and emoji that will represent you in Yuno.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="nickname">Nickname</Label>
              <Input
                id="nickname"
                type="text"
                placeholder="Enter your nickname"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                maxLength={20}
                className="text-base"
                required
                autoFocus
              />
            </div>

            <div className="space-y-3">
              <Label>Choose Your Emoji</Label>
              <div className="grid grid-cols-5 sm:grid-cols-6 gap-2">
                {EMOJI_OPTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setSelectedEmoji(emoji)}
                    className={`w-10 h-10 sm:w-12 sm:h-12 text-xl sm:text-2xl rounded-lg border-2 transition-colors ${
                      selectedEmoji === emoji
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            <div className="text-center">
              <div className="text-3xl sm:text-4xl mb-2">{selectedEmoji}</div>
              <p className="text-sm text-gray-600">
                You'll be known as <strong>{selectedEmoji} {nickname || 'Your Nickname'}</strong>
              </p>
            </div>

            <Button type="submit" className="w-full" size="lg" disabled={!nickname.trim()}>
              Continue to Yuno
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
