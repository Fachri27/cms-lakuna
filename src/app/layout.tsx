import "./globals.css";
import { Fraunces, Instrument_Sans, JetBrains_Mono } from "next/font/google";
import type { Metadata } from "next";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  style: ["normal", "italic"],
});

const instrument = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-instrument",
});

const jet = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jet",
});

export const metadata: Metadata = {
  title: "Lakuna Studio — CMS",
  description: "Panel administrasi & studio kontributor Lakuna Foto.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className={`${fraunces.variable} ${instrument.variable} ${jet.variable}`}
      suppressHydrationWarning
    >
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}