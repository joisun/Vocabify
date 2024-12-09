/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./entrypoints/**/*.{html,ts,tsx}",
    "./components/**/*.{html,ts,tsx}",
  ],
  theme: {
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
      },
      borderRadius: {
        lg: `var(--radius)`,
        md: `calc(var(--radius) - 2px)`,
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        scaleUp: {
          "0%": { transform: "scale(0.4)" },
          "100%": { transform: "scale(1)" },
        },
      },
      animation: {
        scaleUp: "scaleUp 1s ease-in-out",
      },
      typography: {
        compact: {
          css: {
            // 全局行高调整
            lineHeight: 1.1,  // 略微增加，提供更好的可读性
            
            // 标题间距
            'h1': {
              marginTop: '0.5em',
              marginBottom: '0.3em',
            },
            'h2': {
              marginTop: '0.4em',
              marginBottom: '0.2em',
            },
      
            // 段落间距
            'p': {
              marginTop: '0.4em',
              marginBottom: '0.4em',
            },
            
            // 强调文本与段落间距
            'strong': {
              marginBottom: '0.2em',  // 给 strong 元素一些额外空间
            },
      
            // 列表样式
            'ul, ol': {
              marginTop: '0.2em',    // 减少顶部间距
              marginBottom: '0.2em', // 减少底部间距
              paddingLeft: '1em',    // 稍微减少左侧缩进
            },
            'ul': {
              listStyleType: 'disc',
            },
            'ol': {
              listStyleType: 'decimal',
            },
            'ul li, ol li': {
              marginTop: '0.1em',    // 减少 li 元素之间的垂直间距
              marginBottom: '0.1em',
              paddingLeft: '0.3em',  // 减少内部缩进
            },
      
            // 段落和列表之间的间距
            'p + ul, p + ol': {
              marginTop: '0.2em',
            },
            'ul + p, ol + p': {
              marginTop: '0.2em',
            },
      
            // 其他元素保持不变
            'blockquote': {
              marginTop: '0.4em',
              marginBottom: '0.4em',
              paddingLeft: '1em',
              borderLeftWidth: '3px',
              borderLeftColor: 'theme(colors.gray.300)',
            },
      
            'table': {
              marginTop: '0.3em',
              marginBottom: '0.3em',
              borderCollapse: 'collapse',
            },
            'table th, table td': {
              borderWidth: '1px',
              borderColor: 'theme(colors.gray.300)',
              padding: '0.4em',
            },
      
            'pre': {
              marginTop: '0.4em',
              marginBottom: '0.4em',
              padding: '0.6em',
              backgroundColor: 'theme(colors.gray.100)',
              borderRadius: '0.4em',
              fontSize: '0.95em',
            },
          },
        },
      },
    }
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
};
