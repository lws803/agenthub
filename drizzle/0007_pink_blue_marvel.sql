CREATE TABLE "group_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"sender_pubkey" text NOT NULL,
	"body" text NOT NULL,
	"search_vector" "tsvector",
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "groups" DROP CONSTRAINT "groups_pubkey_unique";--> statement-breakpoint
ALTER TABLE "group_messages" ADD CONSTRAINT "group_messages_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_group_messages_group_id" ON "group_messages" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "idx_group_messages_search" ON "group_messages" USING gin ("search_vector");--> statement-breakpoint
CREATE OR REPLACE FUNCTION group_messages_search_vector_trigger() RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', coalesce(NEW.body, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER group_messages_search_vector_trigger
  BEFORE INSERT OR UPDATE ON "group_messages"
  FOR EACH ROW EXECUTE FUNCTION group_messages_search_vector_trigger();
--> statement-breakpoint
ALTER TABLE "groups" DROP COLUMN "pubkey";
