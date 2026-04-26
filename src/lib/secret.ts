import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export class AppEncryptionKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AppEncryptionKeyError";
  }
}

function getKey() {
  const raw = process.env.APP_ENCRYPTION_KEY;
  if (!raw) throw new AppEncryptionKeyError("Missing env: APP_ENCRYPTION_KEY");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32)
    throw new AppEncryptionKeyError("APP_ENCRYPTION_KEY must be base64 of 32 bytes");
  return key;
}

export function encryptSecret(plain: string) {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`;
}

export function decryptSecret(value: string) {
  const parts = value.split(":");
  if (parts.length !== 4 || parts[0] !== "v1") throw new Error("Invalid secret format");
  const [, ivB64, tagB64, dataB64] = parts;
  const key = getKey();
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const data = Buffer.from(dataB64, "base64");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(data), decipher.final()]);
  return dec.toString("utf8");
}
