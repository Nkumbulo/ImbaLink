import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createLandlordListing as createLandlordListingApi,
  deleteLandlordListing as deleteLandlordListingApi,
  getProperties,
  subscribeToPropertyFeed,
  updateLandlordListing as updateLandlordListingApi,
} from '../../../core/data/domains/properties.js';
import { localCache } from '../../../core/cache';

const MOBILE_FEED_TIMEOUT_MS = 6500;
const withTimeout = (promise, ms, fallback) => Promise.race([
  promise,
  new Promise((resolve) => window.setTimeout(() => resolve(fallback), ms)),
]);

const normalizeFilters = (filters = {}) => ({
  suburb: filters.suburb || 'All',
  type: filters.type || 'All',
  minPrice: Number.isFinite(Number(filters.minPrice)) ? Number(filters.minPrice) : null,
  // The Home price control uses 1000 as its "$1,000+" ceiling sentinel.
  // Treating that sentinel as a hard maximum hides legitimate properties
  // above $1,000 before the UI has a chance to render them.
  maxPrice: Number.isFinite(Number(filters.maxPrice)) && Number(filters.maxPrice) < 1000
    ? Number(filters.maxPrice)
    : null,
  verifiedOnly: Boolean(filters.verifiedOnly),
});

const makeCacheKey = ({ city, filters, query, limit, page = 1 }) => JSON.stringify([
  page,
  limit,
  { city: city || 'All', ...normalizeFilters(filters), query: typeof query === 'string' ? query.trim().toLowerCase() : '' },
]);

const propertyMatches = (property, { city, filters, query }) => {
  if (!property) return false;
  const f = normalizeFilters(filters);
  if (city && city !== 'All' && property.city !== city) return false;
  if (f.suburb !== 'All' && property.suburb !== f.suburb) return false;
  if (f.type !== 'All' && property.type !== f.type) return false;
  if (f.maxPrice != null && Number(property.rent) > f.maxPrice) return false;
  if (f.minPrice != null && Number(property.rent) < f.minPrice) return false;
  if (f.verifiedOnly && property.verification !== 'verified') return false;
  const q = typeof query === 'string' ? query.trim().toLowerCase() : '';
  if (q && !`${property.title || ''} ${property.suburb || ''} ${property.type || ''} ${property.landlord || ''}`.toLowerCase().includes(q)) return false;
  return true;
};

export function usePropertyFeed({ city = 'All', filters = {}, query = '', limit = 24, hydrated = false, landlordListings = [], setLandlordListings }) {
  const [loaded, setLoaded] = useState(false);
  const [properties, setProperties] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const requestId = useRef(0);
  const loadingMoreRef = useRef(false);

  const loadFirst = useCallback(async () => {
    const id = ++requestId.current;
    setPage(1);
    setHasMore(true);
    setLoaded(true);
    const cacheKey = makeCacheKey({ city, filters, query, limit });
    let cached = null;

    try {
      cached = await localCache.getPropertyPage(cacheKey);
      if (id !== requestId.current) return;
      if (cached?.hasCache && cached.value) {
        setProperties(Array.isArray(cached.value.data) ? cached.value.data : []);
        setHasMore(Boolean(cached.value.hasMore));
      }
    } catch { /* best-effort cache read; live fetch below is authoritative */ }

    if (cached?.hasCache && !cached.stale) return;
    try {
      const res = await withTimeout(getProperties({ page: 1, limit, city, ...filters, query }), MOBILE_FEED_TIMEOUT_MS, null);
      if (id !== requestId.current || !res) return;
      const value = {
        data: Array.isArray(res.data) ? res.data : [],
        total: Number(res.total) || 0,
        page: 1,
        limit,
        hasMore: Boolean(res.hasMore),
      };
      setProperties(value.data);
      setHasMore(value.hasMore);
      void localCache.setPropertyPage(cacheKey, value);
    } catch {
      if (id === requestId.current && !cached?.hasCache) {
        setProperties([]);
        setHasMore(false);
      }
    } finally {
      if (id === requestId.current) setLoaded(true);
    }
  }, [city, filters.suburb, filters.type, filters.minPrice, filters.maxPrice, filters.verifiedOnly, query, limit]);

  useEffect(() => {
    if (!loaded) return;
    void localCache.setPropertyPage(makeCacheKey({ city, filters, query, limit }), {
      data: properties,
      total: properties.length,
      page: 1,
      limit,
      hasMore,
    });
  }, [loaded, properties, hasMore, city, filters.suburb, filters.type, filters.minPrice, filters.maxPrice, filters.verifiedOnly, query, limit]);

  useEffect(() => {
    if (!loaded) return undefined;
    return subscribeToPropertyFeed(({ eventType, propertyId, property, imageUrl, images, saveCount }) => {
      setProperties((current) => {
        if (eventType === 'DELETE') return current.filter((item) => String(item.id) !== String(propertyId));
        if (eventType === 'SAVE_COUNT') return current.map((item) => String(item.id) === String(propertyId) ? { ...item, saveCount: Number(saveCount) || 0 } : item);
        if (eventType === 'IMAGE_UPSERT' || eventType === 'IMAGE_DELETE') {
          const nextImages = Array.isArray(images)
            ? images
            : (imageUrl ? [imageUrl, ...(current.find((item) => String(item.id) === String(propertyId))?.images || []).filter((url) => url !== imageUrl)] : []);
          return current.map((item) => String(item.id) === String(propertyId) ? { ...item, images: nextImages.slice(0, 8) } : item);
        }
        if (!property) return current;
        if (!propertyMatches(property, { city, filters, query })) return current.filter((item) => String(item.id) !== String(propertyId));
        return [property, ...current.filter((item) => String(item.id) !== String(propertyId))];
      });
      if (eventType === 'SAVE_COUNT') {
        setLandlordListings((current) => current.map((item) => String(item.id) === String(propertyId) ? { ...item, saveCount: Number(saveCount) || 0 } : item));
      }
    });
  }, [loaded, city, filters.suburb, filters.type, filters.minPrice, filters.maxPrice, filters.verifiedOnly, query, setLandlordListings]);

  useEffect(() => { void loadFirst(); }, [loadFirst]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMoreRef.current || loadingMore || !loaded) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    const nextPage = page + 1;
    try {
      const request = requestId.current;
      const res = await getProperties({ page: nextPage, limit, city, ...filters, query });
      if (request !== requestId.current) return;
      setProperties((prev) => {
        const seen = new Set(prev.map((p) => String(p.id)));
        return [...prev, ...(Array.isArray(res.data) ? res.data : []).filter((p) => !seen.has(String(p.id)))];
      });
      setPage(nextPage);
      setHasMore(Boolean(res.hasMore));
    } catch {
      setHasMore(false);
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [page, hasMore, loadingMore, loaded, city, filters.suburb, filters.type, filters.minPrice, filters.maxPrice, filters.verifiedOnly, query, limit]);

  const createLandlordListing = useCallback(async (input, options) => {
    const record = await createLandlordListingApi(input, options);
    setLandlordListings((current) => [record, ...current.filter((item) => String(item.id) !== String(record.id))].slice(0, 500));
    return record;
  }, [setLandlordListings]);

  const setPropertySaveCount = useCallback((propertyId, saveCount) => {
    const id = String(propertyId);
    const count = Math.max(0, Number(saveCount) || 0);
    setProperties((current) => current.map((item) => String(item.id) === id ? { ...item, saveCount: count } : item));
    setLandlordListings((current) => current.map((item) => String(item.id) === id ? { ...item, saveCount: count } : item));
  }, [setLandlordListings]);

  const deleteLandlordListing = useCallback(async (propertyId) => {
    const id = await deleteLandlordListingApi(propertyId);
    setLandlordListings((current) => current.filter((item) => String(item.id) !== String(id)));
    setProperties((current) => current.filter((item) => String(item.id) !== String(id)));
    return id;
  }, [setLandlordListings]);

  const updateLandlordListing = useCallback(async (propertyId, input, options) => {
    const record = await updateLandlordListingApi(propertyId, input, options);
    setLandlordListings((current) => current.map((item) => String(item.id) === String(record.id) ? record : item));
    setProperties((current) => current.map((item) => String(item.id) === String(record.id) ? record : item));
    return record;
  }, [setLandlordListings]);

  const allProperties = useMemo(() => [
    ...landlordListings,
    ...properties.filter((p) => !landlordListings.some((x) => String(x.id) === String(p.id))),
  ], [landlordListings, properties]);

  return { loaded, properties: allProperties, hasMore, loadingMore, loadMore, createLandlordListing, deleteLandlordListing, updateLandlordListing, setPropertySaveCount };
}
