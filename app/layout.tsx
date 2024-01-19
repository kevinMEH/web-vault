import "./globals.css";
import { inter, pathway, noto_sans_mono } from "../styles/font";
import { Metadata } from "next";

export const metadata: Metadata = {
    title: "Web Vault",
    icons: {
        icon: [ "/favicon.ico" ]
    }
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en" className="text-main font-inter min-h-full overflow-x-clip hide-scrollbar">
            <body className={`bg-light-gray h-screen ${inter.variable} ${pathway.variable} ${noto_sans_mono.variable}`}>{children}</body>
        </html>
    );
}
