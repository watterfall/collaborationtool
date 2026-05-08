// Custom Drizzle type for Postgres `bytea`. Postgres natively round-trips
// Buffer; we convert to/from Uint8Array at the boundary so application code
// never sees Node-specific Buffer.

import { customType } from 'drizzle-orm/pg-core';

export const bytea = customType<{ data: Uint8Array; driverData: Buffer }>({
  dataType() {
    return 'bytea';
  },
  toDriver(value) {
    return Buffer.from(value);
  },
  fromDriver(value) {
    // postgres.js returns Uint8Array for bytea by default; normalise either way.
    return value instanceof Uint8Array ? value : new Uint8Array(value);
  },
});
