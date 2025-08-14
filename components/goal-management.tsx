"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Settings, Trash2, Edit, Palette, LogOut } from "lucide-react"
import { useRouter } from "next/navigation"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { getUserIdentity } from "@/lib/local-storage"

interface GoalManagementProps {
  goalId: string
  goalName: string
  goalEmoji: string
  isSoloGoal: boolean
  onUpdate?: () => void
}

const EMOJI_OPTIONS = [
  '🎯', '💪', '🏃‍♂️', '🧘‍♀️', '📚', '💻', '🎨', '🎵', '🍎', '💧',
  '😴', '🏋️‍♂️', '🚴‍♂️', '🏊‍♀️', '🧠', '💡', '⭐', '🔥', '💎', '🌟',
  '🎪', '🎭', '🎨', '🎬', '🎤', '🎧', '🎹', '🎸', '🎺', '🥁',
  '⚽', '🏀', '🏈', '⚾', '🎾', '🏐', '🏉', '🎱', '🏓', '🏸',
  '🏊‍♂️', '🏄‍♀️', '🏂', '⛷️', '🏔️', '🏕️', '🏖️', '🏝️', '🏜️', '🏟️'
]

export function GoalManagement({ goalId, goalName, goalEmoji, isSoloGoal, onUpdate }: GoalManagementProps) {
  const router = useRouter()
  const [isRenameOpen, setIsRenameOpen] = useState(false)
  const [isEmojiOpen, setIsEmojiOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isLeaveOpen, setIsLeaveOpen] = useState(false)
  const [newName, setNewName] = useState(goalName)
  const [selectedEmoji, setSelectedEmoji] = useState(goalEmoji)
  const [isUpdating, setIsUpdating] = useState(false)

  const handleRename = async () => {
    if (!newName.trim()) return
    
    setIsUpdating(true)
    
    try {
      const limitedName = newName.trim().slice(0, 10)
      if (isSoloGoal) {
        const { renameSoloGoal } = await import("@/lib/local-storage")
        renameSoloGoal(goalId, limitedName)
      } else {
        if (!supabase || !isSupabaseConfigured()) {
          throw new Error("Supabase not configured")
        }
        
        const { error } = await supabase
          .from('goals')
          .update({ name: limitedName })
          .eq('id', goalId)
        
        if (error) throw error
      }
      
      setIsRenameOpen(false)
      onUpdate?.()
    } catch (error) {
      console.error('Error renaming goal:', error)
      alert('Failed to rename goal. Please try again.')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleEmojiUpdate = async () => {
    setIsUpdating(true)
    
    try {
      if (isSoloGoal) {
        const { updateSoloGoalEmoji } = await import("@/lib/local-storage")
        updateSoloGoalEmoji(goalId, selectedEmoji)
      } else {
        if (!supabase || !isSupabaseConfigured()) {
          throw new Error("Supabase not configured")
        }
        
        const { error } = await supabase
          .from('goals')
          .update({ emoji: selectedEmoji })
          .eq('id', goalId)
        
        if (error) throw error
      }
      
      setIsEmojiOpen(false)
      onUpdate?.()
    } catch (error) {
      console.error('Error updating emoji:', error)
      alert('Failed to update emoji. Please try again.')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleDelete = async () => {
    setIsUpdating(true)
    
    try {
      if (isSoloGoal) {
        const { deleteSoloGoal } = await import("@/lib/local-storage")
        deleteSoloGoal(goalId)
        router.push("/")
      } else {
        if (!supabase || !isSupabaseConfigured()) {
          throw new Error("Supabase not configured")
        }
        
        await supabase.from('group_streaks').delete().eq('goal_id', goalId)
        await supabase.from('checkins').delete().eq('goal_id', goalId)
        await supabase.from('participants').delete().eq('goal_id', goalId)
        
        const { error } = await supabase
          .from('goals')
          .delete()
          .eq('id', goalId)
        
        if (error) throw error
        
        router.push("/")
      }
    } catch (error) {
      console.error('Error deleting goal:', error)
      alert('Failed to delete goal. Please try again.')
    } finally {
      setIsUpdating(false)
      setIsDeleteOpen(false)
    }
  }

  const handleLeave = async () => {
    setIsUpdating(true)
    
    try {
      if (!supabase || !isSupabaseConfigured()) {
        throw new Error("Supabase not configured")
      }
      
      const userIdentity = getUserIdentity()
      if (!userIdentity) {
        throw new Error("User not found")
      }
      
      // Find the participant record for the current user
      const { data: participant, error: participantError } = await supabase
        .from('participants')
        .select('*')
        .eq('goal_id', goalId)
        .eq('nickname', userIdentity.nickname)
        .single()
      
      if (participantError || !participant) {
        throw new Error("Participant not found")
      }
      
      // Delete the participant's check-ins
      await supabase
        .from('checkins')
        .delete()
        .eq('participant_id', participant.id)
      
      // Delete the participant record
      const { error: deleteError } = await supabase
        .from('participants')
        .delete()
        .eq('id', participant.id)
      
      if (deleteError) throw deleteError
      
      // Check if this was the last participant and delete the goal if so
      const { data: remainingParticipants } = await supabase
        .from('participants')
        .select('*')
        .eq('goal_id', goalId)
      
      if (!remainingParticipants || remainingParticipants.length === 0) {
        // Delete the entire goal if no participants remain
        await supabase.from('group_streaks').delete().eq('goal_id', goalId)
        await supabase.from('goals').delete().eq('id', goalId)
      }
      
      router.push("/")
    } catch (error) {
      console.error('Error leaving goal:', error)
      alert('Failed to leave goal. Please try again.')
    } finally {
      setIsUpdating(false)
      setIsLeaveOpen(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm font-medium">Goal Name</Label>
          <p className="text-sm text-gray-600">{goalName}</p>
        </div>
        <Dialog open={isRenameOpen} onOpenChange={setIsRenameOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Edit className="w-4 h-4 mr-2" />
              Rename
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Rename Goal</DialogTitle>
              <DialogDescription>
                Enter a new name for your goal.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="goal-name">Goal Name</Label>
                <Input
                  id="goal-name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Enter goal name"
                  className="mt-1"
                  maxLength={10}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsRenameOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleRename} disabled={isUpdating || !newName.trim()}>
                {isUpdating ? "Updating..." : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm font-medium">Goal Emoji</Label>
          <p className="text-sm text-gray-600">Current: {goalEmoji}</p>
        </div>
        <Dialog open={isEmojiOpen} onOpenChange={setIsEmojiOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Palette className="w-4 h-4 mr-2" />
              Change
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Choose Emoji</DialogTitle>
              <DialogDescription>
                Select an emoji for your goal.
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-10 gap-2 max-h-60 overflow-y-auto">
              {EMOJI_OPTIONS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => setSelectedEmoji(emoji)}
                  className={`p-2 text-xl rounded hover:bg-gray-100 transition-colors ${
                    selectedEmoji === emoji ? 'bg-blue-100 border-2 border-blue-300' : ''
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEmojiOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleEmojiUpdate} disabled={isUpdating}>
                {isUpdating ? "Updating..." : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {!isSoloGoal && (
        <div className="flex items-center justify-between pt-4 border-t">
          <div>
            <Label className="text-sm font-medium text-orange-600">Leave Goal</Label>
            <p className="text-sm text-gray-600">Leave this group goal</p>
          </div>
          <AlertDialog open={isLeaveOpen} onOpenChange={setIsLeaveOpen}>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="border-orange-300 text-orange-600 hover:bg-orange-50">
                <LogOut className="w-4 h-4 mr-2" />
                Leave
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Leave Group Goal?</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to leave "{goalName}"? You will lose access to this goal and your check-ins will be removed. If you're the last member, the goal will be deleted.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleLeave}
                  className="bg-orange-600 hover:bg-orange-700"
                  disabled={isUpdating}
                >
                  {isUpdating ? "Leaving..." : "Leave Goal"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}

      <div className="flex items-center justify-between pt-4 border-t">
        <div>
          <Label className="text-sm font-medium text-red-600">Danger Zone</Label>
          <p className="text-sm text-gray-600">
            {isSoloGoal ? "Permanently delete this goal" : "Permanently delete this goal (only for goal creator)"}
          </p>
        </div>
        <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm">
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the goal
                "{goalName}" and all associated data including check-ins and streaks.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-red-600 hover:bg-red-700"
                disabled={isUpdating}
              >
                {isUpdating ? "Deleting..." : "Delete Goal"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  )
}
