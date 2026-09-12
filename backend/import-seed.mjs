#!/usr/bin/env node
/**
 * Seed importer — loads the bundled catalogs into Postgres.
 *
 *   node backend/import-seed.mjs --dry-run
 *   DATABASE_URL=postgres://… node backend/import-seed.mjs
 *
 * The 161 properties, the contractors and the universities in src/data/ are
 * currently seeded into every browser's IndexedDB. Once a server exists they
 * belong in one place instead, and this is the one-time move.
 *
 * Idempotent: every write is an upsert keyed on the record's own id, so
 * running it twice changes nothing. That matters because the realistic
 * usage is running it repeatedly against a staging database while the API
 * is being built.
 *
 * Ids are preserved exactly as they are in the JSON — seed properties keep
 * their integer-derived keys ("40"), stringified. Re-keying them would
 * orphan every like, save and message already stored against those ids in
 * people's browsers, which the outbox would then try to sync.
 *
 * Requires `pg` (npm i pg). --dry-run needs nothing and touches no database.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(here, "..", "src", "data");
const dryRun = process.argv.includes("--dry-run");

function readJson(name) {
  const raw = JSON.parse(fs.readFileSync(path.join(dataDir, name), "utf8"));
  // The bundled files are sometimes a bare array and sometimes an object
  // wrapping one — the same shape-tolerance src/services/idb.js applies.
  if (Array.isArray(raw)) return raw;
  for (const key of ["properties", "contractors", "universities", "data"]) {
    if (Array.isArray(raw?.[key])) return raw[key];
  }
  return [];
}

const asText = (value, fallback = "") => (value == null ? fallback : String(value));
const asNumber = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
const asArray = (value) => (Array.isArray(value) ? value.filter((v) => typeof v === "string") : []);

// Seed rows use "verified" | "pending" | "flagged"; the enum in schema.sql
// accepts all three plus "rejected".
const asVerification = (value) =>
  ["verified", "pending", "flagged", "rejected"].includes(value) ? value : "pending";

function mapProperty(row) {
  return {
    id: asText(row.id),
    title: asText(row.title, "Untitled listing"),
    description: asText(row.desc || row.description),
    property_type: asText(row.type, "Property"),
    suburb: asText(row.suburb),
    city: asText(row.city, "Harare"),
    street_address: row.streetAddress ? asText(row.streetAddress) : null,
    rent_usd: asNumber(row.rent),
    deposit_usd: asNumber(row.deposit),
    rooms: asNumber(row.rooms),
    bathrooms: asNumber(row.bathrooms),
    bathroom_type: row.bathroom ? asText(row.bathroom) : null,
    furnished: Boolean(row.furnished),
    availability: row.availability ? asText(row.availability) : null,
    lease_term: row.leaseTerm ? asText(row.leaseTerm) : null,
    electricity: row.electricity ? asText(row.electricity) : null,
    water: row.water ? asText(row.water) : null,
    security: row.security ? asText(row.security) : null,
    parking: Boolean(row.parking),
    amenities: asArray(row.amenities),
    rules: asArray(row.rules),
    gradient: asArray(row.grad),
    landlord_name: row.landlord ? asText(row.landlord) : null,
    verification: asVerification(row.verification),
    images: asArray(row.images),
  };
}

function mapContractor(row) {
  return {
    id: asText(row.id),
    business_name: asText(row.businessName || row.name, "Unnamed"),
    primary_trade: row.trade || row.primaryTrade ? asText(row.trade || row.primaryTrade) : null,
    services: asArray(row.services),
    service_areas: asArray(row.serviceAreas || row.areas),
    phone: row.phone ? asText(row.phone) : null,
    email: row.email ? asText(row.email) : null,
    description: row.description ? asText(row.description) : null,
    emergency: Boolean(row.emergency ?? row.emergencyService),
    free_quotes: Boolean(row.freeQuotes ?? row.quotes),
    verification: asVerification(row.verification || row.verificationStatus),
  };
}

function mapUniversity(row) {
  return {
    id: asText(row.id),
    name: asText(row.name),
    city: row.city ? asText(row.city) : null,
    active: row.active !== false,
  };
}

const properties = readJson("properties.json").map(mapProperty).filter((r) => r.id);
const contractors = readJson("contractors.json").map(mapContractor).filter((r) => r.id);
const universities = readJson("universities.json").map(mapUniversity).filter((r) => r.id);
const imageCount = properties.reduce((total, p) => total + p.images.length, 0);

console.log(`properties:   ${properties.length} (${imageCount} images)`);
console.log(`contractors:  ${contractors.length}`);
console.log(`universities: ${universities.length}`);

// Duplicate ids in the source would silently collapse on upsert; say so.
for (const [label, rows] of [["properties", properties], ["contractors", contractors], ["universities", universities]]) {
  const seen = new Set();
  const dupes = rows.map((r) => r.id).filter((id) => (seen.has(id) ? true : (seen.add(id), false)));
  if (dupes.length) console.warn(`WARNING: duplicate ${label} ids: ${[...new Set(dupes)].join(", ")}`);
}

if (dryRun) {
  console.log("\n--dry-run: nothing written. Sample property row:");
  console.log(JSON.stringify(properties[0], null, 2));
  process.exit(0);
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. Use --dry-run to validate without a database.");
  process.exit(1);
}

const { default: pg } = await import("pg");
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

try {
  await client.query("BEGIN");

  for (const row of universities) {
    await client.query(
      `INSERT INTO universities (id, name, city, active) VALUES ($1,$2,$3,$4)
       ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, city=EXCLUDED.city, active=EXCLUDED.active`,
      [row.id, row.name, row.city, row.active]
    );
  }

  for (const row of properties) {
    await client.query(
      `INSERT INTO properties (
         id, title, description, property_type, suburb, city, street_address,
         rent_usd, deposit_usd, rooms, bathrooms, bathroom_type, furnished,
         availability, lease_term, electricity, water, security, parking,
         amenities, rules, gradient, landlord_name, verification, is_seed, published_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,true,now())
       ON CONFLICT (id) DO UPDATE SET
         title=EXCLUDED.title, description=EXCLUDED.description,
         property_type=EXCLUDED.property_type, suburb=EXCLUDED.suburb, city=EXCLUDED.city,
         rent_usd=EXCLUDED.rent_usd, deposit_usd=EXCLUDED.deposit_usd,
         rooms=EXCLUDED.rooms, bathrooms=EXCLUDED.bathrooms,
         amenities=EXCLUDED.amenities, rules=EXCLUDED.rules, gradient=EXCLUDED.gradient,
         landlord_name=EXCLUDED.landlord_name, verification=EXCLUDED.verification`,
      [
        row.id, row.title, row.description, row.property_type, row.suburb, row.city,
        row.street_address, row.rent_usd, row.deposit_usd, row.rooms, row.bathrooms,
        row.bathroom_type, row.furnished, row.availability, row.lease_term, row.electricity,
        row.water, row.security, row.parking, row.amenities, row.rules, row.gradient,
        row.landlord_name, row.verification,
      ]
    );

    // Deterministic image ids (`${propertyId}_img_${position}`) keep the
    // upsert idempotent — a re-run updates the same rows instead of
    // appending a second copy of every photo.
    for (const [position, url] of row.images.entries()) {
      await client.query(
        `INSERT INTO property_images (id, property_id, url, position)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (id) DO UPDATE SET url=EXCLUDED.url, position=EXCLUDED.position`,
        [`${row.id}_img_${position}`, row.id, url, position]
      );
    }
  }

  for (const row of contractors) {
    await client.query(
      `INSERT INTO contractors (
         id, business_name, primary_trade, services, service_areas, phone, email,
         description, emergency, free_quotes, verification, is_seed
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,true)
       ON CONFLICT (id) DO UPDATE SET
         business_name=EXCLUDED.business_name, primary_trade=EXCLUDED.primary_trade,
         services=EXCLUDED.services, service_areas=EXCLUDED.service_areas,
         phone=EXCLUDED.phone, email=EXCLUDED.email, description=EXCLUDED.description,
         emergency=EXCLUDED.emergency, free_quotes=EXCLUDED.free_quotes,
         verification=EXCLUDED.verification`,
      [
        row.id, row.business_name, row.primary_trade, row.services, row.service_areas,
        row.phone, row.email, row.description, row.emergency, row.free_quotes, row.verification,
      ]
    );
  }

  await client.query("COMMIT");
  console.log("\nSeed import complete.");
} catch (error) {
  await client.query("ROLLBACK");
  console.error("Import failed, rolled back:", error.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
