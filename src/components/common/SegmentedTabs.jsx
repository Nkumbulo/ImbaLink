import { T } from "../../styles/tokens";
export default function SegmentedTabs({ tabs, active, onChange }){
  return (<div className="flex gap-1 p-1 rounded-full" style={{background:T.paperDim}}>{tabs.map(t=>(<button key={t.id} onClick={()=>onChange(t.id)} className="flex-1 f-body font-semibold py-2 rounded-full capitalize transition-all" style={{background:active===t.id?T.ink:"transparent",color:active===t.id?T.paper:T.ink60,fontSize:12}}>{t.label}</button>))}</div>);
}
