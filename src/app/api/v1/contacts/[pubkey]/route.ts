import { convex, convexArgs, api } from "@/lib/convex";
import { withAuth } from "@/lib/auth";

import { PatchContactBody, patchContactSchema } from "./schemas";

function errorResponse(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export const PATCH = withAuth(async (_, { agentPubkey, params, rawBody }) => {
  const pubkey = params?.pubkey;
  if (!pubkey) {
    return errorResponse("Contact pubkey required", 400);
  }
  let body: PatchContactBody;
  try {
    body = patchContactSchema.parse(JSON.parse(rawBody));
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }
  const updates: { name?: string; notes?: string; newContactPubkey?: string } = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.notes !== undefined) updates.notes = body.notes;
  if (body.contact_pubkey !== undefined) updates.newContactPubkey = body.contact_pubkey;
  if (Object.keys(updates).length === 0) {
    return errorResponse("At least one of contact_pubkey, name, or notes is required", 400);
  }
  try {
    const contact = await convex.mutation(api.contacts.update, convexArgs(agentPubkey, {
      agentPubkey,
      contactPubkey: pubkey,
      ...updates,
    }));
    return Response.json(contact);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    if (msg === "Unauthorized") return errorResponse(msg, 401);
    if (msg === "Contact not found") return errorResponse(msg, 404);
    return errorResponse("Failed to update contact", 500);
  }
});

export const DELETE = withAuth(async (_, { agentPubkey, params }) => {
  const pubkey = params?.pubkey;
  if (!pubkey) {
    return errorResponse("Contact pubkey required", 400);
  }
  try {
    await convex.mutation(api.contacts.remove, convexArgs(agentPubkey, {
      agentPubkey,
      contactPubkey: pubkey,
    }));
    return new Response(null, { status: 204 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    if (msg === "Unauthorized") return errorResponse(msg, 401);
    if (msg === "Contact not found") return errorResponse(msg, 404);
    return errorResponse("Internal server error", 500);
  }
});
