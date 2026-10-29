// Apply the saved theme before first paint to avoid a flash of the wrong theme. Kept as a file, not
// inline, so the Content-Security-Policy (public/_headers) can forbid inline scripts.
;(function () {
  try {
    var t = localStorage.getItem("theme")
    var dark = t === "dark" || ((!t || t === "system") && matchMedia("(prefers-color-scheme: dark)").matches)
    document.documentElement.classList.add(dark ? "dark" : "light")
    var lang = localStorage.getItem("paperwork.lang")
    if (lang) document.documentElement.lang = lang
  } catch (e) {
    // Storage blocked: the app picks a theme once it loads.
  }
})()
