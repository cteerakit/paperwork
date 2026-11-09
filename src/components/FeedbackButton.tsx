import { MessageSquare } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"

declare global {
  interface Window {
    // Shipped's feedback widget, loaded by index.html with data-launcher="none".
    ShippedFeedback?: { open: () => void }
  }
}

export function FeedbackButton() {
  const { t } = useTranslation()
  return (
    <Button
      variant="ghost"
      size="sm"
      aria-label={t("feedback.title")}
      onClick={() => window.ShippedFeedback?.open()}
    >
      <MessageSquare />
      <span className="hidden sm:inline">{t("feedback.title")}</span>
    </Button>
  )
}
