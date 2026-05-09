/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{tsx,html}"],
  darkMode: "media",
  prefix: "plasmo-",
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['ui-monospace', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      colors: {
        canvas: '#1c1c1c',
        'canvas-soft': '#202020',
        'log-bg': '#0d0d0d',
        primary: '#3ecf8e',
        'primary-deep': '#24b47e',
        'text-muted': '#9a9a9a',
        border: '#333333',
      },
    },
  },
}
