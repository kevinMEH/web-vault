import "../styles/globals.css";
import type { AppProps } from "next/app";

import { inter, pathway, noto_sans_mono } from "../styles/font";

export default function App({ Component, pageProps }: AppProps) {
    return <main className={`${inter.variable} ${pathway.variable} ${noto_sans_mono.variable}`}>
        <Component {...pageProps} />
    </main>
}
