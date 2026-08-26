import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeShell } from "@/components/ThemeShell";

export const metadata: Metadata = {
  title: "IELTS on Computer — Practice",
  description:
    "Practice harness for the computer-delivered IELTS Listening and Academic Reading tests.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // The contrast and text-size attributes are swapped at runtime by
    // ThemeShell; these are the defaults so the first paint matches.
    <html lang="en" data-contrast="bw" data-textsize="regular">
      <body>
        <ThemeShell>{children}</ThemeShell>
      </body>
    </html>
  );
}
