// The full StudentPage stylesheet, extracted verbatim from the page's
// inline `<style>` block. Depends on theme tokens (T.paper, T.ink, etc.)
// so it's a function rather than a plain string constant.
export const getStudentPageStyles = (T) => `
        .student-page{min-height:100%;background:${T.paper};color:${T.ink};padding-bottom:80px}
        .student-container{max-width:1180px;margin:0 auto;padding:0 28px}
        /* noveatech.debug: Changed overflow from hidden to visible so dropdown menu is not clipped */
        .student-hero{position:relative;overflow:visible;background:var(--theme-green-deep, #204F3A);color:${T.paper};border-radius:0 0 28px 28px;padding:48px 28px 34px}
        .student-hero-inner{max-width:1180px;margin:0 auto;display:grid;grid-template-columns:minmax(0,1.35fr) minmax(280px,.65fr);gap:36px;align-items:start}
        .student-eyebrow{display:inline-flex;align-items:center;gap:7px;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:${T.ochre};margin-bottom:14px}
        .student-hero h1{font-size:clamp(34px,4vw,56px);line-height:1.02;letter-spacing:-.045em;margin:0 0 14px;max-width:700px;font-family:'Sora',sans-serif}
        .student-hero p{margin:0;color:rgba(251,248,240,.68);font-size:15px;line-height:1.6;max-width:600px}
        .student-hero-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:24px}
        .student-roommate-hero-btn{border:1px solid rgba(241,235,219,.2);background:rgba(251,248,240,.08);color:${T.paper};border-radius:14px;padding:11px 14px;display:inline-flex;align-items:center;gap:10px;cursor:pointer;text-align:left;min-width:250px}
        .student-roommate-hero-btn strong{display:block;font-size:12px}.student-roommate-hero-btn small{display:block;font-size:9px;color:rgba(251,248,240,.58);margin-top:2px}.student-roommate-hero-icon{width:32px;height:32px;border-radius:10px;background:${T.msasa};display:grid;place-items:center;flex:0 0 auto}
        .student-campus-card-primary{align-self:start}.student-hero-controls{display:flex;flex-direction:column;align-items:stretch;gap:10px;justify-self:end;width:min(100%,430px)}.student-hero-controls .student-hero-actions{display:flex;flex-direction:column;gap:8px;margin-top:0}.student-hero-controls .student-hero-btn,.student-hero-controls .student-roommate-hero-btn{width:100%;min-width:0}.student-hero-controls .student-campus-card{max-width:none;width:100%}
        .student-hero-btn{border:1px solid rgba(241,235,219,.2);border-radius:14px;padding:11px 14px;font-weight:700;font-size:12px;display:inline-flex;align-items:center;gap:10px;cursor:pointer;text-align:left;min-width:250px;background:rgba(251,248,240,.08);color:${T.paper}}
        .student-hero-btn.primary{background:rgba(251,248,240,.08);color:${T.paper}}
        .student-hero-btn-icon{width:32px;height:32px;border-radius:10px;background:${T.paperDim};color:${T.ink};display:grid;place-items:center;flex:0 0 auto}
        .student-hero-btn-copy{display:block;min-width:0;flex:1}.student-hero-btn-copy strong{display:block;font-size:12px}.student-hero-btn-copy small{display:block;font-size:9px;color:rgba(251,248,240,.58);margin-top:2px;font-weight:500;line-height:1.35}
        .student-hero-link{border:0;background:none;color:rgba(251,248,240,.75);font-weight:700;font-size:12px;display:inline-flex;align-items:center;gap:6px;cursor:pointer;padding:13px 4px}
        .student-hero-link:hover{color:${T.paper}}
        .student-campus-card{background:rgba(251,248,240,.07);border:1px solid rgba(251,248,240,.13);border-radius:16px;padding:13px 14px;max-width:430px}
        .student-campus-label{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:rgba(251,248,240,.5);font-weight:700;margin-bottom:8px}
        .student-select{position:relative}
        .student-select button{width:100%;display:flex;align-items:center;justify-content:space-between;gap:10px;background:${T.white};border:0;border-radius:10px;padding:10px 11px;color:${T.ink};font-weight:650;font-size:12px;text-align:left;cursor:pointer}
        .student-select-menu{position:absolute;top:calc(100% + 7px);left:0;right:0;z-index:30;background:${T.white};border-radius:12px;padding:6px;box-shadow:0 18px 45px rgba(0,0,0,.25);max-height:280px;overflow-y:auto}
        .student-select-menu button{padding:10px;border-radius:8px;background:transparent;font-size:12px}
        .student-select-menu button:hover{background:${T.paperDim}}
        .student-section{padding:30px 0 0}
        .student-section-head{display:flex;align-items:end;justify-content:space-between;gap:20px;margin-bottom:16px;flex-wrap:wrap}
        .student-section-head h2{font-size:22px;letter-spacing:-.025em;margin:0;font-family:'Sora',sans-serif}
        .student-section-head p{font-size:12px;color:${T.ink60};margin:5px 0 0}
        .student-link-btn{border:0;background:none;font-weight:700;font-size:12px;color:${T.msasa};cursor:pointer;display:inline-flex;align-items:center;gap:5px}
        .student-find-a-btn{display:inline-flex;align-items:center;gap:8px;border:1px solid rgba(20,32,26,.1);background:${T.ink};color:${T.paper};border-radius:12px;padding:10px 14px;font-size:12px;font-weight:750;cursor:pointer;box-shadow:0 8px 20px rgba(20,32,26,.12);transition:transform .18s ease,box-shadow .18s ease}
        .student-find-a-btn:hover{transform:translateY(-2px);box-shadow:0 12px 25px rgba(20,32,26,.16)}
        .find-a-overlay{position:fixed;inset:0;z-index:100;background:rgba(20,32,26,.55);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:20px;animation:findAFade .2s ease}
        .find-a-panel{width:min(980px,100%);max-height:min(86vh,760px);overflow:auto;background:${T.paper};border:1px solid rgba(20,32,26,.1);border-radius:28px;box-shadow:0 30px 80px rgba(0,0,0,.28);padding:22px;animation:findASquish .32s cubic-bezier(.22,1,.36,1)}
        .find-a-head{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:18px}
        .find-a-title-wrap{display:flex;align-items:center;gap:11px;min-width:0}
        .find-a-icon{width:40px;height:40px;border-radius:13px;background:${T.msasa};color:${T.paper};display:grid;place-items:center;flex:0 0 auto}
        .find-a-head h3{margin:0;font-family:'Sora',sans-serif;font-size:20px;letter-spacing:-.025em}
        .find-a-head p{margin:3px 0 0;color:${T.ink60};font-size:11px}
        .find-a-close{width:36px;height:36px;border:0;border-radius:11px;background:${T.paperDim};color:${T.ink};display:grid;place-items:center;cursor:pointer;flex:0 0 auto}
        .find-a-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
        .find-a-card{background:${T.white};border:1px solid rgba(20,32,26,.09);border-radius:20px;padding:14px;box-shadow:0 7px 18px rgba(20,32,26,.06);transition:transform .18s ease,box-shadow .18s ease}
        .find-a-card:hover{transform:translateY(-3px) scale(1.01);box-shadow:0 14px 28px rgba(20,32,26,.11)}
        .find-a-avatar{width:52px;height:52px;border-radius:16px;object-fit:cover;background:${T.paperDim};display:grid;place-items:center;font-weight:800;font-size:17px;color:${T.ink};overflow:hidden}
        .find-a-avatar img{width:100%;height:100%;object-fit:cover}
        .find-a-card-name{font-size:14px;font-weight:800;margin-top:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .find-a-meta{font-size:10.5px;color:${T.ink60};line-height:1.45;margin-top:3px;min-height:31px}
        .find-a-tags{display:flex;gap:5px;flex-wrap:wrap;margin:9px 0 12px}
        .find-a-tag{font-size:9px;font-weight:700;padding:4px 7px;border-radius:999px;background:${T.paperDim};color:${T.ink60}}
        .find-a-match{font-size:9px;font-weight:800;color:${T.msasa};margin-left:auto}
        .find-a-card-top{display:flex;align-items:flex-start;gap:10px}
        .find-a-profile-btn{width:100%;border:0;border-radius:11px;background:${T.ink};color:${T.paper};padding:9px 10px;font-size:10.5px;font-weight:750;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px}
        .find-a-empty{padding:35px 15px;text-align:center;color:${T.ink60};font-size:12px}
        .find-a-spinner{display:grid;place-items:center;min-height:220px;color:${T.ink60};font-size:12px}
        .find-a-detail{margin-top:12px;padding:18px;border-radius:18px;background:${T.white};border:1px solid rgba(20,32,26,.09)}
        .find-a-detail-top{display:flex;gap:13px;align-items:center}
        .find-a-detail h4{margin:0;font-size:17px}
        .find-a-detail p{margin:4px 0 0;color:${T.ink60};font-size:11px;line-height:1.5}
        .find-a-detail-about{margin-top:14px;font-size:12px;line-height:1.6;color:${T.ink60}}
        @keyframes findAFade{from{opacity:0}to{opacity:1}}
        @keyframes findASquish{from{opacity:0;transform:translateY(18px) scale(.96)}to{opacity:1;transform:translateY(0) scale(1)}}
        .student-empty{background:${T.white};border:1px solid rgba(20,32,26,.09);border-radius:16px;padding:26px;text-align:center;color:${T.ink60};font-size:12.5px}
        .student-home-tile{display:flex;flex-direction:column;gap:8px}
        @media(max-width:900px){.student-hero-inner{grid-template-columns:1fr}.student-hero-controls{width:100%;justify-self:stretch}}
        @media(max-width:800px){.find-a-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}\n        @media(max-width:520px){.find-a-overlay{padding:10px}.find-a-panel{padding:15px;border-radius:22px}.find-a-grid{grid-template-columns:1fr}.find-a-head h3{font-size:17px}}\n        @media(max-width:640px){.student-container{padding:0 15px}.student-hero{padding:28px 15px 24px;border-radius:0 0 20px 20px}.student-hero h1{font-size:34px}.student-hero p{font-size:13px}.student-hero-actions{display:grid;grid-template-columns:1fr}.student-hero-btn,.student-hero-link{justify-content:center}.student-campus-card{margin-top:2px}.student-section{padding-top:24px}.student-section-head{align-items:flex-start;flex-direction:column;gap:10px}}
`;
