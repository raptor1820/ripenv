import "../styles/globals.css";

import { Inter } from "next/font/google";
import type { Metadata } from "next";
import type { PropsWithChildren } from "react";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
    title: "ripenv",
    description: "Local-first key directory for ripenv encrypted env files",
};

export default function RootLayout({ children }: PropsWithChildren) {
    return (
        <html lang="en" className="bg-slate-950">
            <body
                suppressHydrationWarning
                className={`${inter.className} min-h-screen bg-slate-950 antialiased`}>
                {children}
            </body>
        </html>
    );
}
