# Shiki

These are the files needed by the Shiki package to properly perform syntax highlighting on the contents of a file.

---

ATTENTION: MAKE SURE THAT NONE OF THE FILES ABOVE (except for maybe theme) IS POISONED. OTHERWISE, IT COULD LEAD TO XSS.

We use dangerouslySetInnerHTML to inject the syntax highlighted code onto the page. If an attacker, for example, modified the syntax highlighter dependency for Shiki to not sanitize inputs, and just display whatever code it is given, an attacker can upload a file containing malicious HTML (Example file content: `<script>alert("You've just been hacked.");</script>`), and everyone who clicks on the file with malicious HTML will have the unsanitized contents injected onto their page via the contents preview.

---

They are copied here manually from the following locations:

`dist/onig.wasm` <- `node_modules/vscode-oniguruma/release/onig.wasm`

`languages/*` <- `node_modules/shiki/languages/*`

`themes/*` <- a subset of `node_modules/shiki/themes/*`

Upgrading the Shiki package requires that you manually recopy all the files back into this directory. If you don't copy the updated files here, Shiki might not work. For this reason, Shiki's version is static in package.json.

TODO: Find a way to automate copying the files into the current directory and allow automatic updating of package.json.