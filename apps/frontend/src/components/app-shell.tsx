import { CalendarDays, Home, NotebookPen, Settings } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'

const navigation = [
    { to: '/', label: 'Главная', icon: Home, end: true },
    { to: '/calendar', label: 'Календарь', icon: CalendarDays, end: false },
    { to: '/notes', label: 'Заметки', icon: NotebookPen, end: false },
]

export function AppShell() {
    return (
        <div className="app-shell">
            <aside className="sidebar">
                <NavLink
                    className="brand"
                    to="/"
                    aria-label="Takt — на главную"
                >
                    <span className="brand__mark">T</span>
                </NavLink>
                <nav className="main-nav" aria-label="Основная навигация">
                    {navigation.map(({ to, label, icon: Icon, end }) => (
                        <NavLink
                            key={to}
                            className={({ isActive }) =>
                                `nav-item${isActive ? ' nav-item--active' : ''}`
                            }
                            to={to}
                            end={end}
                            title={label}
                        >
                            <Icon
                                aria-hidden="true"
                                size={20}
                                strokeWidth={1.8}
                            />
                            <span>{label}</span>
                        </NavLink>
                    ))}
                </nav>
                <button
                    className="nav-item sidebar__settings"
                    type="button"
                    title="Настройки"
                >
                    <Settings size={20} strokeWidth={1.8} />
                    <span>Настройки</span>
                </button>
            </aside>
            <main className="app-content">
                <Outlet />
            </main>
            <nav className="mobile-nav" aria-label="Мобильная навигация">
                {navigation.map(({ to, label, icon: Icon, end }) => (
                    <NavLink
                        key={to}
                        className={({ isActive }) =>
                            `mobile-nav__item${isActive ? ' is-active' : ''}`
                        }
                        to={to}
                        end={end}
                    >
                        <Icon size={20} strokeWidth={1.8} />
                        <span>{label}</span>
                    </NavLink>
                ))}
            </nav>
        </div>
    )
}
