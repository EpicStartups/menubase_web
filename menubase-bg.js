(function(){
  const s=document.currentScript;
  const MODE=(s&&s.dataset.mode)||'synthesis';      // 'synthesis' | 'ambient' | 'off'
  const THEME=(s&&s.dataset.theme)||'light';         // 'light' | 'dark'
  if(MODE==='off') return;
  let cv=document.getElementById('mb-bg');
  if(!cv){ cv=document.createElement('canvas'); cv.id='mb-bg'; cv.setAttribute('aria-hidden','true'); document.body.prepend(cv); }
  Object.assign(cv.style,{position:'fixed',inset:'0',zIndex:'0',pointerEvents:'none',display:'block',width:'100%',height:'100%'});
  const ctx=cv.getContext('2d');
  const DARK=THEME==='dark';
  const BG=DARK?'#121212':'#F4F0E6';
  const INK=DARK?[230,230,222]:[26,26,26], LIME=[188,241,37], LIMED=[166,212,19], GREY=DARK?[150,150,140]:[110,110,110];
  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const NOHOVER=matchMedia('(hover: none), (pointer: coarse)').matches;
  let W=0,H=0,DPR=1,pts=[],ev=null,nextAt=0,lastMove=-1e9,running=true,loopId;
  const mouse={x:-9999,y:-9999,tx:-9999,ty:-9999,active:false};
  const rgba=(c,a)=>`rgba(${c[0]|0},${c[1]|0},${c[2]|0},${a})`;
  const mix=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];
  const INPUTS=[['BASKET','EGGS BENEDICT'],['TIME','9:42 AM'],['WEATHER','RAINY'],['LAST VISIT','6 DAYS'],['MARGIN','HIGH'],['DAYPART','BREAKFAST'],['TABLE','REGULAR'],['STOCK','LOW · 4 LEFT']];
  const RESULTS=['WHITE COFFEE · 89%','TRUFFLE FRIES · 74%','LAVA CAKE · 81%','ICED MILO · 86%','CHEESECAKE · 70%'];
  const small=()=>W<760;
  function seed(){ const n=Math.round(Math.min(small()?34:110,(W*H)/(small()?22000:16000))); pts=[]; for(let i=0;i<n;i++) pts.push({x:Math.random()*W,y:Math.random()*H,vx:(Math.random()-.5)*.22,vy:(Math.random()-.5)*.22,s:2+Math.random()*3}); }
  function resize(){ DPR=Math.min(devicePixelRatio||1,2); W=innerWidth; H=innerHeight; cv.width=W*DPR; cv.height=H*DPR; ctx.setTransform(DPR,0,0,DPR,0,0); seed(); ev=null; nextAt=0; if(reduce) frame(performance.now()); }
  function startEv(t){ const fx=W*(small()?0.5:(0.50+Math.random()*0.38)), fy=H*(small()?0.42:(0.30+Math.random()*0.42));
    const k=4+(Math.random()*2|0), pool=INPUTS.slice().sort(()=>Math.random()-.5).slice(0,k), base=Math.random()*6.28;
    const nodes=pool.map((lab,i)=>{ const a=base+i*(6.28/k)+(Math.random()-.5)*.5, r=(small()?90:150)+Math.random()*(small()?60:120); return {x:fx+Math.cos(a)*r,y:fy+Math.sin(a)*r,lab}; });
    ev={fx,fy,nodes,result:RESULTS[Math.random()*RESULTS.length|0],t0:t,DUR:4200}; }
  function frame(t){
    ctx.fillStyle=BG; ctx.fillRect(0,0,W,H);
    const R=150;
    for(const p of pts){ p.x+=p.vx; p.y+=p.vy; if(p.x<-20)p.x=W+20; if(p.x>W+20)p.x=-20; if(p.y<-20)p.y=H+20; if(p.y>H+20)p.y=-20; }
    for(let i=0;i<pts.length;i++){
      for(let j=i+1;j<pts.length;j++){ const dx=pts[i].x-pts[j].x,dy=pts[i].y-pts[j].y,d=Math.hypot(dx,dy);
        if(d<R){ ctx.strokeStyle=rgba(INK,.05*(1-d/R)); ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(pts[i].x,pts[i].y); ctx.lineTo(pts[j].x,pts[j].y); ctx.stroke(); } }
      if(mouse.active){ const dx=pts[i].x-mouse.x,dy=pts[i].y-mouse.y,d=Math.hypot(dx,dy);
        if(d<220){ ctx.strokeStyle=rgba(LIMED,.5*(1-d/220)); ctx.lineWidth=1.2; ctx.beginPath(); ctx.moveTo(pts[i].x,pts[i].y); ctx.lineTo(mouse.x,mouse.y); ctx.stroke(); } }
    }
    for(const p of pts){ let l=0; if(mouse.active){ const dx=p.x-mouse.x,dy=p.y-mouse.y; l=Math.exp(-Math.hypot(dx,dy)/180); }
      ctx.fillStyle=rgba(mix(INK,LIME,Math.min(1,l*1.2)),.18+l*.7); ctx.fillRect(p.x-p.s/2,p.y-p.s/2,p.s,p.s); }
    if(MODE==='synthesis' && !reduce){
      // Synthesis only fires while the hero is in view. Below the hero the labels
      // (WEATHER, TIME, etc.) would land on body copy. Constellation drift continues regardless.
      const nearTop = (scrollY||0) < (innerHeight * 0.55);
      if(!ev && t>nextAt && nearTop){ nextAt===0?(nextAt=t+600):startEv(t); }
      if(ev){ const p=(t-ev.t0)/ev.DUR;
        if(p>=1 || !nearTop){ ev=null; nextAt=t+900+Math.random()*1200; }
        else{ const ein=Math.min(1,p/.22), eout=p>.82?Math.max(0,1-(p-.82)/.18):1, grow=Math.min(1,p/.34), bloom=Math.max(0,Math.min(1,(p-.30)/.22)), env=ein*eout, lab=!small();
          ctx.font='600 11px "JetBrains Mono",ui-monospace,monospace'; ctx.textBaseline='middle';
          for(const nd of ev.nodes){ const lx=nd.x+(ev.fx-nd.x)*grow, ly=nd.y+(ev.fy-nd.y)*grow;
            ctx.strokeStyle=rgba(mix(INK,LIMED,grow),.40*env*(.4+grow*.6)); ctx.lineWidth=1.1; ctx.beginPath(); ctx.moveTo(nd.x,nd.y); ctx.lineTo(lx,ly); ctx.stroke();
            ctx.fillStyle=rgba(INK,.40*env); ctx.fillRect(nd.x-3,nd.y-3,6,6);
            if(lab){ const left=nd.x<ev.fx; ctx.textAlign=left?'right':'left'; const tx=nd.x+(left?-12:12);
              ctx.fillStyle=rgba(GREY,.50*env); ctx.fillText(nd.lab[0],tx,nd.y-7); ctx.fillStyle=rgba(INK,.55*env); ctx.fillText(nd.lab[1],tx,nd.y+7); } }
          if(bloom>0){ const g=ctx.createRadialGradient(ev.fx,ev.fy,0,ev.fx,ev.fy,90*bloom); g.addColorStop(0,rgba(LIME,.55*bloom*eout)); g.addColorStop(1,rgba(LIME,0)); ctx.fillStyle=g; ctx.fillRect(ev.fx-90,ev.fy-90,180,180);
            const sz=6+bloom*8; ctx.fillStyle=rgba(LIMED,.95*eout); ctx.fillRect(ev.fx-sz/2,ev.fy-sz/2,sz,sz);
            if(lab){ ctx.textAlign='left'; ctx.font='700 13px "JetBrains Mono",ui-monospace,monospace'; ctx.fillStyle=rgba(INK,.60*bloom*eout); ctx.fillText('→ '+ev.result,ev.fx+18,ev.fy); } }
        }
      }
    }
  }
  addEventListener('resize',resize); addEventListener('orientationchange',()=>setTimeout(resize,250));
  if(window.visualViewport) visualViewport.addEventListener('resize',resize);
  addEventListener('pointermove',e=>{ mouse.tx=e.clientX; mouse.ty=e.clientY; mouse.active=true; lastMove=performance.now(); });
  addEventListener('pointerleave',()=>{ if(!NOHOVER) mouse.active=false; });
  addEventListener('touchmove',e=>{ const t=e.touches[0]; if(t){ mouse.tx=t.clientX; mouse.ty=t.clientY; mouse.active=true; lastMove=performance.now(); } },{passive:true});
  document.addEventListener('visibilitychange',()=>{ running=!document.hidden; if(running && !reduce) loopId=requestAnimationFrame(loop); });
  resize();
  function loop(t){
    if(!running) return;
    if(!reduce && (NOHOVER || t-lastMove>2600)){ mouse.tx=(0.5+0.30*Math.sin(t*0.00037)+0.13*Math.sin(t*0.00111))*W; mouse.ty=(0.46+0.28*Math.cos(t*0.00029)+0.11*Math.cos(t*0.00131))*H; mouse.active=true; }
    mouse.x+=(mouse.tx-mouse.x)*.12; mouse.y+=(mouse.ty-mouse.y)*.12;
    frame(t); loopId=requestAnimationFrame(loop);
  }
  if(!reduce) loopId=requestAnimationFrame(loop);
})();
