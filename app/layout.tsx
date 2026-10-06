import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Folio — Notes & Tasks",
  description:
    "A clear, private workspace for your notes, tasks, and daily plans. AI is optional.",
  icons: { icon: "/favicon.svg" },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
