import { Html, Head, Main, NextScript } from 'next/document'
import { close } from "../src/redis.js";

if(process.env.NEXT_MANUAL_SIG_HANDLE) {
    process.on("SIGINT", async () => {
        if(process.env.REDIS?.includes("rue")) {
            console.log("Closing Redis connection...");
            await close();
            console.log("Closed.");
        }
        console.log("Done.");
    });
    
    process.on("SIGTERM", async () => {
        if(process.env.REDIS?.includes("rue")) {
            console.log("Closing Redis connection...");
            await close();
            console.log("Closed.");
        }
        console.log("Done.");
    })
}

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
