import { RefreshCw, Tv } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { api } from '../../api/client'

interface DevicePreviewCardProps {
    isServerConnected: boolean
    screenRevision: number
    onRefresh: () => void
}

export function DevicePreviewCard({
    isServerConnected,
    screenRevision,
    onRefresh,
}: DevicePreviewCardProps) {
    const [isRefreshing, setIsRefreshing] = useState(false)
    const [imageUrl, setImageUrl] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [loadError, setLoadError] = useState<string | null>(null)

    // Загрузка изображения экрана с авторизацией через Blob
    const loadImage = useCallback(async () => {
        if (!isServerConnected) {
            setImageUrl(null)
            return
        }

        try {
            const blob = await api.screens.getPngBlob('main')
            const url = URL.createObjectURL(blob)

            setImageUrl((prev) => {
                if (prev) {
                    URL.revokeObjectURL(prev)
                }
                return url
            })
            setLoadError(null)
        } catch (err: unknown) {
            setLoadError(
                err instanceof Error
                    ? err.message
                    : 'Не удалось загрузить экран устройства',
            )
        } finally {
            setIsLoading(false)
        }
    }, [isServerConnected])

    useEffect(() => {
        let isCancelled = false

        if (!isServerConnected) {
            return
        }

        api.screens
            .getPngBlob('main')
            .then((blob) => {
                if (isCancelled) return
                const url = URL.createObjectURL(blob)
                setImageUrl((prev) => {
                    if (prev) {
                        URL.revokeObjectURL(prev)
                    }
                    return url
                })
                setLoadError(null)
                setIsLoading(false)
            })
            .catch((err: unknown) => {
                if (isCancelled) return
                setLoadError(
                    err instanceof Error
                        ? err.message
                        : 'Не удалось загрузить экран устройства',
                )
                setIsLoading(false)
            })

        return () => {
            isCancelled = true
        }
    }, [screenRevision, isServerConnected])

    // Очистка Object URL при размонтировании компонента
    useEffect(() => {
        return () => {
            if (imageUrl) {
                URL.revokeObjectURL(imageUrl)
            }
        }
    }, [imageUrl])

    const handleRefresh = () => {
        setIsRefreshing(true)
        onRefresh()
        void loadImage().finally(() => {
            setTimeout(() => setIsRefreshing(false), 400)
        })
    }

    return (
        <article className="dashboard-card device-widget">
            <div className="dashboard-card__header">
                <div className="dashboard-card__header-left">
                    <h2 className="dashboard-card__title">Экран устройства</h2>
                    <div className="device-preview__status">
                        <span
                            className={`status-dot ${isServerConnected ? 'is-online' : 'is-offline'}`}
                        />
                        <span className="dashboard-card__subtitle">
                            {isServerConnected ? 'В сети' : 'Не в сети'}
                        </span>
                    </div>
                </div>
                <div className="dashboard-card__actions">
                    <button
                        className="icon-button"
                        type="button"
                        onClick={handleRefresh}
                        aria-label="Обновить экран"
                        title="Обновить экран"
                        disabled={isRefreshing || !isServerConnected}
                    >
                        <RefreshCw
                            size={16}
                            className={
                                isRefreshing || (isLoading && !imageUrl)
                                    ? 'spin-animation'
                                    : ''
                            }
                        />
                    </button>
                </div>
            </div>

            <div className="device-preview">
                {/* Корпус настольного устройства Takt */}
                <div className="device-frame">
                    <div className="device-frame__screen-bezel">
                        {!isServerConnected ? (
                            <div className="device-frame__offline-state">
                                <Tv size={24} />
                                <span>Нет связи с устройством</span>
                            </div>
                        ) : loadError ? (
                            <div className="device-frame__offline-state">
                                <Tv size={24} />
                                <span>{loadError}</span>
                            </div>
                        ) : imageUrl ? (
                            <img
                                src={imageUrl}
                                alt="Экран устройства Takt"
                                className="device-frame__eink-display"
                                width={800}
                                height={480}
                                style={{
                                    imageRendering: 'auto',
                                    width: '100%',
                                    height: 'auto',
                                    objectFit: 'contain',
                                    transform: 'none',
                                }}
                            />
                        ) : (
                            <div className="device-frame__offline-state">
                                <RefreshCw
                                    size={20}
                                    className="spin-animation"
                                />
                                <span>Загрузка экрана...</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </article>
    )
}
