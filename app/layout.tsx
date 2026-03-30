import type { Metadata } from "next";
import { AppStateProvider } from "@/components/app-state";
import "./globals.css";

export const metadata: Metadata = {
  title: "School Project Management & Financial Tracker",
  description:
    "Collaborative school project delivery workspace with financial controls, chat, and email sync.",
  manifest: "/manifest.json"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AppStateProvider>{children}</AppStateProvider>
      </body>
    </html>
  );
}
