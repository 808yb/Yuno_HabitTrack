-- Create goals table
CREATE TABLE IF NOT EXISTS goals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('solo', 'coop')),
  max_participants INTEGER DEFAULT 1,
  duration_days INTEGER, -- NULL for unlimited
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by TEXT NOT NULL -- nickname of creator
);

-- Create participants table
CREATE TABLE IF NOT EXISTS participants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  goal_id UUID REFERENCES goals(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL,
  emoji TEXT NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(goal_id, nickname)
);

-- Create checkins table
CREATE TABLE IF NOT EXISTS checkins (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  goal_id UUID REFERENCES goals(id) ON DELETE CASCADE,
  participant_id UUID REFERENCES participants(id) ON DELETE CASCADE,
  checkin_date DATE NOT NULL,
  checkin_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  timezone TEXT NOT NULL,
  UNIQUE(goal_id, participant_id, checkin_date)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_goals_created_at ON goals(created_at);
CREATE INDEX IF NOT EXISTS idx_participants_goal_id ON participants(goal_id);
CREATE INDEX IF NOT EXISTS idx_checkins_goal_id ON checkins(goal_id);
CREATE INDEX IF NOT EXISTS idx_checkins_date ON checkins(checkin_date);

-- Enable Row Level Security
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkins ENABLE ROW LEVEL SECURITY;

-- Create policies (allow all operations for now since we don't have auth)
CREATE POLICY "Allow all operations on goals" ON goals FOR ALL USING (true);
CREATE POLICY "Allow all operations on participants" ON participants FOR ALL USING (true);
CREATE POLICY "Allow all operations on checkins" ON checkins FOR ALL USING (true);
