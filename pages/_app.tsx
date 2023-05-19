import "../styles/globals.css";
import type { AppProps } from "next/app";

import { inter, pathway, fira } from "../styles/font";

export default function App({ Component, pageProps }: AppProps) {
    return <main className={`${inter.variable} ${pathway.variable} ${fira.variable}`}>
        <Component {...pageProps} />
    </main>
}
