import { convex, convexArgs, api } from "@/lib/convex";
import { withAuth } from "@/lib/auth";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function errorResponse(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export const GET = withAuth(async (request, { agentPubkey }) => {
  const { searchParams } = request.nextUrl;
  const limit = Math.min(
    Math.max(
      parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT,
      1
    ),
    MAX_LIMIT
  );
  const offset = Math.max(parseInt(searchParams.get("offset") ?? "0", 10) || 0, 0);
  const unread = searchParams.get("unread") === "true";
  const q = searchParams.get("q")?.trim() ?? "";
  const contactPubkey = searchParams.get("contact_pubkey")?.trim() ?? "";
  const fromParam = searchParams.get("from")?.trim();
  const toParam = searchParams.get("to")?.trim();

  try {
    const result = await convex.query(api.messages.list, convexArgs(agentPubkey, {
      agentPubkey,
      limit,
      offset,
      unread: unread || undefined,
      q: q || undefined,
      contactPubkey: contactPubkey || undefined,
      from: fromParam || undefined,
      to: toParam || undefined,
    }));

    const idsToMarkRead = result.messages
      .filter((m) => m.recipientPubkey === agentPubkey && m.readAt === undefined)
      .map((m) => m.id);
    if (idsToMarkRead.length > 0) {
      await convex.mutation(api.messages.markRead, convexArgs(agentPubkey, {
        agentPubkey,
        messageIds: idsToMarkRead,
      }));
    }

    const pubkeys = [
      ...new Set(
        result.messages.flatMap((m) => [
          m.senderPubkey,
          m.recipientPubkey,
          ...(m.groupPubkey ? [m.groupPubkey] : []),
        ])
      ),
    ];
    const [nameByPubkey, groupNameByPubkey] = await Promise.all([
      convex.query(api.agentNames.resolveNames, convexArgs(agentPubkey, {
        viewerPubkey: agentPubkey,
        pubkeys,
      })),
      convex.query(api.agentNames.resolveGroupNames, convexArgs(agentPubkey, {
        groupPubkeys: result.messages
          .filter((m) => m.groupPubkey)
          .map((m) => m.groupPubkey!),
      })),
    ]);

    const messages = result.messages.map((m) => ({
      id: m.id,
      sender_pubkey: m.senderPubkey,
      sender_name: nameByPubkey[m.senderPubkey],
      recipient_pubkey: m.recipientPubkey,
      recipient_name: nameByPubkey[m.recipientPubkey],
      body: m.body,
      group_pubkey: m.groupPubkey,
      group_name: m.groupPubkey ? groupNameByPubkey[m.groupPubkey] : undefined,
      created_at: m.createdAt,
      read_at: m.readAt,
    }));

    return Response.json({
      messages,
      total: result.total,
      limit: result.limit,
      offset: result.offset,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    if (msg === "Unauthorized") return errorResponse(msg, 401);
    return errorResponse("Internal server error", 500);
  }
});
