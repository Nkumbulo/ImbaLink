import { supabase } from '../../../../services/supabase';
import { activeUserKey } from '../shared/identity';

/** Record an explicit recommendation signal from the Link button. */
export async function recordPropertyRecommendation(property) {
  const userId = activeUserKey();
  const propertyId = String(property?.id || '').trim();
  if (!userId || !propertyId || !property) return;

  const snapshot = {
    id: propertyId,
    title: property.title || '',
    city: property.city || '',
    suburb: property.suburb || '',
    type: property.type || property.propertyType || '',
    rent: Number(property.rent) || 0,
    rooms: Number(property.rooms) || 0,
    bathrooms: Number(property.bathrooms ?? property.bathroomCount) || 0,
    furnished: Boolean(property.furnished),
    parking: Boolean(property.parking),
    amenities: Array.isArray(property.amenities) ? property.amenities.slice(0, 30) : [],
    availability: property.availability || '',
    leaseTerm: property.leaseTerm || '',
    security: property.security || '',
    water: property.water || '',
    electricity: property.electricity || '',
  };

  const { error } = await supabase.rpc('record_property_recommendation', {
    p_property_id: propertyId,
    p_snapshot: snapshot,
  });
  if (error) console.warn('Property recommendation signal failed:', error.message);
  else if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('imbalink-recommendation-updated'));
}

/** Read the compact preference profile used to rank the home feed. */
export async function getPropertyRecommendationProfile() {
  const userId = activeUserKey();
  if (!userId) return null;
  const { data, error } = await supabase.rpc('get_property_recommendation_profile');
  if (error) {
    console.warn('Property recommendation profile failed:', error.message);
    return null;
  }
  return data || null;
}
