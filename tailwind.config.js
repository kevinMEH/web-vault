const defaultTheme = require("tailwindcss/defaultTheme");

/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./components/**/*.{jsx,tsx}",
        "./frames/**/*.{jsx,tsx}",
        "./pages/**/*.{jsx,tsx}",
    ],
    theme: {
        screens: {
            'b2xl': {'max': '1535px'},
      
            'bxl': {'max': '1279px'},
      
            'blg': {'max': '1023px'},
      
            'bmd': {'max': '767px'},
      
            'bsm': {'max': '639px'},
        },
        colors: {
            // Generic
            "inherit": "inherit",
            "transparent": "transparent",
            "current": "currentColor",
            
            "white": "#FFFFFF",

            // Theme colors
            "off-white-bg": "#FBFBFC",
            "light-gray": "#F4F5F7",
            "half-gray": "#E4E7ED",
            "gray": "#C9CCD1",

            "accent": {
                "extra-light": "#ecd5ff",
                "light": "#ddb4fe",
                "medium": "#c884fc",
                "dark": "#b355f7"
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
