export class RedactionError extends Error {
  constructor() {
    super(
      "This text selection crosses an image, form field, or comment that cannot be redacted as PDF text."
    )
    this.name = "RedactionError"
  }
}
