import {
    ArrowLeft,
    ArrowRight,
    CalendarDays,
    CalendarPlus,
    Check,
    CheckCheck,
    ChevronLeft,
    ListTodo,
    Mic,
    MoreHorizontal,
    NotebookPen,
    Paperclip,
    Send,
} from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { useToast } from '../context/use-toast'
import { useTakt } from '../use-app'

const TELEGRAM_BOT_URL = 'https://t.me/takt_control_bot'

function DeviceDemo() {
    return (
        <div className="welcome-device" aria-label="Экран устройства Takt">
            <div className="welcome-device__screen">
                <header className="welcome-screen-header">
                    <div>
                        <span>Вторник</span>
                        <strong>10 ноября</strong>
                    </div>
                    <div className="welcome-screen-week">
                        <span>
                            Пн<small>9</small>
                        </span>
                        <span className="is-current">
                            Вт<small>10</small>
                        </span>
                        <span>
                            Ср<small>11</small>
                        </span>
                        <span>
                            Чт<small>12</small>
                        </span>
                        <span>
                            Пт<small>13</small>
                        </span>
                    </div>
                </header>
                <div className="welcome-screen-body">
                    <section className="welcome-screen-agenda">
                        <h3>Сегодня</h3>
                        <div className="welcome-screen-event">
                            <time>10:00</time>
                            <div>
                                <strong>Планирование недели</strong>
                                <span>до 10:45</span>
                            </div>
                        </div>
                        <div className="welcome-screen-event">
                            <time>14:30</time>
                            <div>
                                <strong>Созвон с командой</strong>
                                <span>онлайн</span>
                            </div>
                        </div>
                        <div className="welcome-screen-event">
                            <time>18:00</time>
                            <div>
                                <strong>Прогулка</strong>
                            </div>
                        </div>
                    </section>
                    <aside className="welcome-screen-aside">
                        <div>
                            <h3>Срок</h3>
                            <strong>Отправить макеты</strong>
                            <span>сегодня до 18:00</span>
                        </div>
                        <div>
                            <h3>Заметка</h3>
                            <p>Купить кофе и забрать посылку</p>
                        </div>
                    </aside>
                </div>
                <footer className="welcome-screen-footer">
                    <span>3 события</span>
                    <span>обновлено 09:32</span>
                </footer>
            </div>
        </div>
    )
}

function CalendarDemo() {
    const days = [
        ['9', ''],
        ['10', 'Планирование'],
        ['11', 'Встреча с Анной'],
        ['12', ''],
        ['13', 'Отправить макеты'],
        ['14', ''],
        ['15', ''],
    ] as const

    return (
        <div className="welcome-app-preview" aria-label="Календарь Takt">
            <aside className="welcome-app-preview__nav">
                <span className="welcome-app-preview__mark">T</span>
                <CalendarDays size={18} strokeWidth={1.5} />
                <ListTodo size={18} strokeWidth={1.5} />
                <NotebookPen size={18} strokeWidth={1.5} />
            </aside>
            <div className="welcome-calendar-preview">
                <header>
                    <div>
                        <span>Ноябрь 2026</span>
                        <strong>Моя неделя</strong>
                    </div>
                    <button type="button">
                        <CalendarPlus size={16} strokeWidth={1.5} /> Новое
                        событие
                    </button>
                </header>
                <div className="welcome-calendar-grid">
                    {days.map(([date, event], index) => (
                        <div
                            className={index === 1 ? 'is-current' : ''}
                            key={date}
                        >
                            <span>
                                {
                                    ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'][
                                        index
                                    ]
                                }
                            </span>
                            <strong>{date}</strong>
                            {event && <small>{event}</small>}
                        </div>
                    ))}
                </div>
                <div className="welcome-calendar-deadline">
                    <Check size={16} strokeWidth={1.5} />
                    <div>
                        <strong>Отправить макеты</strong>
                        <span>Пятница, 18:00</span>
                    </div>
                    <span>Дедлайн</span>
                </div>
            </div>
        </div>
    )
}

function TelegramDemo() {
    return (
        <div className="welcome-chat" aria-label="Диалог с Telegram-ботом Takt">
            <header className="welcome-chat__header">
                <ChevronLeft size={20} strokeWidth={1.5} />
                <span className="welcome-chat__avatar">T</span>
                <div>
                    <strong>Takt bot</strong>
                    <small>онлайн</small>
                </div>
                <MoreHorizontal size={20} strokeWidth={1.5} />
            </header>
            <div className="welcome-chat__messages">
                <span className="welcome-chat__date">Сегодня</span>
                <div className="welcome-chat-message is-user">
                    Встреча с Анной завтра в 11
                    <span>
                        09:40 <CheckCheck size={12} strokeWidth={1.5} />
                    </span>
                </div>
                <div className="welcome-chat-message is-bot">
                    Добавил встречу с Анной — завтра, 11:00
                    <span>09:40</span>
                </div>
                <div className="welcome-chat-message is-user is-voice">
                    <i>
                        <Mic size={14} strokeWidth={1.5} />
                    </i>
                    <span className="welcome-chat-wave" aria-hidden="true">
                        {Array.from({ length: 28 }, (_, index) => (
                            <b key={index} />
                        ))}
                    </span>
                    <small>0:08</small>
                    <span className="welcome-chat-meta">
                        09:41 <CheckCheck size={12} strokeWidth={1.5} />
                    </span>
                </div>
                <div className="welcome-chat-message is-bot">
                    Дедлайн «Купить билеты» — в пятницу
                    <span>09:41</span>
                </div>
            </div>
            <footer className="welcome-chat__input">
                <Paperclip size={18} strokeWidth={1.5} />
                <span>Сообщение</span>
                <Mic size={18} strokeWidth={1.5} />
            </footer>
        </div>
    )
}

function EventDemo() {
    return (
        <div className="welcome-app-preview" aria-label="Событие в расписании">
            <aside className="welcome-app-preview__nav">
                <span className="welcome-app-preview__mark">T</span>
                <CalendarDays size={18} strokeWidth={1.5} />
                <ListTodo size={18} strokeWidth={1.5} />
                <NotebookPen size={18} strokeWidth={1.5} />
            </aside>
            <div className="welcome-first-event">
                <header>
                    <div>
                        <span>Среда, 11 ноября</span>
                        <strong>Расписание</strong>
                    </div>
                    <span className="welcome-first-event__status">
                        <Check size={15} strokeWidth={1.5} /> Событие добавлено
                    </span>
                </header>
                <div className="welcome-first-event__timeline">
                    <div className="welcome-first-event__row">
                        <time>08:00</time>
                        <span />
                    </div>
                    <div className="welcome-first-event__row is-event">
                        <time>09:00</time>
                        <article>
                            <strong>Утренний кофе</strong>
                            <span>Кофейня рядом с парком</span>
                        </article>
                    </div>
                    <div className="welcome-first-event__row">
                        <time>10:00</time>
                        <span />
                    </div>
                    <div className="welcome-first-event__row">
                        <time>11:00</time>
                        <span />
                    </div>
                </div>
            </div>
        </div>
    )
}

const slides = [
    {
        title: 'Планы, сроки и заметки — в Takt',
        description:
            'Управляй делами в браузере, а Takt соберёт главное на настольном экране',
        demo: <DeviceDemo />,
    },
    {
        title: 'День перед глазами',
        description:
            'События, дедлайны и заметки складываются в одно понятное расписание',
        demo: <CalendarDemo />,
    },
    {
        title: 'Пиши боту текстом или голосом',
        description:
            'Telegram-бот создаст событие, дедлайн или заметку без открытия сайта',
        demo: <TelegramDemo />,
    },
    {
        title: 'Первое событие',
        description:
            'Добавь ближайший план сейчас или перейди в Takt и сделай это позже',
        demo: <EventDemo />,
    },
] as const

export function WelcomePage() {
    const [slide, setSlide] = useState(0)
    const [isCompleting, setIsCompleting] = useState(false)
    const navigate = useNavigate()
    const toast = useToast()
    const { updateSettings } = useTakt()
    const currentSlide = slides[slide]
    const isLastSlide = slide === slides.length - 1

    const completeTutorial = async (destination: string) => {
        if (isCompleting) return
        setIsCompleting(true)
        try {
            await updateSettings({ tutorial: 1 })
            await navigate(destination, { replace: true })
        } catch (err: unknown) {
            toast.error(
                err instanceof Error
                    ? err.message
                    : 'Не удалось завершить обучение',
            )
            setIsCompleting(false)
        }
    }

    return (
        <main className="welcome-page-v3">
            <section className="welcome-shell-v3">
                <div className="welcome-panel-v3">
                    <header className="welcome-header-v3">
                        <div className="welcome-wordmark-v3">
                            <span>T</span>
                            <strong>Takt</strong>
                        </div>
                        <button
                            type="button"
                            disabled={isCompleting}
                            onClick={() => void completeTutorial('/')}
                        >
                            Пропустить
                        </button>
                    </header>

                    <article className="welcome-copy-v3" key={slide}>
                        <h1>{currentSlide.title}</h1>
                        <p>{currentSlide.description}</p>
                    </article>

                    <footer className="welcome-footer-v3">
                        {isLastSlide ? (
                            <div className="welcome-final-v3">
                                <button
                                    type="button"
                                    disabled={isCompleting}
                                    onClick={() =>
                                        void completeTutorial(
                                            '/calendar?create=event',
                                        )
                                    }
                                >
                                    <CalendarPlus size={18} strokeWidth={1.5} />{' '}
                                    Создать событие
                                </button>
                                <button
                                    type="button"
                                    disabled={isCompleting}
                                    onClick={() => void completeTutorial('/')}
                                >
                                    Сделаю позже
                                </button>
                            </div>
                        ) : (
                            <div
                                className={`welcome-slide-actions-v3${slide === 2 ? ' has-bot-action' : ''}`}
                            >
                                {slide === 2 && (
                                    <a
                                        className="welcome-telegram-action-v3"
                                        href={TELEGRAM_BOT_URL}
                                        target="_blank"
                                        rel="noreferrer"
                                    >
                                        <Send size={18} strokeWidth={1.5} />
                                        Открыть бота
                                    </a>
                                )}
                                <button
                                    className="welcome-continue-v3"
                                    type="button"
                                    onClick={() =>
                                        setSlide((current) => current + 1)
                                    }
                                >
                                    Продолжить{' '}
                                    <ArrowRight size={18} strokeWidth={1.5} />
                                </button>
                            </div>
                        )}
                        <div className="welcome-navigation-v3">
                            <button
                                type="button"
                                disabled={slide === 0}
                                onClick={() =>
                                    setSlide((current) => current - 1)
                                }
                                aria-label="Предыдущий слайд"
                            >
                                <ArrowLeft size={18} strokeWidth={1.5} />
                            </button>
                            <div
                                aria-label={`Слайд ${slide + 1} из ${slides.length}`}
                            >
                                {slides.map((item, index) => (
                                    <button
                                        className={
                                            index === slide ? 'is-active' : ''
                                        }
                                        type="button"
                                        key={item.title}
                                        onClick={() => setSlide(index)}
                                        aria-label={`Перейти к слайду ${index + 1}`}
                                        aria-current={
                                            index === slide ? 'step' : undefined
                                        }
                                    />
                                ))}
                            </div>
                        </div>
                    </footer>
                </div>
                <div className="welcome-visual-v3" key={`visual-${slide}`}>
                    <div className="welcome-visual-content-v3">
                        {currentSlide.demo}
                    </div>
                </div>
            </section>
        </main>
    )
}
