import { useEffect, useState, useCallback } from "react";
import { T } from "../../styles/tokens";
import { getAdminUsers, adminFormat } from "../../services/admin/adminAnalytics";
import { EmptyState, LoadingState, SearchInput, Pagination, StatusPill } from "./shared";

const PAGE_SIZE = 20;

export default function UsersSection() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ rows: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    getAdminUsers({ search, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE })
      .then((res) => setData(res || { rows: [], total: 0 }))
      .catch((err) => setError(err?.message || "Could not load users."))
      .finally(() => setLoading(false));
  }, [search, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [search]);

  return (
    <div>
      <div className="mb-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Search by name or email…" />
      </div>

      {loading && <LoadingState />}
      {!loading && error && <div className="f-body" style={{ color: T.brick, fontSize: 12.5 }}>{error}</div>}
      {!loading && !error && data.rows.length === 0 && <EmptyState label="No users match." />}

      {!loading && !error && data.rows.length > 0 && (
        <div className="space-y-1.5">
          {data.rows.map((u) => (
            <div key={u.id} className="rounded-xl p-3 flex items-center justify-between gap-2" style={{ background: T.paperDim }}>
              <div className="min-w-0">
                <div className="f-body font-semibold truncate" style={{ color: T.ink, fontSize: 12.5 }}>
                  {u.display_name || u.email || "Unnamed"}
                </div>
                <div className="f-body truncate" style={{ color: T.ink60, fontSize: 10.5 }}>
                  {u.email} · {u.account_type} · {u.listing_count || 0} listings
                </div>
              </div>
              {u.verification_status && <StatusPill status={u.verification_status} />}
            </div>
          ))}
        </div>
      )}

      {!loading && !error && data.total > PAGE_SIZE && (
        <Pagination page={page} hasMore={page * PAGE_SIZE < data.total} onPrev={() => setPage((p) => Math.max(1, p - 1))} onNext={() => setPage((p) => p + 1)} />
      )}
    </div>
  );
}
