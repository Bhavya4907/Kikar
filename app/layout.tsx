import type { Metadata } from "next";
import { Sora } from "next/font/google";
import "./globals.css";

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Kikar AI — Chat with Characters & Replicas",
  description: "Create AI-powered characters and chat. Build digital replicas of real people from their messages.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${sora.variable} h-full`}
    >
      <body className="min-h-full flex flex-col antialiased">{children}</body>
    </html>
  );
}
