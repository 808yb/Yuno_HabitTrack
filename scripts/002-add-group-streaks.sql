-- Create group_streaks table to track when all participants check in on the same day
CREATE TABLE IF NOT EXISTS group_streaks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  goal_id UUID REFERENCES goals(id) ON DELETE CASCADE,
  streak_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(goal_id, streak_date)
);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_group_streaks_goal_id ON group_streaks(goal_id);
CREATE INDEX IF NOT EXISTS idx_group_streaks_date ON group_streaks(streak_date);

-- Enable Row Level Security
ALTER TABLE group_streaks ENABLE ROW LEVEL SECURITY;

-- Create policy (allow all operations for now since we don't have auth)
CREATE POLICY "Allow all operations on group_streaks" ON group_streaks FOR ALL USING (true);
