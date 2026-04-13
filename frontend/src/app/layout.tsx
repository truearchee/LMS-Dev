import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Nexus LMS",
  description: "Next-Generation AI-Native LMS",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full m-0 p-0">
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
