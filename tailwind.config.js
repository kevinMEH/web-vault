const defaultTheme = require("tailwindcss/defaultTheme");

/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./components/**/*.{jsx,tsx}",
        "./frames/**/*.{jsx,tsx}",
        "./pages/**/*.{jsx,tsx}",
    ],
    theme: {
        colors: {
            // Generic
            "inherit": "inherit",
            "transparent": "transparent",
            "current": "currentColor",
            
            "white": "#FFFFFF",

            // Theme colors
            "off-white-bg": "#FBFBFC",
            "light-gray": "#F4F5F7",
            "half-gray": "#EEF0F5",
            "gray": "#C9C9D1",

            "accent": {
                "light": "#28A2E5",
                "dark": "#1D75A6"
            },
            
            "error": {
                "light": "#E5286C",
                "dark": "#A41046"
            },
            
            // Text
            "main": "#2A2D33",
            "sub": "#4C4D59",
            "quiet": "#707480"
        },
        fontFamily: {
            "title": [ "var(--font-pathway-extreme)", "var(--font-inter)", ...defaultTheme.fontFamily.sans ],
            "inter": [ "var(--font-inter)", ...defaultTheme.fontFamily.sans ],
            "mono": [ "var(--font-fira-code)", ...defaultTheme.fontFamily.mono ],
        }
    },
    plugins: [],
};
