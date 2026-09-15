import { T } from "../../styles/tokens";
export default function ToggleSwitch({ on, onToggle }){
  return (<button onClick={onToggle} className="rounded-full p-0.5 shrink-0" style={{width:40,height:24,background:on?T.jacaranda:T.paperDim2,transition:"background .2s ease"}}>
    <div className="rounded-full" style={{width:20,height:20,background:T.white,transform:on?"translateX(16px)":"translateX(0)",transition:"transform .2s cubic-bezier(.2,.8,.2,1)",boxShadow:"0 1px 3px rgba(0,0,0,0.25)"}}/>
  </button>);
}
