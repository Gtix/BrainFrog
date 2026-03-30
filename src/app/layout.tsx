import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "next-themes";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Brain Frog — The AI Agent That Shows Its Work",
  description:
    "Brain Frog is an AI agent platform with ReAct reasoning, visible tool execution, multi-LLM support, conversation branching, skill chaining, and persistent hierarchical memory.",
  keywords: [
    "Brain Frog",
    "AI Agent",
    "AI Platform",
    "Multi-LLM",
    "ReAct Reasoning",
    "Hierarchical Memory",
    "Security Scanning",
    "Skill Framework",
    "Conversation Branching",
  ],
  authors: [{ name: "Brain Frog Team" }],
  icons: {
    icon: "/brain-frog-logo.png",
  },
  openGraph: {
    title: "Brain Frog — The AI Agent That Shows Its Work",
    description: "An AI agent platform with ReAct reasoning, visible tool execution, multi-LLM support, and persistent memory.",
    type: "website",
    images: ["/brain-frog-logo.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Brain Frog — The AI Agent That Shows Its Work",
    description: "An AI agent platform with ReAct reasoning, visible tool execution, multi-LLM support, and persistent memory.",
    images: ["/brain-frog-logo.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
