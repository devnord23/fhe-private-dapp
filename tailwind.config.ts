import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Zama fhEVM green — encrypted compute layer
        brand: {
          50:  "#f0fdf4",
          100: "#dcfce7",
          200: "#bbf7d0",
          300: "#86efac",
          400: "#4ade80",
          500: "#22c55e",
          600: "#16a34a",
          700: "#15803d",
          800: "#166534",
          900: "#14532d",
          950: "#052e16",
        },
        // Base blue — settlement layer
        base: {
          50:  "#eff6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          300: "#93c5fd",
          400: "#60a5fa",
          500: "#0052FF",  // Base brand blue
          600: "#0042cc",
          700: "#0032a0",
          800: "#002480",
          900: "#001760",
          950: "#000d3d",
        },
        // Dark surface scale
        surface: {
          900: "#060609",
          800: "#0d0d14",
          700: "#12121c",
          600: "#18182a",
          500: "#1e1e30",
          400: "#252538",
          300: "#2e2e44",
          200: "#38385200",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      backgroundImage: {
        "gradient-radial":  "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":   "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
        // Hero mesh — base blue + zama green
        "hero-mesh":
          "radial-gradient(at 0% 0%, hsla(221,100%,20%,0.5) 0, transparent 55%)," +
          "radial-gradient(at 100% 0%, hsla(148,70%,15%,0.4) 0, transparent 50%)," +
          "radial-gradient(at 50% 100%, hsla(221,100%,12%,0.3) 0, transparent 60%)",
        // Subtle grid pattern
        "grid-pattern":
          "linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px)," +
          "linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)",
      },
      boxShadow: {
        "glow-blue":  "0 0 30px rgba(0,82,255,0.15), 0 0 60px rgba(0,82,255,0.05)",
        "glow-green": "0 0 30px rgba(34,197,94,0.15), 0 0 60px rgba(34,197,94,0.05)",
        "glow-sm-blue":  "0 0 12px rgba(0,82,255,0.2)",
        "glow-sm-green": "0 0 12px rgba(34,197,94,0.2)",
        "glass": "0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)",
        "glass-lg": "0 20px 60px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)",
      },
      animation: {
        "fade-in":        "fadeIn 0.5s ease-in-out",
        "fade-up":        "fadeUp 0.6s cubic-bezier(0.16,1,0.3,1)",
        "slide-up":       "slideUp 0.4s ease-out",
        "pulse-slow":     "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "gradient-x":     "gradientX 6s ease infinite",
        "shimmer":        "shimmer 2.5s linear infinite",
        "float":          "float 6s ease-in-out infinite",
        "glow-pulse-blue":  "glowPulseBlue 3s ease-in-out infinite alternate",
        "glow-pulse-green": "glowPulseGreen 3s ease-in-out infinite alternate",
        "scan-line":      "scanLine 3s linear infinite",
        "border-flow":    "borderFlow 4s linear infinite",
      },
      keyframes: {
        fadeIn: {
          "0%":   { opacity: "0" },
          "100%": { opacity: "1" },
        },
        fadeUp: {
          "0%":   { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideUp: {
          "0%":   { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        gradientX: {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%":      { backgroundPosition: "100% 50%" },
        },
        shimmer: {
          "0%":   { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%":      { transform: "translateY(-6px)" },
        },
        glowPulseBlue: {
          "0%":   { boxShadow: "0 0 8px rgba(0,82,255,0.2)" },
          "100%": { boxShadow: "0 0 24px rgba(0,82,255,0.5)" },
        },
        glowPulseGreen: {
          "0%":   { boxShadow: "0 0 8px rgba(34,197,94,0.2)" },
          "100%": { boxShadow: "0 0 24px rgba(34,197,94,0.5)" },
        },
        scanLine: {
          "0%":   { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(400%)" },
        },
        borderFlow: {
          "0%":   { backgroundPosition: "0% 50%" },
          "100%": { backgroundPosition: "200% 50%" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
