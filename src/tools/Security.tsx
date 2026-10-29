import { useEffect, useState } from "react"
import { Eraser, LockKeyhole, Unlock, X } from "lucide-react"
import { useTranslation } from "react-i18next"
import { FileDropzone } from "@/components/FileDropzone"
import { ResultActions } from "@/components/ResultActions"
import { Spinner } from "@/components/Spinner"
import { ToolLayout } from "@/components/ToolLayout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { outputName } from "@/lib/download"
import { handoffToFile, takeHandoff } from "@/lib/handoff"
import { SecurityError } from "@/lib/pdf/security"
import {
  detectPdfProtection,
  exportCleanPdf,
  exportSecurePdf,
} from "@/lib/pdf/securityClient"

const MODES = ["unlock", "protect", "clean"] as const
type Mode = (typeof MODES)[number]
/** Shorter passwords are accepted, but are much easier to guess. */
const RECOMMENDED_PASSWORD_LENGTH = 8

export default function Security() {
  const { t } = useTranslation()
  const [mode, setMode] = useState<Mode>("unlock")
  const [file, setFile] = useState<File>()
  // Start from a file passed on from another tool ("Continue in…").
  useEffect(() => {
    const handoff = takeHandoff()
    if (handoff) queueMicrotask(() => setFile(handoffToFile(handoff)))
  }, [])
  const [protection, setProtection] = useState<
    "checking" | "protected" | "unprotected" | "invalid"
  >("checking")
  useEffect(() => {
    if (!file) return
    let active = true
    void (async () => {
      try {
        const detected = await detectPdfProtection(
          new Uint8Array(await file.arrayBuffer())
        )
        if (active) setProtection(detected)
      } catch {
        if (active) setProtection("invalid")
      }
    })()
    return () => {
      active = false
    }
  }, [file])
  const [currentPassword, setCurrentPassword] = useState("")
  const [password, setPassword] = useState("")
  const [confirmation, setConfirmation] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [result, setResult] = useState<Uint8Array>()
  const clear = () => {
    setCurrentPassword("")
    setPassword("")
    setConfirmation("")
    setError("")
    setResult(undefined)
  }
  const process = async () => {
    if (!file || busy || protection === "checking" || protection === "invalid")
      return
    setBusy(true)
    setError("")
    setResult(undefined)
    try {
      const bytes = new Uint8Array(await file.arrayBuffer())
      const output =
        mode === "clean"
          ? await exportCleanPdf(bytes, currentPassword)
          : await exportSecurePdf(
              bytes,
              mode === "unlock"
                ? { kind: "unlock", currentPassword }
                : { kind: "protect", currentPassword, password }
            )
      setResult(output)
      setCurrentPassword("")
      setPassword("")
      setConfirmation("")
    } catch (cause) {
      setError(
        t(
          `tools.security.errors.${cause instanceof SecurityError ? cause.code : "failed"}`
        )
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <ToolLayout tool="security">
      <div className="mx-auto grid max-w-2xl gap-5">
        <RadioGroup
          value={mode}
          disabled={busy}
          onValueChange={(value) => {
            if (MODES.includes(value as Mode)) {
              setMode(value as Mode)
              clear()
            }
          }}
          className="grid gap-3 sm:grid-cols-3"
        >
          {MODES.map((value) => (
            <Label
              key={value}
              className="flex cursor-pointer items-center gap-2 rounded-xl border bg-card p-4"
            >
              <RadioGroupItem value={value} />
              {t(`tools.security.${value}`)}
            </Label>
          ))}
        </RadioGroup>
        {!file ? (
          <FileDropzone
            onFiles={([selected]) => {
              clear()
              setProtection("checking")
              setFile(selected)
            }}
          />
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 rounded-xl border bg-card p-4">
              <span className="truncate text-sm font-medium">{file.name}</span>
              <Button
                variant="ghost"
                size="icon"
                disabled={busy}
                aria-label={t("common.closeFile")}
                onClick={() => {
                  setFile(undefined)
                  clear()
                }}
              >
                <X />
              </Button>
            </div>
            <form
              className="grid gap-4 rounded-xl border bg-card p-5"
              onSubmit={(event) => {
                event.preventDefault()
                void process()
              }}
            >
              <p className="text-sm text-muted-foreground">
                {t(`tools.security.${mode}Hint`)}
              </p>
              {protection === "checking" && (
                <p
                  role="status"
                  className="flex items-center gap-2 text-sm text-muted-foreground"
                >
                  <Spinner className="size-4" />
                  {t("common.loading")}
                </p>
              )}
              {protection === "invalid" && (
                <p role="alert" className="text-sm text-destructive">
                  {t("tools.security.errors.invalid")}
                </p>
              )}
              {!result &&
                protection !== "checking" &&
                protection !== "invalid" && (
                  <fieldset disabled={busy} className="grid gap-4">
                    {(mode !== "protect" || protection === "protected") && (
                      <div className="grid gap-2">
                        <Label htmlFor="current-password">
                          {t("tools.security.currentPassword")}
                        </Label>
                        <Input
                          id="current-password"
                          type="password"
                          autoComplete="off"
                          value={currentPassword}
                          onChange={(event) => {
                            setCurrentPassword(event.target.value)
                            setError("")
                          }}
                        />
                        <p className="text-xs text-muted-foreground">
                          {t("tools.security.currentHint")}
                        </p>
                      </div>
                    )}
                    {mode === "protect" && (
                      <>
                        <div className="grid gap-2">
                          <Label htmlFor="new-password">
                            {t("tools.security.newPassword")}
                          </Label>
                          <Input
                            id="new-password"
                            type="password"
                            autoComplete="new-password"
                            required
                            value={password}
                            onChange={(event) =>
                              setPassword(event.target.value)
                            }
                          />
                          {password &&
                            [...password].length <
                              RECOMMENDED_PASSWORD_LENGTH && (
                              <p className="text-sm text-muted-foreground">
                                {t("tools.security.weakPassword", {
                                  count: RECOMMENDED_PASSWORD_LENGTH,
                                })}
                              </p>
                            )}
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="confirm-password">
                            {t("tools.security.confirmPassword")}
                          </Label>
                          <Input
                            id="confirm-password"
                            type="password"
                            autoComplete="new-password"
                            required
                            value={confirmation}
                            onChange={(event) =>
                              setConfirmation(event.target.value)
                            }
                          />
                          {confirmation && confirmation !== password && (
                            <p className="text-sm text-destructive">
                              {t("tools.security.mismatch")}
                            </p>
                          )}
                        </div>
                      </>
                    )}
                  </fieldset>
                )}
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
              {result ? (
                <>
                  <p role="status" className="text-sm">
                    {t(`tools.security.${mode}Success`)}
                  </p>
                  <ResultActions
                    result={{
                      bytes: result,
                      name: outputName(
                        file.name,
                        mode === "unlock"
                          ? "unlocked"
                          : mode === "protect"
                            ? "protected"
                            : "cleaned"
                      ),
                    }}
                    tool="security"
                  />
                </>
              ) : (
                <Button
                  type="submit"
                  disabled={
                    busy ||
                    protection === "checking" ||
                    protection === "invalid" ||
                    (mode === "protect" &&
                      (!password || password !== confirmation))
                  }
                >
                  {busy ? (
                    <Spinner className="size-4 text-current" />
                  ) : mode === "unlock" ? (
                    <Unlock />
                  ) : mode === "protect" ? (
                    <LockKeyhole />
                  ) : (
                    <Eraser />
                  )}
                  {t(`tools.security.${mode}`)}
                </Button>
              )}
            </form>
          </>
        )}
      </div>
    </ToolLayout>
  )
}
