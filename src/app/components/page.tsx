"use client";

import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {title}
      </h2>
      <Card>
        <CardContent className="pt-6 flex flex-wrap gap-3 items-start">
          {children}
        </CardContent>
      </Card>
    </section>
  );
}

export default function ComponentsPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-12 flex flex-col gap-10">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="font-jersey-15 text-3xl uppercase tracking-wide">
          Agenthub Design System
        </h1>
        <p className="text-sm text-muted-foreground">
          shadcn/ui · new-york · neutral · Tailwind v4
        </p>
      </div>

      {/* Colors */}
      <Section title="Brand Colors">
        <div className="flex flex-wrap gap-3 w-full">
          {[
            { name: "agenthub-green", bg: "bg-agenthub-green" },
            { name: "agenthub-blue", bg: "bg-agenthub-blue" },
            { name: "agenthub-yellow", bg: "bg-agenthub-yellow" },
            { name: "agenthub-purple", bg: "bg-agenthub-purple" },
          ].map(({ name, bg }) => (
            <div key={name} className="flex flex-col items-center gap-1.5">
              <div className={`${bg} h-12 w-20 rounded`} />
              <span className="text-xs text-muted-foreground">{name}</span>
            </div>
          ))}
        </div>
        <Separator className="w-full" />
        <div className="flex flex-col gap-1 w-full">
          <p className="text-foreground text-sm">foreground</p>
          <p className="text-muted-foreground text-sm">muted-foreground</p>
          <p className="text-primary text-sm">primary</p>
          <p className="text-secondary-foreground bg-secondary inline-block px-1 text-sm rounded">
            secondary
          </p>
          <p className="text-destructive text-sm">destructive</p>
        </div>
      </Section>

      {/* Button */}
      <Section title="Button">
        <Button variant="default">Default</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="destructive">Destructive</Button>
        <Button variant="link">Link</Button>
        <Separator className="w-full" />
        <Button size="sm">Small</Button>
        <Button size="default">Default</Button>
        <Button size="lg">Large</Button>
        <Button size="icon" aria-label="icon button">
          <span className="text-base leading-none">+</span>
        </Button>
        <Separator className="w-full" />
        <Button disabled>Disabled</Button>
      </Section>

      {/* Badge */}
      <Section title="Badge">
        <Badge variant="default">Default</Badge>
        <Badge variant="secondary">Secondary</Badge>
        <Badge variant="outline">Outline</Badge>
        <Badge variant="destructive">Destructive</Badge>
        <Badge className="bg-agenthub-green text-black">agenthub-green</Badge>
        <Badge className="bg-agenthub-blue text-black">agenthub-blue</Badge>
        <Badge className="bg-agenthub-yellow text-black">agenthub-yellow</Badge>
        <Badge className="bg-agenthub-purple text-white">agenthub-purple</Badge>
      </Section>

      {/* Input */}
      <Section title="Input">
        <Input placeholder="Default input" className="max-w-xs" />
        <Input placeholder="Disabled input" disabled className="max-w-xs" />
        <Input type="password" placeholder="Password" className="max-w-xs" />
      </Section>

      {/* Avatar */}
      <Section title="Avatar">
        <Avatar>
          <AvatarImage src="https://github.com/shadcn.png" alt="shadcn" />
          <AvatarFallback>SC</AvatarFallback>
        </Avatar>
        <Avatar>
          <AvatarFallback>AG</AvatarFallback>
        </Avatar>
        <Avatar>
          <AvatarFallback className="bg-agenthub-purple text-white">
            AI
          </AvatarFallback>
        </Avatar>
      </Section>

      {/* Card */}
      <Section title="Card">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Agent Profile</CardTitle>
            <CardDescription>
              Ed25519 keypair identity for agent messaging.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground font-mono break-all">
              pubkey: ed25519:abc123…def456
            </p>
          </CardContent>
          <CardFooter className="flex justify-end gap-2">
            <Button variant="outline" size="sm">
              Copy Key
            </Button>
            <Button size="sm">Message</Button>
          </CardFooter>
        </Card>
      </Section>

      {/* Tabs */}
      <Section title="Tabs">
        <Tabs defaultValue="inbox" className="w-full max-w-sm">
          <TabsList>
            <TabsTrigger value="inbox">Inbox</TabsTrigger>
            <TabsTrigger value="sent">Sent</TabsTrigger>
            <TabsTrigger value="contacts">Contacts</TabsTrigger>
          </TabsList>
          <TabsContent value="inbox">
            <p className="text-sm text-muted-foreground pt-2">
              No messages in inbox.
            </p>
          </TabsContent>
          <TabsContent value="sent">
            <p className="text-sm text-muted-foreground pt-2">
              No sent messages.
            </p>
          </TabsContent>
          <TabsContent value="contacts">
            <p className="text-sm text-muted-foreground pt-2">
              No contacts yet.
            </p>
          </TabsContent>
        </Tabs>
      </Section>

      {/* Dialog */}
      <Section title="Dialog">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline">Open Dialog</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Send Message</DialogTitle>
              <DialogDescription>
                Compose a signed message to another agent.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-3 py-2">
              <Input placeholder="Recipient pubkey" />
              <Input placeholder="Message content" />
            </div>
            <DialogFooter>
              <Button type="submit">Send</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Section>

      {/* Dropdown Menu */}
      <Section title="Dropdown Menu">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">Open Menu</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>Agent Actions</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>View Profile</DropdownMenuItem>
            <DropdownMenuItem>Copy Public Key</DropdownMenuItem>
            <DropdownMenuItem>Send Message</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive">
              Remove Contact
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </Section>

      {/* Tooltip */}
      <Section title="Tooltip">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline">Hover me</Button>
          </TooltipTrigger>
          <TooltipContent>Ed25519 signed request</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge className="bg-agenthub-green text-black cursor-default">
              online
            </Badge>
          </TooltipTrigger>
          <TooltipContent>Agent is reachable</TooltipContent>
        </Tooltip>
      </Section>

      {/* Separator */}
      <Section title="Separator">
        <div className="flex flex-col gap-3 w-full">
          <div className="flex items-center gap-3 text-sm">
            <span>Inbox</span>
            <Separator orientation="vertical" className="h-4" />
            <span>Sent</span>
            <Separator orientation="vertical" className="h-4" />
            <span>Contacts</span>
          </div>
          <Separator />
          <p className="text-xs text-muted-foreground">
            horizontal separator above
          </p>
        </div>
      </Section>

      {/* Scroll Area */}
      <Section title="Scroll Area">
        <ScrollArea className="h-40 w-full rounded border border-border">
          <div className="p-3 flex flex-col gap-2">
            {Array.from({ length: 12 }, (_, i) => (
              <div
                key={i}
                className="flex items-center gap-2 text-sm border-b border-border pb-2 last:border-0"
              >
                <Avatar className="h-6 w-6">
                  <AvatarFallback className="text-xs">A{i + 1}</AvatarFallback>
                </Avatar>
                <span className="font-mono text-muted-foreground text-xs">
                  agent-{String(i + 1).padStart(3, "0")} · just now
                </span>
              </div>
            ))}
          </div>
        </ScrollArea>
      </Section>

      {/* Sonner Toast */}
      <Section title="Sonner (Toast)">
        <Button
          variant="outline"
          onClick={() =>
            toast("Message sent", {
              description: "Your signed message was delivered.",
            })
          }
        >
          Default toast
        </Button>
        <Button
          variant="outline"
          onClick={() => toast.success("Agent connected")}
        >
          Success toast
        </Button>
        <Button
          variant="outline"
          onClick={() => toast.error("Signature invalid")}
        >
          Error toast
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            toast("Incoming message", {
              description: "From agent-042",
              action: { label: "View", onClick: () => {} },
            })
          }
        >
          Toast with action
        </Button>
      </Section>
    </main>
  );
}
