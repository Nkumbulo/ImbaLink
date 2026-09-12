import { T, GRADIENT } from "../../styles/tokens";
export default function QuickFilterBubble({ icon: Icon, label, active, onClick }){
  return (<button onClick={onClick} className="flex flex-col items-center gap-1 shrink-0 active:scale-95 transition-transform">
    <div className="rounded-full flex items-center justify-center" style={{width:54,height:54,background:active?GRADIENT:T.paperDim,border:active?"none":`1.5px solid ${T.line}`}}><Icon size={19} strokeWidth={2.1} color={active?T.paper:T.ink60}/></div>
    <span className="f-body truncate font-medium" style={{color:active?T.ink:T.ink60,fontSize:10,maxWidth:54}}>{label}</span></button>);
}
