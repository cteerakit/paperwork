import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"

interface NoteDialogProps {
  text?: string
  onSave: (text: string) => void
  onClose: () => void
}

/** Edits a sticky note's comment text. */
export function NoteDialog({ text, onSave, onClose }: NoteDialogProps) {
  const { t } = useTranslation()
  return (
    <Dialog open={text !== undefined} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        {text !== undefined && <NoteForm initial={text} onSave={onSave} onCancel={onClose} t={t} />}
      </DialogContent>
    </Dialog>
  )
}

function NoteForm({
  initial,
  onSave,
  onCancel,
  t,
}: {
  initial: string
  onSave: (text: string) => void
  onCancel: () => void
  t: ReturnType<typeof useTranslation>["t"]
}) {
  const [value, setValue] = useState(initial)
  return (
    <>
      <DialogHeader>
        <DialogTitle>{t("editor.noteTitle")}</DialogTitle>
        <DialogDescription>{t("editor.noteDescription")}</DialogDescription>
      </DialogHeader>
      <Textarea
        autoFocus
        rows={5}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) onSave(value)
        }}
        placeholder={t("editor.notePlaceholder")}
      />
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>
          {t("common.cancel")}
        </Button>
        <Button onClick={() => onSave(value)}>{t("common.save")}</Button>
      </DialogFooter>
    </>
  )
}
