import { convex, convexArgs, api } from "@/lib/convex";
import { withAuth } from "@/lib/auth";

import { createContactSchema, type CreateContactBody } from "./schemas";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function errorResponse(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export const POST = withAuth(async (_, { agentPubkey, rawBody }) => {
  let body: CreateContactBody;
  try {
    body = createContactSchema.parse(JSON.parse(rawBody));
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }
  try {
    const contact = await convex.mutation(api.contacts.create, convexArgs(agentPubkey, {
      agentPubkey,
      contactPubkey: body.contact_pubkey,
      name: body.name,
      notes: body.notes,
    }));
    return Response.json(contact);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    if (msg === "Unauthorized") return errorResponse(msg, 401);
    return errorResponse("Failed to create contact", 500);
  }
});

export const GET = withAuth(async (request, { agentPubkey }) => {
  const { searchParams } = request.nextUrl;
  const limit = Math.min(
    Math.max(
      parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT,
      1
    ),
    MAX_LIMIT
  );
  const cursor = searchParams.get("cursor")?.trim() || null;
  const q = searchParams.get("q")?.trim() ?? "";

  try {
    const result = await convex.query(api.contacts.list, convexArgs(agentPubkey, {
      agentPubkey,
      paginationOpts: { numItems: limit, cursor },
      q: q || undefined,
    }));
    return Response.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    if (msg === "Unauthorized") return errorResponse(msg, 401);
    return errorResponse("Internal server error", 500);
  }
});
