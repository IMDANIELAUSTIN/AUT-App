import React from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from '@/components/ui/sonner'
import Index from './routes/index'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Index />
    <Toaster />
  </React.StrictMode>,
)
