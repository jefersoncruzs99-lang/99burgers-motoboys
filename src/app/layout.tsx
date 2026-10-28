import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Motoboys | Nove Nove Burgers",
  description: "Escala, chegada, valores e contratos dos motoboys.",
  icons: { icon: "/logo.svg", apple: "/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "Motoboys 99", statusBarStyle: "black" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#000000",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
