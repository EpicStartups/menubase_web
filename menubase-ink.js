(function(){
  const TARGET=(document.currentScript&&document.currentScript.dataset.target)||'#demo';
  function init(){
    const host=document.querySelector(TARGET);
    if(!host) return;
    if(getComputedStyle(host).position==='static') host.style.position='relative';
    const cv=document.createElement('canvas');
    cv.setAttribute('aria-hidden','true');
    Object.assign(cv.style,{position:'absolute',inset:'0',width:'100%',height:'100%',zIndex:'0',pointerEvents:'none'});
    host.prepend(cv);
    // lift the section's real content above the canvas
    [...host.children].forEach(c=>{ if(c!==cv){ const cs=getComputedStyle(c); if(cs.position==='static') c.style.position='relative'; if(cs.zIndex==='auto') c.style.zIndex='1'; }});
    const ctx=cv.getContext('2d');
    const LIME=[188,241,37], WHITE=[255,255,255];
    const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
    let W=0,H=0,DPR=1,running=true,loopId;
    const m={x:-1,y:-1,inside:false};
    const rgba=(c,a)=>`rgba(${c[0]|0},${c[1]|0},${c[2]|0},${a})`;
    const mix=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];
    function resize(){ DPR=Math.min(devicePixelRatio||1,2); const r=host.getBoundingClientRect(); W=r.width; H=r.height; cv.width=Math.max(1,W*DPR); cv.height=Math.max(1,H*DPR); ctx.setTransform(DPR,0,0,DPR,0,0); if(reduce) frame(0); }
    function frame(t){
      ctx.clearRect(0,0,W,H);                     // keep the section's own dark bg underneath
      const gap=30, t2=t*0.001;
      const mx=m.inside?m.x:(0.66+0.16*Math.sin(t*0.0004))*W;   // idle/roam when cursor is elsewhere
      const my=m.inside?m.y:(0.50+0.18*Math.cos(t*0.00033))*H;
      const gl=ctx.createRadialGradient(mx,my,0,mx,my,420);
      gl.addColorStop(0,rgba(LIME,0.10)); gl.addColorStop(1,rgba(LIME,0));
      ctx.fillStyle=gl; ctx.fillRect(0,0,W,H);
      for(let y=gap/2;y<H+gap;y+=gap){
        for(let x=gap/2;x<W+gap;x+=gap){
          const dx=x-mx,dy=y-my,lit=Math.exp(-Math.hypot(dx,dy)/230);
          if(lit>0.02){ const col=mix(WHITE,LIME,Math.min(1,lit*1.3)), s=1.4+lit*4.5;
            ctx.fillStyle=rgba(col,Math.min(0.95,0.12+lit*0.85)); ctx.fillRect(x-s/2,y-s/2,s,s); }
          else { const amb=0.05+(Math.sin(x*0.01+y*0.01-t2*2)*0.5+0.5)*0.045;
            ctx.fillStyle=rgba(WHITE,amb); ctx.fillRect(x-0.9,y-0.9,1.8,1.8); }
        }
      }
    }
    host.addEventListener('pointermove',e=>{ const r=host.getBoundingClientRect(); m.x=e.clientX-r.left; m.y=e.clientY-r.top; m.inside=true; });
    host.addEventListener('pointerleave',()=>{ m.inside=false; });
    addEventListener('resize',resize);
    if(window.ResizeObserver) new ResizeObserver(resize).observe(host);
    document.addEventListener('visibilitychange',()=>{ running=!document.hidden; if(running&&!reduce){ loopId=requestAnimationFrame(loop); } });
    resize();
    function loop(t){ if(!running) return; frame(t); loopId=requestAnimationFrame(loop); }
    if(!reduce) loopId=requestAnimationFrame(loop);
  }
  if(document.readyState!=='loading') init(); else document.addEventListener('DOMContentLoaded',init);
})();
