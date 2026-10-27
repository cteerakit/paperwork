import { readdirSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"
import en from "@/i18n/locales/en.json"
import es from "@/i18n/locales/es.json"
import ja from "@/i18n/locales/ja.json"
import th from "@/i18n/locales/th.json"
import vi from "@/i18n/locales/vi.json"
import zh from "@/i18n/locales/zh.json"
import { LANGUAGES } from "@/i18n/languages"

type Tree = { [key: string]: string | Tree }

/** Flattens nested keys and drops plural suffixes, since languages have different plural forms. */
function keys(tree: Tree, prefix = ""): string[] {
  return Object.entries(tree).flatMap(([k, v]) =>
    typeof v === "string" ? [`${prefix}${k}`.replace(/_(zero|one|two|few|many|other)$/, "")] : keys(v, `${prefix}${k}.`)
  )
}

function lookup(tree: Tree, key: string): unknown {
  const node = key.split(".").reduce<unknown>((t, k) => (t as Tree | undefined)?.[k], tree)
  if (node !== undefined) return node
  // Plural keys exist only with a suffix.
  const parent = key.split(".").slice(0, -1).reduce<unknown>((t, k) => (t as Tree | undefined)?.[k], tree) as Tree
  return parent?.[`${key.split(".").at(-1)}_other`]
}

/** All static t("…") keys used in the source. */
function usedKeys(): string[] {
  const files = readdirSync(resolve(import.meta.dirname, "../src"), { recursive: true, encoding: "utf8" })
    .filter((f) => /\.tsx?$/.test(f))
    .map((f) => readFileSync(resolve(import.meta.dirname, "../src", f), "utf8"))
  const found = new Set<string>()
  for (const source of files) {
    for (const m of source.matchAll(/\bt\(\s*"([\w.-]+)"/g)) found.add(m[1])
  }
  return [...found]
}

const translations = { th, ja, zh, vi, es }

/** Every key with its plural suffix kept, e.g. "common.pageCount_other". */
const raw = (tree: Tree, prefix = ""): string[] =>
  Object.entries(tree).flatMap(([k, v]) => (typeof v === "string" ? [`${prefix}${k}`] : raw(v, `${prefix}${k}.`)))

/** The {{placeholders}} and {n}-style tokens in a string, which a translation must keep. */
const tokens = (text: string) => [...text.matchAll(/\{\{\s*\w+\s*\}\}|\{\w+\}/g)].map((m) => m[0].replace(/\s/g, "")).sort()

const valueAt = (tree: Tree, key: string) => key.split(".").reduce<unknown>((t, k) => (t as Tree | undefined)?.[k], tree)

describe("translations", () => {
  it("offers exactly the languages that have strings", () => {
    expect(LANGUAGES.map((l) => l.code).sort()).toEqual(["en", ...Object.keys(translations)].sort())
  })

  describe.each(Object.entries(translations))("%s", (_code, locale) => {
    it("has the same keys as English", () => {
      expect(new Set(keys(locale as Tree))).toEqual(new Set(keys(en as Tree)))
    })

    it("has an _other form for every plural", () => {
      const own = new Set(raw(locale as Tree))
      for (const key of raw(en as Tree).filter((k) => k.endsWith("_one"))) {
        expect(own.has(key.replace(/_one$/, "_other")), key).toBe(true)
      }
    })

    it("keeps the placeholders of every string", () => {
      for (const key of raw(en as Tree).filter((k) => !/_(zero|one|two|few|many)$/.test(k))) {
        const translated = valueAt(locale as Tree, key)
        expect(typeof translated, key).toBe("string")
        expect(tokens(translated as string), key).toEqual(tokens(valueAt(en as Tree, key) as string))
      }
    })

    it("has no empty strings", () => {
      for (const key of raw(locale as Tree)) expect((valueAt(locale as Tree, key) as string).trim(), key).not.toBe("")
    })
  })

  it("Spanish keeps singular and plural forms like English", () => {
    const own = new Set(raw(es as Tree))
    for (const key of raw(en as Tree).filter((k) => k.endsWith("_one"))) expect(own.has(key), key).toBe(true)
  })

  it("languages without a singular form don't carry one", () => {
    for (const locale of [th, ja, zh, vi]) {
      expect(raw(locale as Tree).filter((k) => k.endsWith("_one"))).toEqual([])
    }
  })

  it("every key used in the code exists", () => {
    const missing = usedKeys().filter((k) => typeof lookup(en as Tree, k) !== "string")
    expect(missing).toEqual([])
  })
})
