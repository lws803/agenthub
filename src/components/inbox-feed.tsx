"use client";

import { enUS } from "date-fns/locale";
import { formatDistanceToNowStrict } from "date-fns";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { AgentAvatar } from "@/components/agent-avatar";
import { getInboxMessages, type InboxMessage as Message } from "@/app/actions";

const shortLocale = {
  ...enUS,
  formatDistance: (
    token: string,
    count: number,
    options?: { addSuffix?: boolean; comparison?: number }
  ) => {
    const short: Record<string, string> = {
      xSeconds: `${count}s`,
      xMinutes: `${count}m`,
      xHours: `${count}h`,
      xDays: `${count}d`,
      xMonths: `${count}mo`,
      xYears: `${count}y`,
    };
    let result = short[token] ?? `${count}`;
    if (options?.addSuffix) {
      result = (options.comparison ?? 0) > 0 ? `in ${result}` : `${result} ago`;
    }
    return result;
  },
};

function shortKey(pubkey: string) {
  if (pubkey.length <= 8) return pubkey;
  return pubkey.slice(0, 4) + "…" + pubkey.slice(-4);
}

function timeAgo(dateStr: string) {
  return formatDistanceToNowStrict(new Date(dateStr), {
    addSuffix: true,
    locale: shortLocale,
  });
}

type Props = {
  initialMessages: Message[];
  demoPubkey: string;
};

export function InboxFeed({ initialMessages, demoPubkey }: Props) {
  const [msgs, setMsgs] = useState<Message[]>(initialMessages);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const knownIds = useRef<Set<string>>(
    new Set(initialMessages.map((m) => m.id))
  );

  useEffect(() => {
    const poll = async () => {
      try {
        const incoming = await getInboxMessages();
        const fresh = incoming.filter((m) => !knownIds.current.has(m.id));
        if (fresh.length > 0) {
          fresh.forEach((m) => knownIds.current.add(m.id));
          setNewIds(new Set(fresh.map((m) => m.id)));
          setMsgs(incoming);
          setTimeout(() => setNewIds(new Set()), 1200);
        }
      } catch {}
    };

    const interval = setInterval(poll, 20_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full max-w-2xl">
      {/* Header row */}
      <div className="flex items-center gap-3 mb-2">
        <span className="text-sm text-muted-foreground flex-1 min-w-0 truncate">
          inbox:{" "}
          <Link
            href={`/agents/${encodeURIComponent(demoPubkey)}`}
            className="text-agenthub-blue font-mono hover:underline"
          >
            {demoPubkey}
          </Link>
        </span>
      </div>

      {/* Message list */}
      <div className="border border-border rounded overflow-hidden">
        {/* Live indicator bar */}
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border bg-muted/30 text-sm text-muted-foreground">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-agenthub-green opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-agenthub-green" />
          </span>
          live
        </div>

        <div className="divide-y divide-border max-h-64 overflow-y-auto">
          {msgs.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              no messages yet — be the first
            </div>
          ) : (
            msgs.map((m) => (
              <div
                key={m.id}
                className={`px-3 py-2.5 flex gap-4 items-start text-sm transition-colors duration-700 ${
                  newIds.has(m.id) ? "bg-agenthub-green/10" : ""
                }`}
              >
                <div className="flex shrink-0 gap-3 items-center min-w-0">
                  <AgentAvatar pubkey={m.senderPubkey} size={32} />
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="font-mono text-agenthub-blue truncate">
                      {shortKey(m.senderPubkey)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {timeAgo(m.createdAt)}
                    </span>
                  </div>
                </div>
                <span className="text-foreground flex-1 line-clamp-4 min-w-0">
                  {m.body}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
