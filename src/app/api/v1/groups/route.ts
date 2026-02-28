import * as crypto from "node:crypto";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { groupMembers, groups } from "@/db/schema";
import { withAuth } from "@/lib/auth";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function generateGroupKeypair(): {
  pubkeyHex: string;
  privateKeyPem: string;
} {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  const der = crypto
    .createPublicKey(publicKey)
    .export({ format: "der", type: "spki" });
  const pubkeyHex = der.subarray(-32).toString("hex");
  return {
    pubkeyHex,
    privateKeyPem: privateKey,
  };
}

export const POST = withAuth(async (request, { agentPubkey, rawBody }) => {
  let body: { name?: string };
  try {
    body = JSON.parse(rawBody);
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const name = body.name?.trim();

  if (!name) {
    return new Response(JSON.stringify({ error: "name is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { pubkeyHex, privateKeyPem } = generateGroupKeypair();

  const [group] = await db
    .insert(groups)
    .values({
      pubkey: pubkeyHex,
      privateKeyPem,
      name,
      createdByPubkey: agentPubkey,
    })
    .returning({
      id: groups.id,
      pubkey: groups.pubkey,
      name: groups.name,
      createdAt: groups.createdAt,
    });

  if (!group) {
    return new Response(JSON.stringify({ error: "Failed to create group" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  await db.insert(groupMembers).values({
    groupId: group.id,
    memberPubkey: agentPubkey,
  });

  return Response.json({
    id: group.id,
    pub_key: group.pubkey,
    name: group.name,
    created_at: group.createdAt,
  });
});

export const GET = withAuth(async (request, { agentPubkey }) => {
  const { searchParams } = new URL(request.url);

  const limit = Math.min(
    Math.max(
      parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10) ||
        DEFAULT_LIMIT,
      1
    ),
    MAX_LIMIT
  );
  const offset = Math.max(
    parseInt(searchParams.get("offset") ?? "0", 10) || 0,
    0
  );

  const rows = await db
    .select({
      id: groups.id,
      pubkey: groups.pubkey,
      name: groups.name,
      createdAt: groups.createdAt,
      createdByPubkey: groups.createdByPubkey,
    })
    .from(groups)
    .innerJoin(groupMembers, eq(groupMembers.groupId, groups.id))
    .where(eq(groupMembers.memberPubkey, agentPubkey))
    .orderBy(desc(groups.createdAt))
    .limit(limit)
    .offset(offset);

  const countResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(groups)
    .innerJoin(groupMembers, eq(groupMembers.groupId, groups.id))
    .where(eq(groupMembers.memberPubkey, agentPubkey));

  const total = countResult[0]?.count ?? 0;

  return Response.json({
    groups: rows.map((g) => ({
      id: g.id,
      pub_key: g.pubkey,
      name: g.name,
      created_at: g.createdAt,
      created_by_pubkey: g.createdByPubkey,
    })),
    total,
    limit,
    offset,
  });
});
