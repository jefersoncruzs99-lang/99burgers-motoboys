import type { Metadata } from "next";

export const metadata: Metadata = {
  manifest: "/motoboy.webmanifest",
  appleWebApp: { capable: true, title: "Motoboy 99", statusBarStyle: "black" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
