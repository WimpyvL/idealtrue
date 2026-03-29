import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
const SCRYPT_KEY_LENGTH = 64;
const SCRYPT_COST = 16384;
const SCRYPT_BLOCK_SIZE = 8;
const SCRYPT_PARALLELIZATION = 1;

function encodeHash(salt: Buffer, derivedKey: Buffer) {
  return [
    "scrypt",
    SCRYPT_COST,
    SCRYPT_BLOCK_SIZE,
    SCRYPT_PARALLELIZATION,
    salt.toString("base64url"),
    derivedKey.toString("base64url"),
  ].join(":");
}

function decodeHash(value: string) {
  const [algorithm, cost, blockSize, parallelization, salt, hash] = value.split(":");
  if (!algorithm || !cost || !blockSize || !parallelization || !salt || !hash) {
    throw new Error("Password hash is malformed.");
  }
  if (algorithm !== "scrypt") {
    throw new Error("Unsupported password hash algorithm.");
  }
  return {
    cost: Number(cost),
    blockSize: Number(blockSize),
    parallelization: Number(parallelization),
    salt: Buffer.from(salt, "base64url"),
    hash: Buffer.from(hash, "base64url"),
  };
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const derivedKey = scryptSync(password, salt, SCRYPT_KEY_LENGTH, {
    N: SCRYPT_COST,
    r: SCRYPT_BLOCK_SIZE,
    p: SCRYPT_PARALLELIZATION,
  }) as Buffer;
  return encodeHash(salt, derivedKey);
}

export async function verifyPassword(password: string, storedHash: string) {
  const decoded = decodeHash(storedHash);
  const candidate = scryptSync(password, decoded.salt, decoded.hash.length, {
    N: decoded.cost,
    r: decoded.blockSize,
    p: decoded.parallelization,
  }) as Buffer;

  return candidate.length === decoded.hash.length && timingSafeEqual(candidate, decoded.hash);
}
