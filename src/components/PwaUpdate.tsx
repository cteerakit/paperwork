import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { useRegisterSW } from "virtual:pwa-register/react"
import { Button } from "@/components/ui/button"

export function PwaUpdate() {
  const { t } = useTranslation()
  const [registration, setRegistration] = useState<ServiceWorkerRegistration>()
  const [updating, setUpdating] = useState(false)
  const [failed, setFailed] = useState(false)
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registered) {
      setRegistration(registered)
    },
  })

  useEffect(() => {
    if (!registration) return
    const check = () => {
      if (document.visibilityState === "visible" && navigator.onLine) {
        void registration.update().catch(() => {
          // A failed network check leaves the working offline app available.
        })
      }
    }
    check()
    const interval = window.setInterval(check, 60 * 60 * 1000)
    document.addEventListener("visibilitychange", check)
    window.addEventListener("online", check)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener("visibilitychange", check)
      window.removeEventListener("online", check)
    }
  }, [registration])

  async function update() {
    setUpdating(true)
    setFailed(false)
    try {
      await updateServiceWorker(true)
    } catch {
      setFailed(true)
      setUpdating(false)
    }
  }

  if (!needRefresh) return null

  return (
    <aside
      role="status"
      className="fixed right-4 bottom-4 left-4 z-50 rounded-xl border bg-background p-4 shadow-lg sm:left-auto sm:max-w-sm"
    >
      <p className="font-semibold">{t("pwa.title")}</p>
      <p className="mt-1 text-sm text-muted-foreground">
        {t("pwa.description")}
      </p>
      {failed && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {t("pwa.error")}
        </p>
      )}
      <div className="mt-3 flex gap-2">
        <Button disabled={updating} onClick={() => void update()}>
          {t("pwa.update")}
        </Button>
        <Button
          variant="outline"
          disabled={updating}
          onClick={() => setNeedRefresh(false)}
        >
          {t("pwa.later")}
        </Button>
      </div>
    </aside>
  )
}
