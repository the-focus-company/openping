import type { Metadata } from "next";
import localFont from "next/font/local";
import { ConvexClientProvider } from "@/components/providers/ConvexClientProvider";
import { PostHogProvider } from "@/components/providers/PostHogProvider";
import "@/lib/env";
import "./globals.css";

const geist = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist",
  display: "swap",
});

const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "OpenPing",
  description: "Your team's second brain",
  openGraph: {
    title: "OpenPing — AI-Native Workspace",
    description:
      "AI-powered team communication with Eisenhower inbox, smart alerts, and deep integrations.",
    images: ["/og-image.png"],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "OpenPing — AI-Native Workspace",
    description:
      "AI-powered team communication with Eisenhower inbox, smart alerts, and deep integrations.",
    images: ["/og-image.png"],
  },
  manifest: "/manifest.json",
  themeColor: "#5E6AD2",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("ping-theme");if(!t)t="dark";if(t==="dark")document.documentElement.classList.add("dark")}catch(e){document.documentElement.classList.add("dark")}})();`,
          }}
        />
      </head>
      <body className={`${geist.variable} ${geistMono.variable} font-sans antialiased`} suppressHydrationWarning>
        <PostHogProvider>
          <ConvexClientProvider>{children}</ConvexClientProvider>
        </PostHogProvider>
      </body>
    </html>
  );
}
