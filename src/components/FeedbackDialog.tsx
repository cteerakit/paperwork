import { useState, type SubmitEvent } from "react"
import { MessageSquare } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"

type Status = "idle" | "sending" | "sent" | "error" | "limited"

export function FeedbackDialog() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState("")
  const [status, setStatus] = useState<Status>("idle")

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!message.trim() || status === "sending") return
    setStatus("sending")
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message.trim() }),
        signal: AbortSignal.timeout(15000),
      })
      setStatus(
        response.ok ? "sent" : response.status === 429 ? "limited" : "error"
      )
      if (response.ok) setMessage("")
    } catch {
      setStatus("error")
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value)
        if (value && status === "sent") setStatus("idle")
      }}
    >
      <DialogTrigger
        render={
          <Button variant="ghost" size="sm" aria-label={t("feedback.title")} />
        }
      >
        <MessageSquare />
        <span className="hidden sm:inline">{t("feedback.title")}</span>
      </DialogTrigger>
      <DialogContent showCloseButton={status !== "sending"}>
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{t("feedback.title")}</DialogTitle>
            <DialogDescription>{t("feedback.description")}</DialogDescription>
          </DialogHeader>
          {status === "sent" ? (
            <p role="status">{t("feedback.sent")}</p>
          ) : (
            <>
              <div className="grid gap-2">
                <Label htmlFor="feedback-message">{t("feedback.label")}</Label>
                <Textarea
                  id="feedback-message"
                  required
                  rows={5}
                  maxLength={1500}
                  value={message}
                  disabled={status === "sending"}
                  onChange={(event) => setMessage(event.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  {t("feedback.privacy")}
                </p>
              </div>
              {(status === "error" || status === "limited") && (
                <p role="alert" className="text-destructive">
                  {t(`feedback.${status}`)}
                </p>
              )}
            </>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={status === "sending"}
              onClick={() => setOpen(false)}
            >
              {t(status === "sent" ? "feedback.close" : "common.cancel")}
            </Button>
            {status !== "sent" && (
              <Button
                type="submit"
                disabled={!message.trim() || status === "sending"}
              >
                {t(status === "sending" ? "feedback.sending" : "feedback.send")}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
