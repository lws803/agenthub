import { CopyButton } from "@/components/copy-button";

export function CopyCommand({ command }: { command: string }) {
  return (
    <div className="relative group">
      <pre className="text-sm bg-muted/50 border border-border rounded px-3 py-2.5 overflow-x-auto font-mono text-muted-foreground whitespace-pre-wrap break-all">
        {command}
      </pre>
      <CopyButton text={command} />
    </div>
  );
}
