import { isObject, toId, numOr, intOr } from '../shared/helpers';

// PostCard shows "posted N days ago" and there is no such column — it is a
// function of created_at, computed here so the whole app agrees on it.
export function daysSince(timestamp) {
  const t = timestamp ? new Date(timestamp).getTime() : NaN;
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, Math.floor((Date.now() - t) / 86_400_000));
}

export function applyFilters(data, { city, suburb, type, minPrice, maxPrice, verifiedOnly, query } = {}) {
  const q = typeof query === 'string' ? query.trim().toLowerCase() : '';
  return data.filter((p) => {
    if (!isObject(p)) return false;
    if (city && city !== 'All' && p.city !== city) return false;
    if (suburb && suburb !== 'All' && p.suburb !== suburb) return false;
    if (type && type !== 'All' && p.type !== type) return false;
    if (maxPrice != null && Number.isFinite(Number(maxPrice)) && Number(p.rent) > Number(maxPrice)) return false;
    if (minPrice != null && Number.isFinite(Number(minPrice)) && Number(p.rent) < Number(minPrice)) return false;
    if (verifiedOnly && p.verification !== 'verified') return false;
    if (q) {
      const haystack = `${p.title || ''} ${p.suburb || ''} ${p.type || ''} ${p.landlord || ''}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

export function normalizeProperty(p) {
  if (!isObject(p)) return null;
  const id = p.id ?? p._id;
  if (id == null) return null;
  return {
    ...p,
    id: toId(id),
    title: String(p.title || 'Untitled listing'),
    suburb: String(p.suburb || 'Unknown'),
    city: String(p.city || 'Harare'),
    type: String(p.type || 'Property'),
    rent: numOr(p.rent, 0),
    rooms: numOr(p.rooms, 0),
    desc: String(p.desc || ''),
    rules: Array.isArray(p.rules) ? p.rules.filter(Boolean).slice(0, 20) : [],
    grad: Array.isArray(p.grad) && p.grad.length >= 2 ? [String(p.grad[0]), String(p.grad[1])] : ['#6E63B8', '#3E3670'],
    verification: ['verified', 'pending', 'flagged'].includes(p.verification) ? p.verification : 'pending',
  };
}

export function rowToProperty(row, images = [], ownerProfile = null) {
  if (!isObject(row)) return null;
  return normalizeProperty({
    id: row.id,
    title: row.title,
    type: row.property_type,
    suburb: row.suburb,
    street: row.street_address || '',
    city: row.city,
    rooms: row.rooms,
    bathrooms: row.bathrooms,
    bathroom: row.bathroom_type || 'Private',
    rent: row.rent_usd,
    deposit: row.deposit_usd,
    fee: row.fee_percent ?? 0,
    distanceKm: row.distance_km ?? 0,
    furnished: Boolean(row.furnished),
    availability: row.availability || '',
    leaseTerm: row.lease_term || '',
    electricity: row.electricity || '',
    water: row.water || '',
    security: row.security || '',
    parking: Boolean(row.parking),
    amenities: Array.isArray(row.amenities) ? row.amenities : [],
    rules: Array.isArray(row.rules) ? row.rules : [],
    grad: Array.isArray(row.gradient) ? row.gradient : null,
    landlord: row.landlord_name || '',
    landlordVerified: Boolean(row.landlord_verified),
    ownershipType: row.ownership_type || '',
    ownershipReference: row.ownership_ref || '',
    ownerUserId: row.owner_user_id || null,
    landlordAvatarUrl: ownerProfile?.avatar_url || ownerProfile?.avatarUrl || row.avatar_url || '',
    desc: row.description || '',
    verification: row.verification,
    isSeed: Boolean(row.is_seed),
    images,
    postedDaysAgo: daysSince(row.published_at || row.created_at),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    saveCount: Number(row.save_count) || 0,
    viewCount: Number(row.view_count) || 0,
    isPaused: Boolean(row.is_paused),
  });
}

export function propertyToRow(input, { id, ownerUserId }) {
  return {
    id,
    owner_user_id: ownerUserId,
    title: String(input.title || 'Untitled listing'),
    description: String(input.desc || input.description || ''),
    property_type: String(input.type || 'Property'),
    suburb: String(input.suburb || ''),
    city: String(input.city || 'Harare'),
    street_address: input.street || input.streetAddress || null,
    rent_usd: numOr(input.rent, 0),
    deposit_usd: numOr(input.deposit, 0),
    rooms: intOr(input.rooms, 0),
    bathrooms: intOr(input.bathrooms, 0),
    bathroom_type: input.bathroom || 'Private',
    furnished: Boolean(input.furnished),
    availability: input.availability || null,
    lease_term: input.leaseTerm || null,
    electricity: input.electricity || null,
    water: input.water || null,
    security: input.security || null,
    // BOOLEAN in the schema. The old code wrote the strings 'Yes'/'No'.
    parking: Boolean(input.parking) && input.parking !== 'No',
    amenities: Array.isArray(input.amenities) ? input.amenities : [],
    rules: Array.isArray(input.rules) ? input.rules : [],
    gradient: Array.isArray(input.grad) ? input.grad : [],
    landlord_name: input.landlord || null,
    // No avatar_url here: landlord avatars are owned by the users/profile
    // record and are resolved separately when listings are read.
    landlord_verified: Boolean(input.landlordVerified),
    ownership_type: input.ownershipType || null,
    ownership_ref: input.ownershipReference || null,
    verification: input.landlordVerified ? 'verified' : (input.verification || 'pending'),
    fee_percent: input.fee != null ? numOr(input.fee, null) : null,
    distance_km: input.distanceKm != null ? numOr(input.distanceKm, null) : null,
    published_at: new Date().toISOString(),
  };
}
