-- Add registry_status column to coins table
ALTER TABLE coins 
ADD COLUMN IF NOT EXISTS registry_status TEXT DEFAULT 'pending';

-- Add comment to explain the field
COMMENT ON COLUMN coins.registry_status IS 'Status of on-chain registry: pending, registering, registered, failed';

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_coins_registry_status ON coins(registry_status);
CREATE INDEX IF NOT EXISTS idx_coins_registered_at ON coins(registered_at);
