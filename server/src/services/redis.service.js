const { client } = require("../config/redis");

// --- Basic cache operations -------------------------------------------------
//
// Every function here checks `client.isReady` and wraps the actual Redis
// call in try/catch. That's deliberate: Redis in this project is only ever
// an optimization layer in front of MongoDB (see config/redis.js), never a
// required source of truth, so a Redis outage must degrade to "act like the
// cache was empty" rather than fail the request. Callers (driver.service.js,
// matching.service.js) always have a MongoDB fallback for exactly that case.

async function get(key) {
  if (!client.isReady) return null;
  try {
    return await client.get(key);
  } catch (err) {
    console.warn(`Redis GET failed for key "${key}":`, err.message);
    return null;
  }
}

// ttlSeconds is optional. When omitted the key has no expiry — only use that
// for data that has its own explicit lifecycle (nothing in this project
// does yet). Cached copies of MongoDB data should always carry a TTL, so a
// forgotten invalidation call self-heals instead of serving stale data
// forever: once the TTL elapses, Redis silently drops the key and the next
// read is a cache miss, which falls through to MongoDB and re-populates it.
async function set(key, value, ttlSeconds) {
  if (!client.isReady) return false;
  try {
    if (ttlSeconds) {
      await client.set(key, value, { EX: ttlSeconds });
    } else {
      await client.set(key, value);
    }
    return true;
  } catch (err) {
    console.warn(`Redis SET failed for key "${key}":`, err.message);
    return false;
  }
}

async function del(key) {
  if (!client.isReady) return false;
  try {
    await client.del(key);
    return true;
  } catch (err) {
    console.warn(`Redis DEL failed for key "${key}":`, err.message);
    return false;
  }
}

// --- Redis GEO ---------------------------------------------------------------
//
// A Redis GEO key is actually a sorted set: each member (here, a driver's
// user id) is stored with a score derived from encoding its longitude/
// latitude as a single geohash number. GEOADD/GEOSEARCH use that encoding to
// answer "which members are within N meters of this point" without a
// database round trip, which is why it's a good match for driver location —
// data that changes every few seconds and is queried on every ride request.
//
// Individual sorted-set members can't carry their own TTL (only the whole
// key can expire), so freshness here isn't TTL-based — membership is instead
// kept in sync explicitly: driver.service.js adds a driver to the geo set
// when they go "available" and removes them when they go "busy"/"offline",
// so the set only ever contains drivers who are actually matchable right now.

async function geoAdd(key, driverId, longitude, latitude) {
  if (!client.isReady) return false;
  try {
    await client.geoAdd(key, { member: driverId, longitude, latitude });
    return true;
  } catch (err) {
    console.warn(`Redis GEOADD failed for key "${key}":`, err.message);
    return false;
  }
}

async function geoRemove(key, driverId) {
  if (!client.isReady) return false;
  try {
    await client.zRem(key, driverId);
    return true;
  } catch (err) {
    console.warn(`Redis GEO remove failed for key "${key}":`, err.message);
    return false;
  }
}

// Returns the nearest member's id (a driver's user id), or null if Redis is
// unavailable or nothing is within range.
//
// GEOSEARCH itself was only added in Redis 6.2 — the portable Windows build
// this project uses (see README "Local Redis setup") is 5.0.14.1, the
// newest available from its source, so this always fails on that platform
// specifically (not a transient error, and not fixable by retrying). Rather
// than warn on every single ride request forever, that specific, permanent
// case is logged once and then silenced; any other failure (a real outage,
// a malformed key) still warns normally every time, since those *are*
// actionable. Either way the MongoDB $near fallback in matching.service.js
// already covers this — driver matching is fully correct regardless.
let hasWarnedGeosearchUnsupported = false;

async function geoSearchNearest(key, longitude, latitude, radiusMeters) {
  if (!client.isReady) return null;
  try {
    const results = await client.geoSearch(
      key,
      { longitude, latitude },
      { radius: radiusMeters, unit: "m" },
      { SORT: "ASC", COUNT: 1 }
    );
    return results[0] || null;
  } catch (err) {
    if (/unknown command .GEOSEARCH/i.test(err.message)) {
      if (!hasWarnedGeosearchUnsupported) {
        console.warn(
          "Redis GEOSEARCH is not supported by this Redis build (needs 6.2+) — falling back to MongoDB for all driver matching. This message won't repeat."
        );
        hasWarnedGeosearchUnsupported = true;
      }
      return null;
    }
    console.warn(`Redis GEOSEARCH failed for key "${key}":`, err.message);
    return null;
  }
}

module.exports = { get, set, del, geoAdd, geoRemove, geoSearchNearest };
