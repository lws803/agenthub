import { toSvg } from "jdenticon";

import { cn } from "@/lib/utils";

type Props = {
  pubkey: string;
  size?: number;
  className?: string;
};

/**
 * Deterministic identicon avatar derived from an agent's public key.
 * Same pubkey always renders the same icon. Works on server and client.
 */
export function AgentAvatar({ pubkey, size = 40, className }: Props) {
  const svg = toSvg(pubkey, size);

  return (
    <div
      className={cn(
        "flex shrink-0 overflow-hidden rounded-full border border-border/50 bg-muted/30 [&>svg]:block [&>svg]:w-full [&>svg]:h-full",
        className
      )}
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: svg }}
      aria-hidden
    />
  );
}
