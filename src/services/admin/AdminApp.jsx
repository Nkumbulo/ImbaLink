import {useEffect,useState} from "react";
import useAdminAuthorization from "../../hooks/useAdminAuthorization";
import AdminShell from "../../components/admin/AdminShell";
import AdminDashboardPage from "./AdminDashboardPage";
import AdminUsersPage from "./AdminUsersPage";
import AdminPropertiesPage from "./AdminPropertiesPage";
import AdminReportsPage from "./AdminReportsPage";
import AdminOperationsPage from "./AdminOperationsPage";
import AdminVerificationsPage from "./AdminVerificationsPage";
import AdminGenericPage from "./AdminGenericPage";
import AdminMonetizationPage from "../../components/admin/AdminMonetizationPage";
import AdminAppControlPage from "./AdminAppControlPage";
import AdminAuditPage from "./AdminAuditPage";

const valid=["dashboard","users","properties","moderation","students","contractors","reports","verifications","operations","analytics","transactions","app-control","audit-logs"];
function pathPage(){const part=typeof window!=="undefined"?window.location.pathname.split("/")[2]:"dashboard";return valid.includes(part)?part:"dashboard"}
export default function AdminApp(){const auth=useAdminAuthorization();const[page,setPage]=useState(pathPage);useEffect(()=>{const onPop=()=>setPage(pathPage());window.addEventListener("popstate",onPop);return()=>window.removeEventListener("popstate",onPop)},[]);const navigate=(next)=>{setPage(next);window.history.pushState({},"",`/admin${next==="dashboard"?"":`/${next}`}`)};if(auth.loading)return <div className="admin-loading-full"><div className="admin-login-mark">IL</div><p>Checking staff permissions…</p></div>;if(!auth.user||!auth.isStaff)return <div className="admin-denied"><div><div className="admin-login-mark">IL</div><h1>Access restricted</h1><p>This account is not authorized to access ImbaLink Administration.</p><a href="/admin/login">Return to staff sign-in</a></div></div>;const pages={dashboard:<AdminDashboardPage/>,users:<AdminUsersPage/>,properties:<AdminPropertiesPage/>,moderation:<AdminVerificationsPage/>,reports:<AdminReportsPage/>,verifications:<AdminVerificationsPage/>,operations:<AdminOperationsPage/>,students:<AdminGenericPage type="students"/>,contractors:<AdminGenericPage type="contractors"/>,analytics:<AdminGenericPage type="analytics"/>,transactions:<AdminMonetizationPage/>,"app-control":<AdminAppControlPage/>,"audit-logs":<AdminAuditPage/>};return <AdminShell page={page} setPage={navigate} role={auth.role} user={auth.user}>{Object.entries(pages).map(([id,view])=><div key={id} className={`admin-route-view ${page===id?"is-current":""}`} aria-hidden={page!==id}>{view}</div>)}</AdminShell>}
