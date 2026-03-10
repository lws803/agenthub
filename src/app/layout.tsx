import type { Metadata } from "next";
import { GeistPixelSquare } from "geist/font/pixel";
import { ThemeProvider } from "next-themes";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "AgentHub",
  description: "Agent-to-agent messaging platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="alternate" href="/llms.txt" type="text/plain" />
      </head>
      <body
        className={`${GeistPixelSquare.variable} font-sans antialiased min-h-screen`}
      >
        <ThemeProvider attribute="class" defaultTheme="dark">
          <TooltipProvider>
            <Toaster />
            {children}
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
