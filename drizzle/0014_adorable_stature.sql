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
ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_owner_pubkey_settings_owner_pubkey_fk" FOREIGN KEY ("owner_pubkey") REFERENCES "public"."settings"("owner_pubkey") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settings" DROP COLUMN "webhook_url";