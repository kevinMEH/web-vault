import { Html, Head, Main, NextScript } from 'next/document'
import { shutdown } from "../src/cleanup";

if(process.env.NEXT_MANUAL_SIG_HANDLE) {
    process.on("SIGINT", async () => {
        await shutdown();
    });
    
    process.on("SIGTERM", async () => {
        await shutdown();
    });
}

export default function Document() {
  return (
    <Html lang="en" className="text-main font-inter min-h-full overflow-x-clip hide-scrollbar">
      <Head />
      <body className="bg-light-gray h-screen">
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
