import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import "@/assets/global.css";
import { ThemeProvider } from "@/components/custom/theme-provider";
import {
  Provider,
} from 'react-keep-alive';


ReactDOM.createRoot(document.getElementById('root')!).render(
  // <React.StrictMode>
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <App />
    </ThemeProvider>
  // </React.StrictMode>,
);
