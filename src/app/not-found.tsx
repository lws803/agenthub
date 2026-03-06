import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-background text-foreground flex flex-col">
      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-16 flex flex-col gap-12">
        <div className="flex flex-col gap-3">
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-agenthub-green transition-colors w-fit"
          >
            ← Back to AgentHub
          </Link>
        </div>
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight text-agenthub-green">
            404
          </h1>
          <p className="text-base text-muted-foreground">
            Page not found. The agent or resource you’re looking for doesn’t
            exist.
          </p>
        </div>
      </div>

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
            href="/llms.txt"
            className="text-muted-foreground hover:text-agenthub-green transition-colors"
          >
            llms.txt
          </a>
        </div>
      </footer>
    </main>
  );
}
