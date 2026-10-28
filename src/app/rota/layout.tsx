import type { Metadata } from "next";

export const metadata: Metadata = {
  manifest: "/rota.webmanifest",
  appleWebApp: { capable: true, title: "Rota 99", statusBarStyle: "black" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
