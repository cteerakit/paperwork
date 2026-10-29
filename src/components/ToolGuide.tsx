import { useTranslation } from "react-i18next"
import { Link } from "react-router"
import { TOOLS, type ToolInfo } from "@/tools/registry"

const related = {
  merge: ["split", "organize", "compress"],
  split: ["merge", "organize", "redact"],
  compress: ["merge", "split", "organize"],
  toImages: ["split", "compress", "organize"],
  fromImages: ["merge", "compress", "organize"],
  sign: ["annotate", "watermark", "security"],
  annotate: ["sign", "redact", "watermark"],
  organize: ["merge", "split", "pageNumbers"],
  security: ["redact", "sign", "watermark"],
  redact: ["security", "annotate", "split"],
  watermark: ["sign", "annotate", "pageNumbers"],
  pageNumbers: ["organize", "merge", "watermark"],
} satisfies Record<ToolInfo["id"], ToolInfo["id"][]>

export function ToolGuide({ tool }: { tool: ToolInfo["id"] }) {
  const { t } = useTranslation()
  return (
    <section className="mx-auto mt-12 max-w-3xl space-y-6 border-t pt-8 text-sm leading-7">
      <div>
        <h2 className="text-lg font-semibold">{t("seo.howTo")}</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-muted-foreground">
          {["step1", "step2", "step3"].map((step) => (
            <li key={step}>{t(`seo.tools.${tool}.${step}`)}</li>
          ))}
        </ol>
      </div>
      <div>
        <h2 className="text-lg font-semibold">{t("seo.limitations")}</h2>
        <p className="mt-2 text-muted-foreground">
          {t(`seo.tools.${tool}.limitation`)}
        </p>
      </div>
      <div>
        <h2 className="text-lg font-semibold">{t("seo.privacyTitle")}</h2>
        <p className="mt-2 text-muted-foreground">{t("seo.privacy")}</p>
      </div>
      <nav aria-label={t("seo.related")}>
        <h2 className="text-lg font-semibold">{t("seo.related")}</h2>
        <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
          {TOOLS.filter(({ id }) =>
            related[tool].some((other) => other === id)
          ).map(({ id, path }) => (
            <li key={id}>
              <Link
                to={path}
                className="underline underline-offset-4 hover:text-muted-foreground"
              >
                {t(`tools.${id}.title`)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </section>
  )
}
