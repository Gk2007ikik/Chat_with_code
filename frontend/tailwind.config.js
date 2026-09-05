import typography from '@tailwindcss/typography'

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0A0A0C",
        panel: "#131316",
        border: "#232327",
        text: "#E4E4E7",
        muted: "#8B8B93",
        accent: "#34D399",
        userAccent: "#60A5FA",
      },
      fontFamily: {
        sans: ["IBM Plex Sans", "sans-serif"],
        mono: ["IBM Plex Mono", "monospace"],
        techno: ["Orbitron", "sans-serif"],
      },
    },
  },
  plugins: [typography],
}
