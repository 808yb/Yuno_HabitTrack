-- Add emoji field to goals table
ALTER TABLE goals ADD COLUMN IF NOT EXISTS emoji TEXT DEFAULT '🎯';

-- Update existing goals to have a default emoji if they don't have one
UPDATE goals SET emoji = '🎯' WHERE emoji IS NULL;
