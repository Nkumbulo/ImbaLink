import Field from "./Field";
import { AMENITIES, RULES } from "./options";
import { T } from "../../../styles/tokens";
export default function DetailsFields({ form, updateField, toggleItem, inputClass, inputStyle }) {
 return <>
  <Field label="DESCRIPTION *"><textarea rows="4" className={inputClass} style={inputStyle} name="description" value={form.description} onChange={e=>updateField("description",e.target.value)} placeholder="Describe the property, access, utilities, costs and conditions." /></Field>
  <Field label="AMENITIES"><div className="flex flex-wrap gap-1.5">{AMENITIES.map(x=><button type="button" key={x} onClick={()=>toggleItem("amenities",x)} className="px-2.5 py-1.5 rounded-full f-body" style={{background:form.amenities.includes(x)?T.jacaranda:T.paperDim,color:form.amenities.includes(x)?T.paper:T.ink,fontSize:9.5}}>{x}</button>)}</div></Field>
  <Field label="HOUSE RULES"><div className="grid grid-cols-2 gap-2">{RULES.map(x=><label key={x} className="flex gap-2 items-center p-2.5 rounded-xl" style={{background:T.paperDim,color:T.ink,fontSize:10.5}}><input type="checkbox" checked={form.rules.includes(x)} onChange={()=>toggleItem("rules",x)}/>{x}</label>)}</div></Field>
  <label className="flex items-center gap-2.5 rounded-xl p-3" style={{background:T.paperDim}}><input type="checkbox" checked={form.furnished} onChange={e=>updateField("furnished",e.target.checked)}/><span className="f-body" style={{color:T.ink,fontSize:11.5}}>Furnished property</span></label>
  <Field label="OWNERSHIP / AUTHORITY"><select className={inputClass} style={inputStyle} name="ownershipType" value={form.ownershipType} onChange={e=>updateField("ownershipType",e.target.value)}><option>Owner</option><option>Authorized agent</option><option>Property management company</option><option>Family representative</option></select></Field>
  <Field label="OWNERSHIP / AUTHORITY REFERENCE"><input className={inputClass} style={inputStyle} name="ownershipReference" value={form.ownershipReference} onChange={e=>updateField("ownershipReference",e.target.value)} placeholder="Reference or document note (optional)" /></Field>
  <Field label="SECURITY"><input className={inputClass} style={inputStyle} name="security" value={form.security} onChange={e=>updateField("security",e.target.value)} /></Field>
 </>;
}
