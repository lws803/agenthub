import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";

let _db: ReturnType<typeof drizzle>;

function getDb() {
  if (!_db) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error("DATABASE_URL is not set");
    }
    _db = drizzle(neon(url));
  }
  return _db;
}

export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(_, prop) {
    return Reflect.get(getDb(), prop) as unknown;
  },
});
