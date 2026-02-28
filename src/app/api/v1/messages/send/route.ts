import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { groupMembers, groups, messages } from "@/db/schema";
import { withAuth } from "@/lib/auth";

export const POST = withAuth(async (request, { agentPubkey, rawBody }) => {
  let body: { recipient_pubkey?: string; body?: string };
  try {
    body = JSON.parse(rawBody);
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const recipientPubkey = body.recipient_pubkey?.trim();
  const messageBody = body.body;

  if (!recipientPubkey || messageBody === undefined || messageBody === null) {
    return new Response(
      JSON.stringify({ error: "recipient_pubkey and body are required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const bodyStr = String(messageBody);

  const [group] = await db
    .select({ id: groups.id, pubkey: groups.pubkey })
    .from(groups)
    .where(eq(groups.pubkey, recipientPubkey))
    .limit(1);

  if (group) {
    const [membership] = await db
      .select()
      .from(groupMembers)
      .where(
        and(
          eq(groupMembers.groupId, group.id),
          eq(groupMembers.memberPubkey, agentPubkey)
        )
      )
      .limit(1);

    if (!membership) {
      return new Response(JSON.stringify({ error: "Not a group member" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    const otherMembers = await db
      .select({ memberPubkey: groupMembers.memberPubkey })
      .from(groupMembers)
      .where(
        and(
          eq(groupMembers.groupId, group.id),
          ne(groupMembers.memberPubkey, agentPubkey)
        )
      );

    const fanOutRows = otherMembers.map((m) => ({
      senderPubkey: group.pubkey,
      recipientPubkey: m.memberPubkey,
      body: bodyStr,
      originalSenderPubkey: agentPubkey,
    }));
    if (fanOutRows.length > 0) {
      await db.insert(messages).values(fanOutRows);
    }

    const [senderCopy] = await db
      .insert(messages)
      .values({
        senderPubkey: agentPubkey,
        recipientPubkey: group.pubkey,
        body: bodyStr,
      })
      .returning({ id: messages.id, createdAt: messages.createdAt });

    if (!senderCopy) {
      return new Response(
        JSON.stringify({ error: "Failed to create message" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    return Response.json({
      id: senderCopy.id,
      created_at: senderCopy.createdAt,
    });
  }

  const [msg] = await db
    .insert(messages)
    .values({
      senderPubkey: agentPubkey,
      recipientPubkey,
      body: bodyStr,
    })
    .returning({ id: messages.id, createdAt: messages.createdAt });

  if (!msg) {
    return new Response(JSON.stringify({ error: "Failed to create message" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return Response.json({
    id: msg.id,
    created_at: msg.createdAt,
  });
});
