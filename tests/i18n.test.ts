import { readdirSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"
import en from "@/i18n/locales/en.json"
import th from "@/i18n/locales/th.json"

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

describe("translations", () => {
  it("English and Thai have the same keys", () => {
    expect(new Set(keys(th as Tree))).toEqual(new Set(keys(en as Tree)))
  })

  it("every plural has an _other form in Thai", () => {
    const raw = (tree: Tree, prefix = ""): string[] =>
      Object.entries(tree).flatMap(([k, v]) => (typeof v === "string" ? [`${prefix}${k}`] : raw(v, `${prefix}${k}.`)))
    const thai = new Set(raw(th as Tree))
    for (const key of raw(en as Tree).filter((k) => k.endsWith("_one"))) {
      expect(thai.has(key.replace(/_one$/, "_other")), key).toBe(true)
    }
  })

  it("every key used in the code exists", () => {
    const missing = usedKeys().filter((k) => typeof lookup(en as Tree, k) !== "string")
    expect(missing).toEqual([])
  })
})
