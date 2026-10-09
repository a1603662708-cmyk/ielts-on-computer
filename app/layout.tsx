import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SessionGuard } from "@/components/SessionGuard";
import { ThemeShell } from "@/components/ThemeShell";

export const metadata: Metadata = {
  title: "IELTS Simulator",
  description:
    "Local IELTS Listening, Reading, Writing and Speaking simulator.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // The contrast and text-size attributes are swapped at runtime by
    // ThemeShell; these are the defaults so the first paint matches.
    <html lang="en" data-contrast="bw" data-textsize="regular">
      <body>
        <SessionGuard>
          <ThemeShell>{children}</ThemeShell>
        </SessionGuard>
      </body>
    </html>
  );
}
