import { T } from "../../styles/tokens";
// Row must be defined outside the component — same reasoning as the Field
// fix in the registration forms: a component defined inside a render
// function is a new function reference every render, causing React to
// remount its subtree unnecessarily on every re-render.
const Row=({label,value,bold})=>(<div className={`flex items-baseline justify-between f-mono ${bold?"font-semibold":""}`} style={{color:bold?T.ink:T.ink60,fontSize:13}}><span>{label}</span><span className="flex-1 mx-2 border-b border-dotted" style={{borderColor:T.line,transform:"translateY(-3px)"}}/><span>${value}</span></div>);
export default function Receipt({ p }){
  const total=p.rent+p.deposit+p.fee;
  return (<div className="rounded-xl p-4 space-y-2" style={{background:T.paperDim,border:`1px dashed ${T.ink60}55`}}>
    <div className="f-mono mb-1" style={{color:T.ink60,fontSize:10,letterSpacing:"0.2em"}}>COST BREAKDOWN — NO HIDDEN FEES</div>
    <Row label="Rent (monthly)" value={p.rent}/><Row label="Deposit" value={p.deposit}/><Row label="Platform fee" value={p.fee}/><div className="h-px my-1" style={{background:T.line}}/><Row label="Due before move-in" value={total} bold/>
  </div>);
}
