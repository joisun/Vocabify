import React from 'react'
import ReactDOM from 'react-dom/client'
import { ThemeProvider } from '@/components/custom/theme-provider'
import App from './App'

import '@/assets/global.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider defaultTheme="system">
      <App />
    </ThemeProvider>
  </React.StrictMode>,
)
