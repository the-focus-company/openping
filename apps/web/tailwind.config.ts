import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // PING design tokens
        ping: {
          purple: "#5E6AD2",          // Linear purple — primary accent
          "purple-hover": "#6E79D6",
          "purple-muted": "rgba(94,106,210,0.12)",
        },
        surface: {
          0: "hsl(var(--surface-0))",
          1: "hsl(var(--surface-1))",
          2: "hsl(var(--surface-2))",
          3: "hsl(var(--surface-3))",
        },
        status: {
          online:  "#22C55E",
          danger:  "#EF4444",
          warning: "#F59E0B",
          info:    "#3B82F6",
          merged:  "#A855F7",
        },
        // Priority colors for inbox cards
        priority: {
          urgent:    "#EF4444",  // Do Now
          important: "#F59E0B",  // Schedule
          delegate:  "#3B82F6",  // Delegate
          low:       "#5E6AD2",  // Eliminate/Low
        },
      },
      fontFamily: {
        sans: ["var(--font-geist)", "var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "var(--font-mono)", "JetBrains Mono", "monospace"],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 1px)",
        sm: "calc(var(--radius) - 2px)",
        xl: "calc(var(--radius) + 4px)",
      },
      fontSize: {
        "2xs": ["10px", { lineHeight: "14px" }],
        xs:   ["11px", { lineHeight: "16px" }],
        sm:   ["12px", { lineHeight: "18px" }],
        base: ["13px", { lineHeight: "20px" }],
        md:   ["14px", { lineHeight: "20px" }],
        lg:   ["15px", { lineHeight: "22px" }],
        xl:   ["17px", { lineHeight: "24px" }],
        "2xl": ["20px", { lineHeight: "28px" }],
        "3xl": ["24px", { lineHeight: "32px" }],
      },
      spacing: {
        "topbar": "48px",
        "sidebar": "240px",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "slide-up": {
          from: { transform: "translateY(100%)", opacity: "0" },
          to: { transform: "translateY(0)", opacity: "1" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "slide-up": "slide-up 200ms ease forwards",
        "fade-in": "fade-in 160ms ease forwards",
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;
