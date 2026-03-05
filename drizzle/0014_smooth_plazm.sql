CREATE TABLE "webhooks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_pubkey" text NOT NULL,
	"type" text NOT NULL,
	"url" text NOT NULL,
	"secret" text,
	"allow_now" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "settings" DROP CONSTRAINT "settings_pkey";--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" DROP COLUMN "webhook_url";--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_owner_pubkey_unique" UNIQUE("owner_pubkey");
