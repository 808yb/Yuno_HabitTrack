import { memo } from 'react'

interface SeedlingDisplayProps {
  streak: number
  size?: 'sm' | 'md' | 'lg'
  showText?: boolean
  variant?: 'solo' | 'group'
}

const SeedlingDisplay = memo<SeedlingDisplayProps>(({ 
  streak, 
  size = 'md', 
  showText = true, 
  variant = 'solo' 
}) => {
  const stage = Math.min(Math.max(streak, 1), 6)
  
  const sizeClasses = {
    sm: 'w-16 h-16',
    md: 'w-24 h-24',
    lg: 'w-32 h-32'
  }

  const getStageText = () => {
    if (variant === 'group') {
      switch (streak) {
        case 0: return "Plant your first seed together!"
        case 1: return "Your group seedling is sprouting!"
        case 2: return "Your group plant is growing strong!"
        case 3: return "Your group plant is flourishing!"
        case 4: return "Your group plant is thriving!"
        case 5: return "Your group plant is almost mature!"
        default: return "Your group plant is fully grown! 🌱"
      }
    } else {
      switch (streak) {
        case 0: return "Plant your first seed!"
        case 1: return "Your seedling is sprouting!"
        case 2: return "Your plant is growing strong!"
        case 3: return "Your plant is flourishing!"
        case 4: return "Your plant is thriving!"
        case 5: return "Your plant is almost mature!"
        default: return "Your plant is fully grown! 🌱"
      }
    }
  }

  const getProgressText = () => {
    if (streak < 6) {
      const daysLeft = 6 - streak
      return `${daysLeft} more day${daysLeft !== 1 ? 's' : ''} to grow to the next stage!`
    }
    return variant === 'group' ? "Your group plant is fully grown! 🌱" : "Your plant is fully grown! 🌱"
  }

  return (
    <div className="text-center">
      <div className="flex justify-center mb-4">
        <img
          src={`/Stage_${stage}.svg`}
          alt={`Seedling stage ${stage}`}
          className={sizeClasses[size]}
        />
      </div>
      {showText && (
        <p className="text-sm text-gray-600 dark:text-white">
          {getStageText()}
        </p>
      )}
    </div>
  )
})

SeedlingDisplay.displayName = 'SeedlingDisplay'

export { SeedlingDisplay }
