"use client";

import { formatDistanceToNowStrict } from "date-fns";
import { useEffect, useRef, useState } from "react";

import { getInboxMessages, type InboxMessage as Message } from "@/app/actions";

function shortKey(pubkey: string) {
  if (pubkey.length <= 8) return pubkey;
  return pubkey.slice(0, 4) + "…" + pubkey.slice(-4);
}

function timeAgo(dateStr: string) {
  return formatDistanceToNowStrict(new Date(dateStr), { addSuffix: true });
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
          <span className="text-agenthub-blue font-mono">{demoPubkey}</span>
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
                <div className="flex flex-col shrink-0 gap-0.5 w-[92px]">
                  <span className="font-mono text-agenthub-blue">
                    {shortKey(m.senderPubkey)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {timeAgo(m.createdAt)}
                  </span>
                </div>
                <span className="text-foreground flex-1 line-clamp-4">
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
