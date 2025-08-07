"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { getUserIdentity, setUserIdentity, getSoloGoals, setSoloGoals, type UserIdentity } from "@/lib/local-storage"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { EMOJI_OPTIONS } from "@/lib/utils"
import { ArrowLeft, User, Trash2, Download, Upload, Settings } from 'lucide-react'
import Link from "next/link"

export default function ProfilePage() {
  const [userIdentity, setUserIdentityState] = useState<UserIdentity | null>(null)
  const [nickname, setNickname] = useState("")
  const [selectedEmoji, setSelectedEmoji] = useState(EMOJI_OPTIONS[0])
  const [loading, setLoading] = useState(false)
  const [exportData, setExportData] = useState<string>("")
  const [importData, setImportData] = useState<string>("")
  const router = useRouter()

  useEffect(() => {
    const identity = getUserIdentity()
    if (!identity) {
      router.push("/setup")
      return
    }
    
    setUserIdentityState(identity)
    setNickname(identity.nickname)
    setSelectedEmoji(identity.emoji)
  }, [router])

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!nickname.trim() || !userIdentity) return

    setLoading(true)

    try {
      const newIdentity: UserIdentity = {
        nickname: nickname.trim(),
        emoji: selectedEmoji
      }

      // Update local storage
      setUserIdentity(newIdentity)
      setUserIdentityState(newIdentity)

      // If Supabase is configured, update all group goal participations
      if (isSupabaseConfigured() && supabase && userIdentity.nickname !== newIdentity.nickname) {
        const { error } = await supabase
          .from('participants')
          .update({ 
            nickname: newIdentity.nickname,
            emoji: newIdentity.emoji 
          })
          .eq('nickname', userIdentity.nickname)

        if (error) {
          console.error('Error updating group participations:', error)
          // Don't fail the whole operation, just log the error
        }
      }

      alert('Profile updated successfully!')
    } catch (error) {
      console.error('Error updating profile:', error)
      alert('Failed to update profile. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleExportData = () => {
    const soloGoals = getSoloGoals()
    const exportObject = {
      userIdentity,
      soloGoals,
      exportDate: new Date().toISOString(),
      version: "1.0"
    }
    
    const dataStr = JSON.stringify(exportObject, null, 2)
    setExportData(dataStr)
    
    // Create download link
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `yuno-backup-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleImportData = () => {
    if (!importData.trim()) return

    try {
      const importObject = JSON.parse(importData)
      
      if (!importObject.userIdentity || !importObject.soloGoals) {
        alert('Invalid backup file format.')
        return
      }

      // Confirm before importing
      if (!confirm('This will replace your current data. Are you sure you want to continue?')) {
        return
      }

      // Import user identity
      setUserIdentity(importObject.userIdentity)
      setUserIdentityState(importObject.userIdentity)
      setNickname(importObject.userIdentity.nickname)
      setSelectedEmoji(importObject.userIdentity.emoji)

      // Import solo goals
      setSoloGoals(importObject.soloGoals)

      setImportData("")
      alert('Data imported successfully!')
    } catch (error) {
      console.error('Error importing data:', error)
      alert('Failed to import data. Please check the file format.')
    }
  }

  const handleClearAllData = () => {
    if (!confirm('This will delete ALL your data including goals and check-ins. This cannot be undone. Are you sure?')) {
      return
    }

    if (!confirm('Are you absolutely sure? This action is permanent!')) {
      return
    }

    // Clear all local storage
    localStorage.removeItem('yuno_user_identity')
    localStorage.removeItem('yuno_solo_goals')
    
    alert('All data has been cleared.')
    router.push('/setup')
  }

  if (!userIdentity) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="text-4xl mb-4">🎯</div>
          <div className="text-lg text-gray-600">Loading profile...</div>
        </div>
      </div>
    )
  }

  const soloGoals = getSoloGoals()
  const totalCheckins = soloGoals.reduce((sum, goal) => sum + goal.checkins.length, 0)

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="container mx-auto max-w-2xl">
        <div className="mb-6">
          <Link href="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </Link>
        </div>

        {/* Profile Header */}
        <Card className="mb-6">
          <CardHeader className="text-center">
            <div className="text-4xl sm:text-6xl mb-4">{userIdentity.emoji}</div>
            <CardTitle className="text-xl sm:text-2xl flex items-center justify-center gap-2">
              <Settings className="w-5 h-5 sm:w-6 sm:h-6" />
              Profile Settings
            </CardTitle>
            <CardDescription className="text-sm sm:text-base">
              Manage your Yuno profile and preferences
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Stats */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg sm:text-xl">Your Stats</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <div className="text-xl sm:text-2xl font-bold text-blue-600">{soloGoals.length}</div>
                <p className="text-xs sm:text-sm text-gray-600">Solo Goals</p>
              </div>
              <div className="text-center">
                <div className="text-xl sm:text-2xl font-bold text-green-600">{totalCheckins}</div>
                <p className="text-xs sm:text-sm text-gray-600">Total Check-ins</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Update Profile */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg sm:text-xl">Update Profile</CardTitle>
            <CardDescription className="text-sm sm:text-base">
              Change your nickname and emoji. This will update your identity across all goals.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdateProfile} className="space-y-6">
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

              <Button type="submit" className="w-full" size="lg" disabled={!nickname.trim() || loading}>
                {loading ? "Updating..." : "Update Profile"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Data Management */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg sm:text-xl">Data Management</CardTitle>
            <CardDescription className="text-sm sm:text-base">
              Export your data for backup or import previously exported data.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Export Data */}
            <div>
              <Button onClick={handleExportData} variant="outline" className="w-full">
                <Download className="w-4 h-4 mr-2" />
                Export My Data
              </Button>
              <p className="text-xs text-gray-500 mt-1">
                Downloads a JSON file with all your solo goals and check-ins.
              </p>
            </div>

            <Separator />

            {/* Import Data */}
            <div className="space-y-2">
              <Label htmlFor="importData">Import Data</Label>
              <textarea
                id="importData"
                className="w-full h-24 sm:h-32 p-3 border border-gray-300 rounded-md text-sm resize-none"
                placeholder="Paste your exported JSON data here..."
                value={importData}
                onChange={(e) => setImportData(e.target.value)}
              />
              <Button 
                onClick={handleImportData} 
                variant="outline" 
                className="w-full"
                disabled={!importData.trim()}
              >
                <Upload className="w-4 h-4 mr-2" />
                Import Data
              </Button>
              <p className="text-xs text-gray-500">
                This will replace your current data. Make sure to export first!
              </p>
              <p className="text-xs text-right text-gray-500">
                version 1.0
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="border-red-200 mb-6">
          <CardHeader>
            <CardTitle className="text-red-600 text-lg sm:text-xl">Danger Zone</CardTitle>
            <CardDescription className="text-sm sm:text-base">
              Irreversible actions that will permanently delete your data.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={handleClearAllData} 
              variant="destructive" 
              className="w-full"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Clear All Data
            </Button>
            <p className="text-xs text-gray-500 mt-2">
              This will permanently delete all your goals, check-ins, and profile data.
            </p>
          </CardContent>
        </Card>

        {/* System Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg sm:text-xl">System Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Supabase Status:</span>
              <Badge variant={isSupabaseConfigured() ? "default" : "secondary"}>
                {isSupabaseConfigured() ? "Connected" : "Not Configured"}
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Group Goals:</span>
              <Badge variant={isSupabaseConfigured() ? "default" : "secondary"}>
                {isSupabaseConfigured() ? "Available" : "Unavailable"}
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Data Storage:</span>
              <Badge variant="default">Local Browser</Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
