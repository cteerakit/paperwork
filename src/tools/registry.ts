import {
  LockKeyhole,
  Combine,
  ScanLine,
  Highlighter,
  LayoutGrid,
  ListOrdered,
  Minimize2,
  Scissors,
  Signature,
  Stamp,
  type LucideIcon,
} from "lucide-react"

export interface ToolInfo {
  /** Translation key under "tools.<id>". */
  id:
    | "security"
    | "redact"
    | "organize"
    | "merge"
    | "split"
    | "compress"
    | "pageNumbers"
    | "watermark"
    | "sign"
    | "annotate"
  path: string
  icon: LucideIcon
  /** Tailwind classes for the icon tile. */
  accent: string
}

export const TOOLS: ToolInfo[] = [
  {
    id: "merge",
    path: "/merge",
    icon: Combine,
    accent: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  },
  {
    id: "split",
    path: "/split",
    icon: Scissors,
    accent: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
  },
  {
    id: "compress",
    path: "/compress",
    icon: Minimize2,
    accent: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  },
  {
    id: "sign",
    path: "/sign",
    icon: Signature,
    accent: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400",
  },
  {
    id: "annotate",
    path: "/annotate",
    icon: Highlighter,
    accent: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  },
  {
    id: "organize",
    path: "/organize",
    icon: LayoutGrid,
    accent: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
  },
  {
    id: "security",
    path: "/unlock-protect",
    icon: LockKeyhole,
    accent: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
  },
  {
    id: "redact",
    path: "/redact",
    icon: ScanLine,
    accent: "bg-zinc-500/15 text-zinc-700 dark:text-zinc-300",
  },
  {
    id: "watermark",
    path: "/watermark",
    icon: Stamp,
    accent: "bg-red-500/15 text-red-600 dark:text-red-400",
  },
  {
    id: "pageNumbers",
    path: "/page-numbers",
    icon: ListOrdered,
    accent: "bg-teal-500/15 text-teal-600 dark:text-teal-400",
  },
]
