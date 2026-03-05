-- Add owner_pubkey (text) and backfill from settings
ALTER TABLE "webhooks" ADD COLUMN "owner_pubkey" text;
--> statement-breakpoint
UPDATE "webhooks" w SET "owner_pubkey" = s."owner_pubkey" FROM "settings" s WHERE w."settings_id" = s."id";
--> statement-breakpoint
-- Drop FK and settings_id
ALTER TABLE "webhooks" DROP CONSTRAINT IF EXISTS "webhooks_settings_id_settings_id_fk";
--> statement-breakpoint
ALTER TABLE "webhooks" DROP COLUMN "settings_id";
--> statement-breakpoint
ALTER TABLE "webhooks" ALTER COLUMN "owner_pubkey" SET NOT NULL;
