import Redis from "ioredis";
import { env } from "@/lib/env";

let redis: Redis | null = null;
const memoryCache = new Map<string, { value: string; expiresAt: number }>();

export function getRedis(): Redis | null {
  if (!env.REDIS_URL) return null;
  if (!redis) {
    redis = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
  }
  return redis;
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const client = getRedis();
  if (client) {
    try {
      const raw = await client.get(key);
      if (raw) return JSON.parse(raw) as T;
    } catch {
      /* fallback to memory */
    }
  }
  const entry = memoryCache.get(key);
  if (!entry || entry.expiresAt < Date.now()) {
    memoryCache.delete(key);
    return null;
  }
  return JSON.parse(entry.value) as T;
}

export async function cacheSet(
  key: string,
  value: unknown,
  ttlSeconds = 60
): Promise<void> {
  const serialized = JSON.stringify(value);
  const client = getRedis();
  if (client) {
    try {
      await client.setex(key, ttlSeconds, serialized);
      return;
    } catch {
      /* fallback */
    }
  }
  memoryCache.set(key, {
    value: serialized,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}

export async function cacheDel(key: string): Promise<void> {
  const client = getRedis();
  if (client) {
    try {
      await client.del(key);
    } catch {
      /* ignore */
    }
  }
  memoryCache.delete(key);
}
