import "../globals.css";

export default function DefaultLayout({ children }: { children: React.ReactNode }) {
    return <body className="bg-light-gray h-screen font-inter">{children}</body>
}