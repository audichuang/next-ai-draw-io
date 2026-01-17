"use client"

import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { HistoryPage } from "@/components/chat/HistoryPage"
import { useDictionary } from "@/hooks/use-dictionary"
import { i18n, type Locale } from "@/lib/i18n/config"

export default function Home() {
    const router = useRouter()
    const pathname = usePathname()
    const dict = useDictionary()
    const currentLang = (pathname.split("/")[1] || i18n.defaultLocale) as Locale

    const [isLoaded, setIsLoaded] = useState(false)

    // Load preferences from localStorage after mount
    useEffect(() => {
        // Restore saved locale and redirect if needed
        const savedLocale = localStorage.getItem("next-ai-draw-io-locale")
        if (savedLocale && i18n.locales.includes(savedLocale as Locale)) {
            const pathParts = pathname.split("/").filter(Boolean)
            const currentLocale = pathParts[0]
            if (currentLocale !== savedLocale) {
                pathParts[0] = savedLocale
                router.replace(`/${pathParts.join("/")}`)
                return
            }
        }

        const savedDarkMode = localStorage.getItem("next-ai-draw-io-dark-mode")
        if (savedDarkMode !== null) {
            const isDark = savedDarkMode === "true"
            document.documentElement.classList.toggle("dark", isDark)
        } else {
            const prefersDark = window.matchMedia(
                "(prefers-color-scheme: dark)",
            ).matches
            document.documentElement.classList.toggle("dark", prefersDark)
        }

        setIsLoaded(true)
    }, [pathname, router])

    if (!isLoaded) {
        return (
            <div className="h-screen flex items-center justify-center bg-background">
                <div className="animate-pulse text-muted-foreground">
                    Loading...
                </div>
            </div>
        )
    }

    return <HistoryPage lang={currentLang} dict={dict} />
}
