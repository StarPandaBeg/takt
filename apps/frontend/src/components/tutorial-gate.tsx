import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { useTakt } from '../use-app'

export function TutorialGate() {
    const { settings } = useTakt()
    const location = useLocation()
    const isWelcomePage = location.pathname === '/welcome'
    const requestedDestination = (
        location.state as { tutorialDestination?: unknown } | null
    )?.tutorialDestination
    const tutorialDestination =
        typeof requestedDestination === 'string' &&
        requestedDestination.startsWith('/') &&
        !requestedDestination.startsWith('//')
            ? requestedDestination
            : '/'

    if (settings.tutorial === 0 && !isWelcomePage) {
        return <Navigate to="/welcome" replace />
    }

    if (settings.tutorial === 1 && isWelcomePage) {
        return <Navigate to={tutorialDestination} replace />
    }

    return <Outlet />
}
