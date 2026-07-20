const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATA_IMAGE_PATTERN = /^data:image\/(?:png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/;
const MAX_AI_IMAGE_BYTES = 12 * 1024 * 1024;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export function requireUuid(value: unknown, fieldName = "id") {
  if (!isUuid(value)) throw new SecurityValidationError(`Invalid ${fieldName}`);
  return value;
}

export function supabaseEqFilter(value: string) {
  return `eq.${encodeURIComponent(value)}`;
}

export function sanitizeText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null;
  const stripped = value
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
  return stripped || null;
}

export function sanitizeHttpUrl(value: unknown, maxLength = 500) {
  const text = sanitizeText(value, maxLength);
  if (!text) return null;

  try {
    const url = new URL(text);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function validateDataImage(value: unknown) {
  if (typeof value !== "string") throw new SecurityValidationError("An image is required.");
  if (!DATA_IMAGE_PATTERN.test(value)) throw new SecurityValidationError("Upload a PNG, JPEG, WebP, or GIF image.");

  const [, base64Payload = ""] = value.split(",", 2);
  const estimatedBytes = Math.ceil((base64Payload.length * 3) / 4);
  if (estimatedBytes > MAX_AI_IMAGE_BYTES) throw new SecurityValidationError("Please choose an image under 12 MB.");

  return value;
}

export class SecurityValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SecurityValidationError";
  }
}
