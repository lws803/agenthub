import { withAuth } from "@/lib/auth";
import { isUsernameIdentifier, resolveIdentifier } from "@/lib/agent-usernames";

export const runtime = "edge";

export const GET = withAuth(async (request) => {
  const username = request.nextUrl.searchParams.get("username") ?? "";

  if (!isUsernameIdentifier(username)) {
    return new Response(
      JSON.stringify({
        error:
          "Query parameter 'username' must be a valid username like '~swiftfox123'",
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const identity = await resolveIdentifier(username);
  if (!identity) {
    return new Response(JSON.stringify({ error: "Username not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  return Response.json({
    pubkey: identity.pubkey,
    username: identity.username,
  });
});
