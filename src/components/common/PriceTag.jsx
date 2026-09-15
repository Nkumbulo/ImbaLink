import { T } from "../../styles/tokens";
export default function PriceTag({ rent }){
  return (<div className="f-mono font-semibold px-2.5 py-1 rounded-full" style={{background:"rgba(20,32,26,0.65)",color:T.paper,backdropFilter:"blur(6px)",fontSize:12.5}}>${rent}<span className="opacity-70">/mo</span></div>);
}
