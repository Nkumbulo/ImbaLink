/** Canonical listing-report operations. */
export function createReportService({ supabase, activeUserKey }) {
  async function reportListing(propertyId, reason, note) {
    const key = String(propertyId || '').trim();
    if (!key) throw new Error('Property not found.');
    const { data, error } = await supabase.rpc('report_listing', { p_property_id: key, p_reason: reason, p_note: note || null });
    if (error) {
      console.error('Report listing failed:', { propertyId: key, reason, code: error.code, message: error.message });
      if (error.code === 'PGRST202' || /schema cache|find the function/i.test(error.message || '')) {
        throw new Error('The report-listing database function is not installed on this Supabase project yet. Run backend/017-listing-reports.sql in the Supabase SQL Editor, then try again.');
      }
      throw new Error(error.message || 'Could not submit the report.');
    }
    return data;
  }

  async function getMyReportForListing(propertyId) {
    const userId = activeUserKey();
    const key = String(propertyId || '').trim();
    if (!userId || !key) return null;
    const { data, error } = await supabase.from('reports').select('id, status').eq('reporter_user_id', userId).eq('subject_type', 'property').eq('subject_id', key).in('status', ['open', 'reviewing']).maybeSingle();
    if (error || !data) return null;
    return data;
  }

  return { reportListing, getMyReportForListing };
}
//: listing reports moved behind the Core data boundary.
