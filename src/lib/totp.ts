import { generateSecret as otplibSecret, generateSync, generateURI, verifySync } from "otplib";

/** Thin wrapper over otplib v13 with the classic authenticator API shape. */
export function totpSecret(): string {
  return otplibSecret();
}

export function totpKeyuri(email: string, issuer: string, secret: string): string {
  return generateURI({ issuer, label: email, secret });
}

export function totpVerify(token: string, secret: string): boolean {
  try {
    const result = verifySync({ token: token.replace(/\s/g, ""), secret });
    return Boolean(result?.valid);
  } catch {
    return false;
  }
}
