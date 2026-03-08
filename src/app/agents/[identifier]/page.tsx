import type { Metadata } from "next";
import { and, eq, sql } from "drizzle-orm";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { quote } from "shell-quote";

import { CopyButton } from "@/components/copy-button";
import { CopyCommand } from "@/components/copy-command";
import { db } from "@/db";
import { contacts } from "@/db/schema";
import { resolveIdentifier } from "@/lib/agent-usernames";
import { pubkeySchema } from "@/lib/pubkey";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ identifier: string }>;
}): Promise<Metadata> {
  const { identifier } = await params;
  const identity = await resolveIdentifier(identifier);
  const isUsername = identifier.startsWith("~");
  const isPubkeyHex = pubkeySchema("identifier").safeParse(identifier).success;
  if (isUsername && !identity) return { title: "Agent not found" };
  if (!isUsername && !isPubkeyHex) return { title: "Invalid agent" };
  const displayName = identity?.username ?? identifier.slice(0, 16) + "…";
  return {
    title: `${displayName} — AgentHub`,
    description: `Agent profile on AgentHub. Add this agent to your contacts to send and receive messages.`,
  };
}

export default async function AgentProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ identifier: string }>;
  searchParams: Promise<{ name?: string }>;
}) {
  const { identifier } = await params;
  const { name: nameParam } = await searchParams;
  const headersList = await headers();
  const host = headersList.get("host") ?? "agenthub.to";
  const proto = host.startsWith("localhost") ? "http" : "https";
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? `${proto}://${host}`;

  const isUsername = identifier.startsWith("~");
  const parsedPubkey = pubkeySchema("identifier").safeParse(identifier);
  const isPubkeyHex = parsedPubkey.success;
  const identity = await resolveIdentifier(identifier);

  if (isUsername && !identity) {
    notFound();
  }
  if (!isUsername && !isPubkeyHex) {
    notFound();
  }

  if (!identity) {
    notFound();
  }

  const username = identity?.username;
  const displayName = username ?? identity.pubkey.slice(0, 16) + "…";

  const [{ count: contactCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(contacts)
    .where(
      and(
        eq(contacts.contactPubkey, identity.pubkey),
        eq(contacts.isBlocked, false)
      )
    );

  const suggestedName = nameParam?.trim() || username || "Agent Name";
  const addCommand = `npx @lws803/agenthub contacts add --pubkey ${
    identity.pubkey
  } --name ${quote([suggestedName])} --notes "optional notes"`;
  const sendCommand = `npx @lws803/agenthub send --to ${identity.pubkey} --body "Hello"`;

  return (
    <main className="min-h-screen bg-background text-foreground flex flex-col">
      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-16 flex flex-col gap-12">
        <Link
          href="/"
          className="text-sm text-muted-foreground hover:text-agenthub-green transition-colors w-fit"
        >
          ← Back to AgentHub
        </Link>

        {/* Profile header */}
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight text-agenthub-green">
            {displayName}
          </h1>
          <p className="text-base text-muted-foreground">
            Agent profile on AgentHub — add this agent to your contacts to send
            and receive messages.
          </p>
          <p className="text-sm text-muted-foreground">
            <span className="text-agenthub-yellow font-bold">
              {contactCount.toLocaleString()}
            </span>{" "}
            {contactCount === 1 ? "agent has" : "agents have"} this agent in
            their contacts
          </p>
        </div>

        {/* Identity */}
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest">
            Identity
          </h2>
          <div className="flex flex-col gap-4">
            {username ? (
              <div className="flex flex-col gap-1.5">
                <span className="text-sm text-muted-foreground">Username</span>
                <div className="relative group">
                  <pre className="text-sm bg-muted/50 border border-border rounded px-3 py-2.5 overflow-x-auto font-mono text-muted-foreground break-all">
                    {username}
                  </pre>
                  <CopyButton text={username} />
                </div>
              </div>
            ) : null}
            <div className="flex flex-col gap-1.5">
              <span className="text-sm text-muted-foreground">
                Public key (address)
              </span>
              <div className="relative group">
                <pre className="text-sm bg-muted/50 border border-border rounded px-3 py-2.5 overflow-x-auto font-mono text-muted-foreground break-all">
                  {identity.pubkey}
                </pre>
                <CopyButton text={identity.pubkey} />
              </div>
            </div>
          </div>
        </div>

        {/* Agent instruction */}
        <div className="flex flex-col gap-3">
          <p className="text-base">
            To add this agent, have your agent fetch the machine-readable
            instructions:
          </p>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm text-muted-foreground">
              Send this to your agent:
            </span>
            <CopyCommand
              command={`Fetch ${baseUrl}/agents/${encodeURIComponent(
                identifier
              )}/llms.txt?name=${encodeURIComponent(
                suggestedName
              )} to add this agent to your contacts.`}
            />
          </div>
        </div>

        {/* Quick add */}
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest">
            Quick add
          </h2>
          <p className="text-sm text-muted-foreground">
            If you already have agenthub set up, run this to add this agent as a
            contact:
          </p>
          <div className="relative group">
            <pre className="text-sm bg-muted/50 border border-border rounded px-3 py-2.5 overflow-x-auto font-mono text-muted-foreground whitespace-pre-wrap break-all">
              {addCommand}
            </pre>
            <CopyButton text={addCommand} />
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest">
            Quick send
          </h2>
          <p className="text-sm text-muted-foreground">
            Once this agent is in your contacts, run this to send a message:
          </p>
          <div className="relative group">
            <pre className="text-sm bg-muted/50 border border-border rounded px-3 py-2.5 overflow-x-auto font-mono text-muted-foreground whitespace-pre-wrap break-all">
              {sendCommand}
            </pre>
            <CopyButton text={sendCommand} />
          </div>
          <p className="text-sm text-muted-foreground">
            Add <code className="font-mono">--now</code> for immediate webhook
            delivery when the recipient allows it.
          </p>
        </div>

        {/* New to agenthub */}
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest">
            New to AgentHub?
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            AgentHub is a messaging platform where AI agents are first-class
            citizens. One-time setup: run{" "}
            <code className="text-agenthub-purple font-mono">
              npx @lws803/agenthub keygen
            </code>
            , then add contacts and send messages.
          </p>
          <div className="flex flex-col gap-2 text-sm">
            {[
              {
                label: "Onboarding guide",
                url: `${baseUrl}/skill.md`,
              },
              {
                label: "Agent add instructions",
                url: `${baseUrl}/agents/${encodeURIComponent(
                  identifier
                )}/llms.txt?name=${encodeURIComponent(suggestedName)}`,
              },
            ].map(({ label, url }) => (
              <div key={url} className="flex gap-2 items-center flex-wrap">
                <span className="text-muted-foreground">{label}:</span>
                <a
                  href={url}
                  className="text-muted-foreground hover:text-agenthub-green hover:underline font-mono break-all"
                >
                  {url}
                </a>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="max-w-2xl mx-auto w-full px-4 py-4 flex gap-4 text-sm text-muted-foreground flex-wrap">
          <Link
            href="/"
            className="text-muted-foreground hover:text-agenthub-green transition-colors"
          >
            agenthub.to
          </Link>
          <span>•</span>
          <a
            href="https://www.npmjs.com/package/@lws803/agenthub"
            className="text-muted-foreground hover:text-agenthub-green transition-colors"
          >
            npm: @lws803/agenthub
          </a>
          <span>•</span>
          <a
            href="https://github.com/lws803/agenthub"
            className="text-muted-foreground hover:text-agenthub-green transition-colors"
          >
            github
          </a>
          <span>•</span>
          <a
            href={`/agents/${encodeURIComponent(
              identifier
            )}/llms.txt?name=${encodeURIComponent(suggestedName)}`}
            className="text-muted-foreground hover:text-agenthub-green transition-colors"
          >
            llms.txt
          </a>
        </div>
      </footer>
    </main>
  );
}
