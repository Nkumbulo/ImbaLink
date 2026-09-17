
import React,{useEffect,useRef,useState} from "react";
import {LayoutDashboard,Users,Building2,GraduationCap,HardHat,Flag,ShieldCheck,Activity,BarChart3,Settings,LogOut,ChevronDown,Shield,Receipt,ScrollText,Megaphone} from "lucide-react";
import {supabase} from "../../core/supabase/client";
const items=[
 ["dashboard","Dashboard",LayoutDashboard],["users","Users",Users],["properties","Properties",Building2],["moderation","Moderation",ShieldCheck],["transactions","Transactions",Receipt],["reports","Reports",Flag],["app-control","App Control",Megaphone],["audit-logs","Audit Logs",ScrollText],["operations","Operations",Activity],["analytics","Analytics",BarChart3],
];
export default function AdminShell({page,setPage,role,user,children}){
 const allowed=["admin","super_admin"].includes(role)?items:items.filter(([id])=>!["app-control","audit-logs","transactions"].includes(id));
 const [profileOpen,setProfileOpen]=useState(false); const [signingOut,setSigningOut]=useState(false); const profileRef=useRef(null);
 useEffect(()=>{const close=(e)=>{if(profileRef.current&&!profileRef.current.contains(e.target))setProfileOpen(false)};document.addEventListener("mousedown",close);return()=>document.removeEventListener("mousedown",close)},[]);
 const go=async()=>{if(signingOut)return;setSigningOut(true);try{await supabase.auth.signOut()}finally{window.location.replace("/admin/login")}};
 const displayName=user?.user_metadata?.full_name||user?.user_metadata?.name||user?.email?.split("@")[0]||"Administrator"; const avatar=user?.user_metadata?.avatar_url||user?.user_metadata?.picture||"";
 return <div className="admin-root"><div className="admin-layout"><aside className="admin-sidebar">
  <div className="admin-brand"><div className="admin-brand-mark">IL</div><div><strong>ImbaLink</strong><small>Administration</small></div></div>
  <nav className="admin-nav">{allowed.map(([id,label,Icon])=><button key={id} className={`admin-nav-button ${page===id?"is-active":""}`} onClick={()=>setPage(id)}><Icon size={17}/><span>{label}</span></button>)}</nav>
  <div className="admin-sidebar-spacer"/>
  <div className="admin-account"><b>{user?.email||"Staff account"}</b><span>{role==="admin"?"Administrator":"Staff"}</span><button className="admin-signout" onClick={go}><LogOut size={13}/> Sign out</button></div>
 </aside><main className="admin-main"><header className="admin-topbar"><div className="admin-topbar-context"><span>ImbaLink Administration</span><b>{items.find(([id])=>id===page)?.[1]||"Dashboard"}</b></div><div className="admin-profile-wrap" ref={profileRef}><button className="admin-profile-button" onClick={()=>setProfileOpen(v=>!v)} aria-expanded={profileOpen}><span className="admin-avatar">{avatar?<img src={avatar} alt=""/>:displayName.slice(0,1).toUpperCase()}</span><span className="admin-profile-copy"><b>{displayName}</b><small>{role==="admin"?"Administrator":role||"Staff"}</small></span><ChevronDown size={15}/></button>{profileOpen&&<div className="admin-profile-menu"><div className="admin-profile-menu-head"><span className="admin-avatar large">{avatar?<img src={avatar} alt=""/>:displayName.slice(0,1).toUpperCase()}</span><div><b>{displayName}</b><small>{user?.email||"Staff account"}</small></div></div><div className="admin-profile-role"><Shield size={14}/><span>{role==="admin"?"Full administrator access":"Staff access"}</span></div><button className="admin-profile-signout" onClick={go} disabled={signingOut}><LogOut size={14}/>{signingOut?"Signing out…":"Sign out"}</button></div>}</div></header><div className="admin-content">{children}</div></main></div></div>
}
