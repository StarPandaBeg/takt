/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_AUTH_TOKEN?: string
    readonly VITE_BACKEND_URL?: string
    readonly VITE_COMMIT_SHA?: string
    readonly VITE_COMMIT_DATE?: string
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}

interface TaktDeveloperConsole {
    setTutorial(value: 0 | 1 | boolean): Promise<0 | 1>
}

interface Window {
    takt: TaktDeveloperConsole
}
