import { createBrowserRouter } from 'react-router-dom'

import { AppShell } from './components/app-shell'
import { CalendarPage } from './pages/calendar-page'
import { DashboardPage } from './pages/dashboard-page'
import { DiagnosticsPage } from './pages/diagnostics-page'
import { NotesPage } from './pages/notes-page'

export const router = createBrowserRouter([
    {
        path: '/',
        Component: AppShell,
        children: [
            { index: true, Component: DashboardPage },
            { path: 'calendar', Component: CalendarPage },
            { path: 'notes', Component: NotesPage },
            { path: 'diagnostics', Component: DiagnosticsPage },
        ],
    },
])
