CREATE TABLE "contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_pubkey" text NOT NULL,
	"contact_pubkey" text NOT NULL,
	"name" text NOT NULL,
	"notes" text DEFAULT '',
	"search_vector" "tsvector",
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sender_pubkey" text NOT NULL,
	"recipient_pubkey" text NOT NULL,
	"body" text NOT NULL,
	"search_vector" "tsvector",
	"created_at" timestamp DEFAULT now() NOT NULL,
	"read_at" timestamp,
	"deleted_by_sender_at" timestamp,
	"deleted_by_recipient_at" timestamp
);
--> statement-breakpoint
CREATE INDEX "idx_contacts_search" ON "contacts" USING gin ("search_vector");
--> statement-breakpoint
CREATE OR REPLACE FUNCTION contacts_search_vector_trigger() RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', coalesce(NEW.name, '') || ' ' || coalesce(NEW.notes, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER contacts_search_vector_trigger
  BEFORE INSERT OR UPDATE ON "contacts"
  FOR EACH ROW EXECUTE FUNCTION contacts_search_vector_trigger();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION messages_search_vector_trigger() RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', coalesce(NEW.body, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER messages_search_vector_trigger
  BEFORE INSERT OR UPDATE ON "messages"
  FOR EACH ROW EXECUTE FUNCTION messages_search_vector_trigger();