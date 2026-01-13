-- Add payment_provider column to refund_requests table
-- Run this migration in your Supabase SQL Editor

ALTER TABLE public.refund_requests
ADD COLUMN IF NOT EXISTS payment_provider text DEFAULT 'mercadopago';

-- Add comment for documentation
COMMENT ON COLUMN public.refund_requests.payment_provider IS 'Payment provider: mercadopago or picpay';

-- Update existing records based on payment_id prefix
UPDATE public.refund_requests
SET payment_provider = 'picpay'
WHERE payment_id LIKE 'picpay_%';

UPDATE public.refund_requests
SET payment_provider = 'mercadopago'
WHERE payment_id NOT LIKE 'picpay_%' AND payment_provider IS NULL;