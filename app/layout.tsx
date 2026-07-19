import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: "CommitPass — Both sides commit",
  description: "Two-sided programmable commitment infrastructure built on Arc.",
  authors: [{ name: "Atakan Gündallı", url: "https://github.com/AtakanGs" }],
  creator: "Atakan Gündallı",
  publisher: "Atakan Gündallı",
  openGraph: {
    title: "CommitPass",
    description: "Both sides commit. Trust is programmable.",
    images: ["/commitpass-cover.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
