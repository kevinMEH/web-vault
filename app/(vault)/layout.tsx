import "../globals.css";

export default function VaultLayout({ children }: { children: React.ReactNode }) {
    return <body className="bg-white h-screen font-inter">{children}</body>
}