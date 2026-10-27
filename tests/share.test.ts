import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { runInNewContext } from "node:vm"
import { describe, expect, it } from "vitest"
import {
  handoffToFile,
  peekHandoff,
  setHandoff,
  subscribeHandoff,
  takeAllHandoff,
  takeHandoff,
} from "@/lib/handoff"
import { SHARED_CACHE } from "@/lib/sharedFiles"

const script = readFileSync(resolve(import.meta.dirname, "../public/share-target-sw.js"), "utf8")

/** Runs the service worker script against an in-memory Cache API. */
function loadWorker() {
  const stores = new Map<string, Map<string, Response>>()
  const caches = {
    delete: async (name: string) => stores.delete(name),
    open: async (name: string) => {
      const store = stores.get(name) ?? new Map<string, Response>()
      stores.set(name, store)
      return { put: async (url: string, response: Response) => void store.set(url, response) }
    },
  }
  let listener: ((event: unknown) => void) | undefined
  const self = { addEventListener: (type: string, fn: (event: unknown) => void) => type === "fetch" && (listener = fn) }
  runInNewContext(script, { self, caches, Response, URL })

  /** Sends a request through the worker; undefined means it left the request alone. */
  const handle = async (request: Request) => {
    let answer: Promise<Response> | undefined
    listener!({ request, respondWith: (response: Promise<Response>) => (answer = response) })
    return answer
  }
  return { stores, handle }
}

const share = (...files: File[]) => {
  const form = new FormData()
  for (const file of files) form.append("pdf", file)
  return new Request("https://paperwork.test/open", { method: "POST", body: form })
}
const pdf = (name: string, text = "%PDF-1.7") => new File([text], name, { type: "application/pdf" })

describe("share target", () => {
  it("parks shared PDFs and sends the page to /open?shared=1", async () => {
    const { stores, handle } = loadWorker()
    const response = await (await handle(share(pdf("Résumé ไทย.pdf", "one"), pdf("b.pdf", "two"))))!
    expect(response.status).toBe(303)
    expect(response.headers.get("location")).toBe("https://paperwork.test/open?shared=1")

    const parked = [...stores.get(SHARED_CACHE)!.values()]
    expect(parked).toHaveLength(2)
    expect(decodeURIComponent(parked[0].headers.get("x-file-name")!)).toBe("Résumé ไทย.pdf")
    expect(await parked[0].text()).toBe("one")
    expect(await parked[1].text()).toBe("two")
  })

  it("replaces files from an earlier share", async () => {
    const { stores, handle } = loadWorker()
    await handle(share(pdf("old-1.pdf"), pdf("old-2.pdf")))
    await handle(share(pdf("new.pdf")))
    expect(stores.get(SHARED_CACHE)!.size).toBe(1)
  })

  it("still redirects when the request can't be read", async () => {
    const { handle } = loadWorker()
    const broken = new Request("https://paperwork.test/open", {
      method: "POST",
      body: "not multipart",
      headers: { "content-type": "multipart/form-data; boundary=x" },
    })
    expect((await (await handle(broken))!).status).toBe(303)
  })

  it("leaves every other request alone", async () => {
    const { stores, handle } = loadWorker()
    expect(await handle(new Request("https://paperwork.test/open"))).toBeUndefined()
    expect(await handle(new Request("https://paperwork.test/api/feedback", { method: "POST", body: "x" }))).toBeUndefined()
    expect(stores.size).toBe(0)
  })
})

describe("handoff", () => {
  it("hands a file to the next tool once", () => {
    setHandoff({ name: "a.pdf", bytes: new Uint8Array([1]) })
    expect(takeHandoff()?.name).toBe("a.pdf")
    expect(takeHandoff()).toBeUndefined()
    expect(peekHandoff()).toEqual([])
  })

  it("gives single-file tools the first file and merge all of them", () => {
    const files = ["a.pdf", "b.pdf", "c.pdf"].map((name) => ({ name, bytes: new Uint8Array([1]) }))
    setHandoff(files)
    expect(takeHandoff()?.name).toBe("a.pdf")
    expect(peekHandoff()).toEqual([])
    setHandoff(files)
    expect(takeAllHandoff().map((file) => file.name)).toEqual(["a.pdf", "b.pdf", "c.pdf"])
  })

  it("lets the open page see files as they arrive, with a stable snapshot between changes", () => {
    let calls = 0
    const unsubscribe = subscribeHandoff(() => calls++)
    const before = peekHandoff()
    expect(peekHandoff()).toBe(before)
    setHandoff({ name: "a.pdf", bytes: new Uint8Array([1]) })
    expect(calls).toBe(1)
    expect(peekHandoff()).toBe(peekHandoff())
    takeAllHandoff()
    expect(calls).toBe(2)
    unsubscribe()
    setHandoff({ name: "b.pdf", bytes: new Uint8Array([1]) })
    expect(calls).toBe(2)
    takeAllHandoff()
  })

  it("turns a handed-over file back into a PDF file", async () => {
    const file = handoffToFile({ name: "a.pdf", bytes: new TextEncoder().encode("%PDF") })
    expect([file.name, file.type, await file.text()]).toEqual(["a.pdf", "application/pdf", "%PDF"])
  })
})
