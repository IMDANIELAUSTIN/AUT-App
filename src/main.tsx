import React from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from '@/components/openui/sonner'
import Index from './routes/index'
import '@openuidev/react-ui/components.css'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Index />
    <Toaster />
  </React.StrictMode>,
)
