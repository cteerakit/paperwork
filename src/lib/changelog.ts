export type ChangeType = "new" | "improved"

export interface ChangelogEntry {
  /** Translation key under "changelog.entries.<id>". */
  id: string
  /** ISO date (UTC) the release shipped. */
  date: string
  /** Item keys under "changelog.entries.<id>.items". */
  items: { key: string; type: ChangeType }[]
}

/** Newest first. Add new releases at the top, with copy in every locale. */
export const CHANGELOG: ChangelogEntry[] = [
  {
    id: "offline",
    date: "2026-10-28",
    items: [
      { key: "install", type: "new" },
      { key: "pricing", type: "new" },
      { key: "previews", type: "improved" },
      { key: "prerender", type: "improved" },
    ],
  },
  {
    id: "protect",
    date: "2026-10-27",
    items: [
      { key: "redact", type: "new" },
      { key: "security", type: "new" },
      { key: "feedback", type: "new" },
      { key: "about", type: "new" },
      { key: "preload", type: "improved" },
    ],
  },
  {
    id: "launch",
    date: "2026-10-27",
    items: [
      { key: "tools", type: "new" },
      { key: "thai", type: "new" },
      { key: "private", type: "new" },
    ],
  },
]
