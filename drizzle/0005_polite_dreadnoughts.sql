CREATE TABLE "agents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pubkey" text NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "agents_pubkey_unique" UNIQUE("pubkey")
);
