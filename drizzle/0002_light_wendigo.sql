CREATE TABLE "group_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"member_pub_key" text NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pub_key" text NOT NULL,
	"private_key_pem" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by_pubkey" text NOT NULL,
	CONSTRAINT "groups_pub_key_unique" UNIQUE("pub_key")
);
--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "original_sender_pubkey" text;--> statement-breakpoint
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_group_members_group_id" ON "group_members" USING btree ("group_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_group_members_group_member" ON "group_members" USING btree ("group_id","member_pub_key");--> statement-breakpoint
CREATE INDEX "idx_groups_pub_key" ON "groups" USING btree ("pub_key");
