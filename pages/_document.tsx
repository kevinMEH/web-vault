import { Html, Head, Main, NextScript } from 'next/document'
import { close } from "../src/redis.js";

export default function Document() {
  return (
    <Html lang="en">
      <Head />
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
