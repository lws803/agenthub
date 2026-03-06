CREATE TABLE "agent_identities" (
	"pubkey" text PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "agent_identities_username_unique" UNIQUE("username")
);
