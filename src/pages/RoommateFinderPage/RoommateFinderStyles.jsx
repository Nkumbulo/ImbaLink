import { T } from "../../styles/tokens";

export default function RoommateFinderStyles() {
  return (
<style>{`
        .rf-page{min-height:100%;background:${T.paper};color:${T.ink};padding-bottom:80px}
        .rf-container{max-width:1180px;margin:0 auto;padding:0 28px}
        .rf-hero{position:relative;overflow:hidden;background:linear-gradient(180deg, ${T.paperDim2}, ${T.paperDim});color:${T.ink};border-radius:0 0 28px 28px;padding:40px 28px 30px;border-bottom:1px solid ${T.line}}
        .rf-hero-vectors{position:absolute;inset:0;width:100%;height:100%;color:${T.ink};pointer-events:none}
        .rf-hero-vectors-wrap{position:absolute;inset:0;pointer-events:none;will-change:transform;}
        .rf-hero-inner{position:relative;z-index:1;max-width:1180px;margin:0 auto;display:flex;align-items:center;gap:40px}
        .rf-hero-copy{position:relative;z-index:1;flex:1;min-width:0}
        .rf-hero-copy::before{content:"";position:absolute;left:-28px;right:-28px;top:-24px;bottom:-24px;background:radial-gradient(60% 100% at 0% 50%, ${T.paperDim} 55%, rgba(241,235,219,0) 100%);z-index:-1;pointer-events:none}
        .rf-eyebrow{display:inline-flex;align-items:center;gap:7px;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:${T.ink60};margin-bottom:12px}
        .rf-hero h1{font-size:clamp(28px,3.4vw,42px);line-height:1.05;letter-spacing:-.04em;margin:0 0 10px;font-family:'Sora',sans-serif;color:${T.ink}}
        .rf-hero p{margin:0;color:${T.ink60};font-size:14px;line-height:1.6;max-width:560px}
        .rf-hero-cta{margin-top:20px;border:0;border-radius:12px;padding:12px 18px;font-weight:700;font-size:12.5px;display:inline-flex;align-items:center;gap:8px;cursor:pointer;background:${T.ink};color:${T.paper};transition:transform .2s ease, box-shadow .2s ease, background .2s ease}
        .rf-hero-cta:hover{transform:translateY(-2px);box-shadow:0 6px 16px rgba(0,0,0,.2);background:${T.msasa}}
        .rf-hero-video{flex:0 0 380px;width:380px}
        .rf-hero-video-card{background:${T.white};border-radius:20px;overflow:hidden;box-shadow:0 20px 44px rgba(20,32,26,.16);border:1px solid rgba(20,32,26,.08);transition:transform .15s ease-out;will-change:transform}
        .rf-hero-video-topbar{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;background:${T.ink}}
        .rf-hero-video-brand{display:flex;align-items:center;gap:7px;font-size:11px;font-weight:800;letter-spacing:.02em;color:${T.paper}}
        .rf-hero-video-mark{display:flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:6px;background:rgba(251,248,240,.14);color:${T.paper}}
        .rf-hero-video-pill{display:inline-flex;align-items:center;gap:5px;font-size:9px;font-weight:750;text-transform:uppercase;letter-spacing:.06em;color:${T.paper};background:rgba(251,248,240,.12);padding:4px 9px;border-radius:999px}
        .rf-hero-video-dot{width:6px;height:6px;border-radius:50%;background:#5FBE83;flex-shrink:0}
        .rf-hero-video-frame{position:relative;width:100%;padding-top:56.25%;background:${T.paperDim2}}
        .rf-hero-video-thumb-button{position:absolute;inset:0;width:100%;height:100%;padding:0;border:0;background:transparent;cursor:pointer}
        .rf-hero-video-thumb{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}
        .rf-hero-video-play{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:64px;height:64px;border-radius:50%;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center;transition:background .2s ease;pointer-events:none}
        .rf-hero-video-card:hover .rf-hero-video-play{background:${T.jacaranda}}
        .rf-hero-video-iframe{position:absolute;inset:0;width:100%;height:100%;border:0}
        @media(max-width:900px){
          .rf-hero-inner{flex-direction:column;align-items:stretch;gap:22px}
          .rf-hero-video{width:100%;flex:none}
          .rf-hero-vectors{inset:auto;top:0;left:0;right:0;bottom:auto;height:auto;aspect-ratio:900/300;opacity:.8}
          .rf-hero-vectors-wrap{inset:auto;top:0;left:0;right:0;bottom:auto;height:auto;aspect-ratio:900/300;opacity:.8}
          .rf-hero-copy::before{display:block;left:-16px;right:-16px;top:-14px;bottom:-14px;background:${T.paperDim};border-radius:18px}
        }
        @media(max-width:640px){
          .rf-hero-vectors{aspect-ratio:520/230}
          .rf-hero-vectors-wrap{aspect-ratio:520/230}
        }
        .rf-section{padding:26px 0 0}
        .rf-card{background:${T.white};border:1px solid rgba(20,32,26,.08);border-radius:16px;padding:16px}
        .rf-section-head{display:flex;align-items:end;justify-content:space-between;gap:16px;margin-bottom:14px;flex-wrap:wrap}
        .rf-section-head h2{font-size:18px;margin:0;font-family:'Sora',sans-serif;letter-spacing:-.02em}
        .rf-section-head p{font-size:11.5px;color:${T.ink60};margin:4px 0 0}
        .rf-badge{display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:999px;font-size:9.5px;font-weight:750}
        .rf-badge-verified{background:color-mix(in srgb, var(--theme-green) 14%, transparent);color:${T.msasa}}
        .rf-badge-pending{background:rgba(110,99,184,.14);color:${T.jacaranda}}
        .rf-badge-unverified{background:${T.paperDim};color:${T.ink60}}
        .rf-search-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:14px}
        .rf-search-box{flex:1;min-width:180px;display:flex;align-items:center;gap:8px;background:${T.white};border:1px solid ${T.line};border-radius:11px;padding:9px 12px}
        .rf-search-box input{border:0;outline:0;background:transparent;font-size:12.5px;flex:1;color:${T.ink}}
        .rf-find-a-btn{display:inline-flex;align-items:center;gap:6px;background:${T.ink};color:${T.paper};border:0;border-radius:11px;padding:9px 14px;font-size:12px;font-weight:750;cursor:pointer;box-shadow:0 7px 18px rgba(20,32,26,.14);transition:transform .18s ease,box-shadow .18s ease}
        .rf-find-a-btn:hover{transform:translateY(-2px);box-shadow:0 11px 24px rgba(20,32,26,.2)}
        .rf-find-a-overlay{position:fixed;inset:0;z-index:120;background:rgba(20,32,26,.52);backdrop-filter:blur(9px);-webkit-backdrop-filter:blur(9px);display:flex;align-items:center;justify-content:center;padding:18px;animation:rfFindAFade .2s ease}
        .rf-find-a-panel{width:min(940px,100%);max-height:86vh;overflow:auto;background:${T.paper};border:1px solid rgba(20,32,26,.1);border-radius:26px;padding:20px;box-shadow:0 30px 80px rgba(0,0,0,.3);animation:rfFindASquish .3s cubic-bezier(.22,1,.36,1)}
        .rf-find-a-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px}
        .rf-find-a-head h3{margin:0;font-family:'Sora',sans-serif;font-size:20px;letter-spacing:-.03em}
        .rf-find-a-head p{margin:3px 0 0;color:${T.ink60};font-size:11px}
        .rf-find-a-close{width:35px;height:35px;border:0;border-radius:10px;background:${T.paperDim};color:${T.ink};display:grid;place-items:center;cursor:pointer}
        .rf-find-a-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
        .rf-find-a-card{background:${T.white};border:1px solid rgba(20,32,26,.08);border-radius:19px;padding:13px;box-shadow:0 7px 20px rgba(20,32,26,.06);transition:transform .18s ease,box-shadow .18s ease}
        .rf-find-a-card:hover{transform:translateY(-4px) scale(1.01);box-shadow:0 15px 30px rgba(20,32,26,.12)}
        .rf-find-a-person{display:flex;align-items:center;gap:9px}
        .rf-find-a-avatar{width:50px;height:50px;border-radius:15px;overflow:hidden;background:${T.paperDim};display:grid;place-items:center;font-size:16px;font-weight:800;flex:0 0 auto}
        .rf-find-a-avatar img{width:100%;height:100%;object-fit:cover}
        .rf-find-a-name{font-size:13px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .rf-find-a-meta{font-size:10px;color:${T.ink60};margin-top:3px;line-height:1.45}
        .rf-find-a-tags{display:flex;flex-wrap:wrap;gap:5px;margin:10px 0 12px}
        .rf-find-a-tag{background:${T.paperDim};color:${T.ink60};padding:4px 7px;border-radius:999px;font-size:8.5px;font-weight:700}
        .rf-find-a-match{font-size:9px;font-weight:800;color:${T.jacaranda};margin-left:auto}
        .rf-find-a-profile{width:100%;border:0;border-radius:10px;background:${T.ink};color:${T.paper};padding:9px;font-size:10.5px;font-weight:750;cursor:pointer}
        @keyframes rfFindAFade{from{opacity:0}to{opacity:1}}
        @keyframes rfFindASquish{from{opacity:0;transform:scale(.94) translateY(10px)}to{opacity:1;transform:scale(1) translateY(0)}}
        @media(max-width:800px){.rf-find-a-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
        @media(max-width:520px){.rf-find-a-overlay{padding:9px}.rf-find-a-panel{padding:14px;border-radius:21px}.rf-find-a-grid{grid-template-columns:1fr}}
        .rf-filter-btn{display:inline-flex;align-items:center;gap:6px;background:${T.white};border:1px solid ${T.line};border-radius:11px;padding:9px 12px;font-size:12px;font-weight:650;color:${T.ink};cursor:pointer}
        .rf-filter-btn.is-active{background:${T.jacaranda};border-color:${T.jacaranda};color:${T.paper}}
        .rf-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
        .rf-compact-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px}
        .rf-compact-card{background:${T.white};border:1px solid rgba(20,32,26,.08);border-radius:12px;padding:10px;display:flex;flex-direction:column;gap:8px}
        .rf-compact-card img{width:100%;height:100px;object-fit:cover;border-radius:8px;background:${T.paperDim}}
        .rf-compact-card .rf-person{display:flex;align-items:center;gap:8px}
        .rf-compact-card .rf-person .avatar{width:32px;height:32px;border-radius:50%;background:${T.jacaranda};color:${T.paper};display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700}
        .rf-compact-card .rf-compact-name{font-size:13px;font-weight:700;color:${T.ink};white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .rf-compact-card .rf-compact-detail{font-size:10px;color:${T.ink60}}
        .rf-compact-card .rf-btn-secondary{padding:6px 8px;font-size:10px}
        .rf-empty{background:${T.white};border:1px solid rgba(20,32,26,.09);border-radius:16px;padding:30px;text-align:center;color:${T.ink60};font-size:12.5px}
        .rf-person{display:flex;align-items:center;gap:10px}
        .rf-person h3{font-size:14px;margin:0 0 2px;display:flex;align-items:center;gap:6px}
        .rf-person p{font-size:10.5px;color:${T.ink60};margin:0}
        .rf-match{margin-left:auto;text-align:right}
        .rf-match b{display:block;font-size:16px;color:${T.jacaranda};font-family:'Sora',sans-serif}
        .rf-match small{font-size:8.5px;color:${T.ink60};text-transform:uppercase;letter-spacing:.05em}
        .rf-meta{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin:14px 0}
        .rf-meta-box{background:${T.paperDim};border-radius:9px;padding:9px}
        .rf-meta-box small{display:block;color:${T.ink60};font-size:8px;margin-bottom:3px}
        .rf-meta-box b{font-size:10.5px}
        .rf-tags{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:12px}
        .rf-tag{background:${T.paperDim};border-radius:999px;padding:3px 9px;font-size:9.5px;color:${T.ink60};font-weight:600}
        .rf-card-actions{display:flex;gap:7px}
        .rf-btn-secondary{flex:1;border:1px solid rgba(20,32,26,.12);background:${T.white};border-radius:9px;padding:9px;font-size:10.5px;font-weight:750;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:5px}
        .rf-btn-secondary.active{background:${T.msasa};color:${T.white};border-color:${T.msasa}}
        .rf-btn-primary{flex:1;border:0;background:${T.jacaranda};color:${T.paper};border-radius:9px;padding:9px;font-size:10.5px;font-weight:750;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:5px}
        .rf-demo-note{font-size:10.5px;color:${T.ink60};margin-top:14px}
        .rf-how{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
        .rf-step{background:${T.white};border:1px solid rgba(20,32,26,.08);border-radius:14px;padding:15px}
        .rf-step-num{font-size:10px;font-weight:800;color:${T.jacaranda};margin-bottom:12px}
        .rf-step h3{font-size:12px;margin:0 0 5px}
        .rf-step p{font-size:10px;line-height:1.5;color:${T.ink60};margin:0}
        .rf-pref-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px}
        .rf-pref-field{display:flex;flex-direction:column;gap:5px}
        .rf-pref-field.full{grid-column:1/-1}
        .rf-pref-field label{font-size:9px;font-weight:750;color:${T.ink60};text-transform:uppercase;letter-spacing:.04em}
        .rf-tag-picker{display:flex;flex-wrap:wrap;gap:6px;margin-top:2px}
        .rf-tag-choice{border:1px solid rgba(20,32,26,.14);background:${T.white};color:${T.ink};border-radius:999px;padding:6px 11px;font-size:10.5px;font-weight:650;cursor:pointer;display:inline-flex;align-items:center;gap:4px}
        .rf-tag-choice.is-active{background:${T.jacaranda};border-color:${T.jacaranda};color:${T.paper}}
        .rf-incomplete-banner{background:rgba(184,61,49,.08);border:1px solid rgba(184,61,49,.18);border-radius:14px;padding:14px 16px;display:flex;align-items:center;gap:12px;margin-bottom:16px}
        .rf-property-preview{display:flex;align-items:center;gap:14px;background:${T.white};border:1px solid rgba(20,32,26,.08);border-radius:16px;padding:14px;flex-wrap:wrap}
        .rf-property-preview-img{width:76px;height:76px;border-radius:12px;object-fit:cover;flex-shrink:0;background:${T.paperDim}}
        .rf-sharing-status{display:flex;align-items:center;gap:8px;flex:none}
        .rf-sharing-pill{padding:8px 12px;font-size:11px}
        .rf-remove-btn{display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:50%;border:1px solid rgba(184,61,49,.25);background:rgba(184,61,49,.08);color:${T.brick};cursor:pointer;flex-shrink:0}
        .rf-remove-btn:disabled{opacity:.5;cursor:not-allowed}
        .rf-property-preview-body{flex:1;min-width:180px}
        .rf-property-preview-body h2{font-size:15px;margin:0 0 4px;font-family:'Sora',sans-serif}
        .rf-property-preview-body p{font-size:11px;color:${T.ink60};margin:0 0 6px;display:flex;align-items:center}
        .rf-property-preview-meta{display:flex;gap:10px;font-size:10.5px;color:${T.ink};font-weight:700}
        .rf-property-mini{width:100%;display:flex;align-items:center;gap:9px;text-align:left;border:1px solid rgba(20,32,26,.08);background:${T.paperDim};border-radius:11px;padding:8px;margin:0 0 11px;cursor:pointer}.rf-property-mini img{width:48px;height:42px;border-radius:8px;object-fit:cover;flex-shrink:0}.rf-property-mini span{min-width:0;flex:1}.rf-property-mini small,.rf-property-mini b,.rf-property-mini em{display:block}.rf-property-mini small{font-size:8px;color:${T.ink60};text-transform:uppercase}.rf-property-mini b{font-size:10.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.rf-property-mini em{font-size:9px;color:${T.ink60};font-style:normal;margin-top:2px}
        .rf-modal-backdrop{position:fixed;inset:0;z-index:100;background:rgba(8,15,11,.55);display:grid;place-items:center;padding:20px}
        .rf-modal{background:${T.paper};width:min(520px,100%);border-radius:18px;padding:20px;box-shadow:0 24px 70px rgba(0,0,0,.3);max-height:calc(100dvh - 40px);overflow-y:auto}
        .rf-modal-head{display:flex;justify-content:space-between;align-items:flex-start;gap:15px}
        .rf-close{border:0;background:${T.paperDim};width:32px;height:32px;border-radius:50%;display:grid;place-items:center;cursor:pointer;flex-shrink:0}
        .rf-toast{position:fixed;left:50%;bottom:calc(88px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);background:${T.ink};color:${T.paper};padding:11px 16px;border-radius:999px;font-size:12px;font-weight:600;box-shadow:0 12px 30px rgba(0,0,0,.25);z-index:200;white-space:nowrap}
        @media(min-width:768px){.rf-toast{bottom:28px}}
        @media(max-width:1024px){.rf-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
        @media(max-width:900px){.rf-how{grid-template-columns:repeat(2,1fr)}}
        @media(max-width:640px){.rf-container{padding:0 15px}.rf-hero{padding:26px 15px 22px;border-radius:0 0 20px 20px}.rf-hero-vectors{aspect-ratio:520/230}.rf-hero-video-card{border-radius:16px}.rf-grid{grid-template-columns:1fr}.rf-how{grid-template-columns:1fr}.rf-pref-grid{grid-template-columns:1fr}.rf-pref-field.full{grid-column:auto}.rf-section-head{flex-direction:column;align-items:flex-start}}
        .rf-pagination{display:flex;align-items:center;justify-content:space-between;margin-top:16px;font-size:12px;color:${T.ink60}}
        .rf-pagination-actions{display:flex;align-items:center;gap:8px}
        .rf-pagination-page{font-weight:700;color:${T.jacaranda}}
`}</style>
  );
}
