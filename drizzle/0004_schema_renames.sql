ALTER TABLE "group_members" RENAME COLUMN "member_pub_key" TO "member_pubkey";--> statement-breakpoint
ALTER TABLE "groups" RENAME COLUMN "pub_key" TO "pubkey";--> statement-breakpoint
ALTER TABLE "groups" DROP COLUMN "private_key_pem";--> statement-breakpoint
ALTER TABLE "groups" RENAME CONSTRAINT "groups_pub_key_unique" TO "groups_pubkey_unique";
