-- SQL Script to fix the last_login NOT NULL constraint issue
-- Run this in your Supabase SQL Editor

-- Option 1: Remove the NOT NULL constraint from last_login (recommended if you're migrating to last_login_date)
ALTER TABLE login_streaks 
  ALTER COLUMN last_login DROP NOT NULL;

-- Option 2: If you want to keep using last_login and remove last_login_date
-- ALTER TABLE login_streaks DROP COLUMN IF EXISTS last_login_date;
-- ALTER TABLE login_streaks DROP COLUMN IF EXISTS login_dates;
-- ALTER TABLE login_streaks DROP COLUMN IF EXISTS total_points;
-- ALTER TABLE login_streaks DROP COLUMN IF EXISTS weekly_calendar;

-- Verify the constraint is removed
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'login_streaks'
ORDER BY ordinal_position;
