-- Add access_token column to delivery_drivers for direct link login
-- Run this migration in your Supabase SQL editor

-- Add the access_token column
ALTER TABLE delivery_drivers 
ADD COLUMN IF NOT EXISTS access_token TEXT UNIQUE;

-- Create index for fast token lookup
CREATE INDEX IF NOT EXISTS idx_delivery_drivers_access_token 
ON delivery_drivers(access_token) 
WHERE access_token IS NOT NULL;

-- Generate tokens for existing drivers that don't have one
UPDATE delivery_drivers 
SET access_token = encode(gen_random_bytes(24), 'base64')
WHERE access_token IS NULL;

-- Comment for documentation
COMMENT ON COLUMN delivery_drivers.access_token IS 'Unique token for direct driver login via QR code or link';
