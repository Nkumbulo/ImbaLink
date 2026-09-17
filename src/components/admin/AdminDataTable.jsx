
export function StatusBadge({value}){const v=String(value||"unknown").toLowerCase().replace(/\s+/g,"-");return <span className={`admin-status ${v}`}>{String(value||"Unknown").replace(/_/g," ")}</span>}
export default function AdminDataTable({title,subtitle,search,onSearch,filters,loading,total=0,page=0,onPageChange,children}) {
 const pageSize=50, pages=Math.max(1,Math.ceil(total/pageSize));
 return <section className="admin-panel admin-data-table">
  <div className="admin-data-head"><div><h2>{title}</h2><p>{subtitle}</p></div>
   <div className="admin-data-controls">{onSearch&&<input className="admin-search" value={search||""} onChange={e=>onSearch(e.target.value)} placeholder="Search…"/>}{filters}</div>
  </div>
  <div className="admin-table-wrap"><table className="admin-table"><tbody>{loading?<tr><td>Loading…</td></tr>:children}</tbody></table></div>
  <div className="admin-data-foot"><span>{total?`${page*pageSize+1}–${Math.min((page+1)*pageSize,total)} of ${total}`:"No records"}</span>
   <div className="admin-pager"><button disabled={page<=0} onClick={()=>onPageChange?.(page-1)}>Previous</button><button disabled={page>=pages-1} onClick={()=>onPageChange?.(page+1)}>Next</button></div>
  </div>
 </section>
}
