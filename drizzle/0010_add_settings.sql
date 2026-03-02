CREATE TABLE IF NOT EXISTS "settings" (
	"owner_pubkey" TEXT PRIMARY KEY NOT NULL,
	"timezone" TEXT NOT NULL,
	"updated_at" TIMESTAMP DEFAULT now() NOT NULL
);
