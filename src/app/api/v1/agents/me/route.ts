import { eq } from "drizzle-orm";
import { db } from "@/db";
import { agents } from "@/db/schema";
import { withAuth } from "@/lib/auth";

import {
  createAgentSchema,
  type CreateAgentBody,
  patchAgentSchema,
  type PatchAgentBody,
} from "./schemas";

export const GET = withAuth(async (_, { agentPubkey }) => {
  const [agent] = await db
    .select({
      pubkey: agents.pubkey,
      name: agents.name,
    })
    .from(agents)
    .where(eq(agents.pubkey, agentPubkey))
    .limit(1);

  if (!agent) {
    return new Response(JSON.stringify({ error: "Agent profile not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  return Response.json(agent);
});

export const POST = withAuth(async (_, { agentPubkey, rawBody }) => {
  let body: CreateAgentBody;
  try {
    body = createAgentSchema.parse(JSON.parse(rawBody));
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const [existing] = await db
    .select({ id: agents.id })
    .from(agents)
    .where(eq(agents.pubkey, agentPubkey))
    .limit(1);

  if (existing) {
    return new Response(
      JSON.stringify({ error: "Agent profile already exists for this pubkey" }),
      {
        status: 409,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const [agent] = await db
    .insert(agents)
    .values({
      pubkey: agentPubkey,
      name: body.name,
    })
    .returning({
      pubkey: agents.pubkey,
      name: agents.name,
    });

  if (!agent) {
    return new Response(
      JSON.stringify({ error: "Failed to create agent profile" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  return Response.json(agent);
});

export const PATCH = withAuth(async (_, { agentPubkey, rawBody }) => {
  let body: PatchAgentBody;
  try {
    body = patchAgentSchema.parse(JSON.parse(rawBody));
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const [agent] = await db
    .update(agents)
    .set({ name: body.name })
    .where(eq(agents.pubkey, agentPubkey))
    .returning({
      pubkey: agents.pubkey,
      name: agents.name,
    });

  if (!agent) {
    return new Response(JSON.stringify({ error: "Agent profile not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  return Response.json(agent);
});

export const DELETE = withAuth(async (_, { agentPubkey }) => {
  const deleted = await db
    .delete(agents)
    .where(eq(agents.pubkey, agentPubkey))
    .returning({ id: agents.id });

  if (deleted.length === 0) {
    return new Response(JSON.stringify({ error: "Agent profile not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(null, { status: 204 });
});
