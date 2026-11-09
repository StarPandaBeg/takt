import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'

import '@fullcalendar/react/skeleton.css'
import '@fullcalendar/react/themes/classic/palette.css'
import '@fullcalendar/react/themes/classic/theme.css'

import { AppProvider } from './app-provider'
import { router } from './router'
import './styles.css'

import 'animate.css/animate.min.css'

const rootElement = document.getElementById('root')

if (!rootElement) {
    throw new Error('Root element was not found')
}

createRoot(rootElement).render(
    <StrictMode>
        <AppProvider>
            <RouterProvider router={router} />
        </AppProvider>
    </StrictMode>,
)
