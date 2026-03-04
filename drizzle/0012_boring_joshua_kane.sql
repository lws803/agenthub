ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "is_blocked" boolean DEFAULT false NOT NULL;
