-- Step 1: Drop webhooks FK (depends on settings PK)
ALTER TABLE "webhooks" DROP CONSTRAINT IF EXISTS "webhooks_owner_pubkey_settings_owner_pubkey_fk";
--> statement-breakpoint
-- Step 2: Drop existing PK on settings
ALTER TABLE "settings" DROP CONSTRAINT "settings_pkey";
--> statement-breakpoint
-- Step 3: Add id column and set as new PK
ALTER TABLE "settings" ADD COLUMN "id" uuid DEFAULT gen_random_uuid() NOT NULL;
--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_pkey" PRIMARY KEY ("id");
--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_owner_pubkey_unique" UNIQUE("owner_pubkey");
--> statement-breakpoint
-- Step 4: Add settings_id (uuid) to webhooks and backfill
ALTER TABLE "webhooks" ADD COLUMN "settings_id" uuid;
--> statement-breakpoint
UPDATE "webhooks" w SET "settings_id" = s."id" FROM "settings" s WHERE s."owner_pubkey" = w."owner_pubkey";
--> statement-breakpoint
-- Step 5: Drop owner_pubkey and enforce settings_id
ALTER TABLE "webhooks" DROP COLUMN "owner_pubkey";
--> statement-breakpoint
ALTER TABLE "webhooks" ALTER COLUMN "settings_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_settings_id_settings_id_fk" FOREIGN KEY ("settings_id") REFERENCES "public"."settings"("id") ON DELETE no action ON UPDATE no action;
