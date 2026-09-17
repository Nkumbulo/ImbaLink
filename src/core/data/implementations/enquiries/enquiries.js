/** Canonical landlord enquiry aggregation. */
export function createEnquiryService({ supabase, requireUser }) {
  async function getLandlordEnquiryCounts(ownerId = null) {
    const owner = String(ownerId || requireUser());
    const { data: propertyRows } = await supabase.from('properties').select('id').eq('owner_user_id', owner);
    const propertyIds = (propertyRows || []).map((p) => String(p.id));
    if (!propertyIds.length) return new Map();
    const { data, error } = await supabase.from('conversations').select('id, property_id').in('property_id', propertyIds);
    if (error || !data) return new Map();
    const counts = new Map();
    for (const row of data) {
      const key = String(row.property_id);
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return counts;
  }
  return { getLandlordEnquiryCounts };
}
//: landlord enquiry aggregation moved behind the Core data boundary.
