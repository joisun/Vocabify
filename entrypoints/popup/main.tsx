import ReactDOM from 'react-dom/client'
import App from './App'
import { ThemeProvider } from '@/components/custom/theme-provider'

import '@/assets/global.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <ThemeProvider defaultTheme="system">
    <App />
  </ThemeProvider>,
)
