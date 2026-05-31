/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Pretendard", "system-ui", "sans-serif"],
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-8px)" },
        },
        "zzz-rise": {
          "0%": { opacity: "0", transform: "translateY(0) scale(0.7)" },
          "15%": { opacity: "1" },
          "100%": { opacity: "0", transform: "translateY(-36px) scale(1)" },
        },
      },
      animation: {
        float: "float 3s ease-in-out infinite",
        "zzz-1": "zzz-rise 2.4s ease-out 0s infinite",
        "zzz-2": "zzz-rise 2.4s ease-out 0.8s infinite",
        "zzz-3": "zzz-rise 2.4s ease-out 1.6s infinite",
      },
    },
  },
  plugins: [],
};
