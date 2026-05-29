// Customer QR App - POS-INDEPENDENT model
// ─────────────────────────────────────────────────────────────────────────
// Every "discount" is a real SKU at a real price the merchant pre-created
// in their POS. The customer sees face prices only. The cart total is
// just the sum of line items - no discount math, no −RM rows.
//
// Campaigns produce one of four operations:
//   add_line        → auto-adds a RM0/flat-price reward SKU to cart
//   reveal_category → reveals a campaign-controlled category of pre-priced twins
//   swap_sku        → replaces one SKU with a clearance/combo twin
//   suggest_line    → UX prompt to add an existing SKU at face price
// ─────────────────────────────────────────────────────────────────────────

const { useState, useEffect, useMemo } = React;
const E = window.MenuBaseEngine;

const CustomerApp = () => {
  const urlParams = (() => {
    try { return new URLSearchParams(window.location.search); }
    catch (e) { return new URLSearchParams(); }
  })();
  const demoMode = urlParams.has('demo');
  const hideDev = urlParams.get('hideDev') === '1' || demoMode;
  const compact = urlParams.get('compact') === '1' || demoMode;

  const [campaigns, setCampaigns] = useState(() => {
    if (demoMode) {
      const t = urlParams.get('demo');
      const demoSet = (window.DEMO_CAMPAIGNS && window.DEMO_CAMPAIGNS[t]) || [];
      return demoSet.length ? demoSet : (window.SAMPLE_CAMPAIGNS || []);
    }
    const saved = E.Store.read('campaigns', null);
    return (saved && saved.length > 0) ? saved : (window.SAMPLE_CAMPAIGNS || []);
  });
  useEffect(() => {
    if (demoMode) return;
    return E.Store.subscribe('campaigns', () => {
      const saved = E.Store.read('campaigns', null);
      if (saved && saved.length > 0) setCampaigns(saved);
    });
  }, []);

  const [cart, setCart] = useState(() => {
    let c = E.emptyCart();
    const items = urlParams.get('items');
    if (items && window.ITEM_BY_ID) {
      items.split(',').forEach(id => {
        const item = window.ITEM_BY_ID[id.trim()];
        if (item) c = E.addToCart(c, item, 'me');
      });
    }
    return c;
  });

  const [tableMode, setTableMode] = useState(() => {
    const m = urlParams.get('mode');
    if (m === 'table') return true;
    if (m === 'takeaway' || m === 'solo') return false;
    return urlParams.get('table') === '1';
  });
  const [screen, setScreen] = useState(() => {
    const s = urlParams.get('screen');
    return ['menu', 'cart', 'checkout', 'success'].includes(s) ? s : 'menu';
  });
  const [showSwitch, setShowSwitch] = useState(false);
  const [spinResult, setSpinResult] = useState(null);
  const [confetti, setConfetti] = useState(false);
  const [dismissedSwaps, setDismissedSwaps] = useState({});

  const [ctx, setCtx] = useState(() => ({
    ...E.DEFAULT_CONTEXT,
    hour: urlParams.get('hour') ? +urlParams.get('hour') : 15,
    dayOfWeek: urlParams.get('day') ? +urlParams.get('day') : 2,
    weather: urlParams.get('weather') || 'clear',
    inventory: {
      bc: urlParams.get('stock_bc') ? +urlParams.get('stock_bc') : 8,
      mt: 99,
    },
    customer: {
      id: 'cust_demo',
      isBirthday: urlParams.get('birthday') === '1',
      isFirstOrder: false,
      referralCode: urlParams.get('referral') === '1' ? 'AISHA50' : null,
    },
  }));

  const active = campaigns.filter(c => c.status === 'active');
  const resolution = E.resolve(active, cart, ctx);
  const mutations = resolution.menuMutations;

  // Auto-add reward lines (threshold reward, birthday reward, etc) and prune stale ones
  useEffect(() => {
    const eligibleCampaignIds = [
      resolution.applied?.campaign?.id,
      ...resolution.alternates.map(a => a.campaign.id),
    ].filter(Boolean);
    setCart(c => {
      const pruned = E.pruneStaleRewards(c, eligibleCampaignIds);
      return E.applyAutoAdds(pruned, mutations.autoAddLines);
    });
  }, [resolution.applied?.campaign?.id, mutations.autoAddLines.length]);

  // Cart total = pure sum of line items (face prices only - no discount math)
  const grandTotal = cart.subtotal;

  const addItem = (item) => setCart(c => E.addToCart(c, item, 'me'));
  const removeItem = (id) => setCart(c => E.removeFromCart(c, id, 'me'));

  const acceptSwap = (swap) => {
    setCart(c => {
      let next = { ...c, items: [...c.items] };
      // Remove the parts
      next.items = next.items.filter(i => !swap.hideSkuIds.includes(i.id));
      // Add the combo
      const combo = window.ITEM_BY_ID[swap.revealSkuId];
      if (combo) next.items.push({ ...combo, qty: 1, guestId: 'me' });
      return E.recomputeCart(next);
    });
  };

  const completeOrder = () => {
    setScreen('success');
    if (ctx.customer.isBirthday) setConfetti(true);
  };
  const newOrder = () => {
    setCart(E.emptyCart());
    setScreen('menu');
    setSpinResult(null);
    setConfetti(false);
  };

  return (
    <div className={`cust-app-root ${compact ? 'compact' : ''}`}>
      <div className="cust-phone">
        <div className="phone-notch"/>
        <div className="phone-screen">
          <CustStatus ctx={ctx}/>

          {screen === 'menu' && (
            <MenuScreen
              cart={cart} addItem={addItem} removeItem={removeItem}
              applied={resolution.applied} alternates={resolution.alternates}
              blocked={resolution.blocked} mutations={mutations}
              onCart={() => setScreen('cart')}
              tableMode={tableMode} campaigns={active}
            />
          )}
          {screen === 'cart' && (
            <CartScreen
              cart={cart} addItem={addItem} removeItem={removeItem}
              applied={resolution.applied} alternates={resolution.alternates}
              mutations={mutations} dismissedSwaps={dismissedSwaps}
              onAcceptSwap={acceptSwap} onDismissSwap={(id) => setDismissedSwaps(s => ({...s, [id]: true}))}
              grandTotal={grandTotal}
              onBack={() => setScreen('menu')} onCheckout={() => setScreen('checkout')}
              tableMode={tableMode}
            />
          )}
          {screen === 'checkout' && (
            <CheckoutScreen
              cart={cart} mutations={mutations} grandTotal={grandTotal}
              onBack={() => setScreen('cart')}
              onComplete={completeOrder}
              spinResult={spinResult} setSpinResult={setSpinResult}
              setCart={setCart}
              campaigns={active}
            />
          )}
          {screen === 'success' && (
            <SuccessScreen total={grandTotal} cart={cart} confetti={confetti} onNew={newOrder} tableMode={tableMode}/>
          )}
        </div>
      </div>

      {!hideDev && (
        <DevPanel ctx={ctx} setCtx={setCtx} tableMode={tableMode} setTableMode={setTableMode}
                  resolution={resolution} cart={cart}/>
      )}
    </div>
  );
};

// ─── STATUS BAR ────────────────────────────────────────────────────────
const CustStatus = ({ ctx }) => (
  <div className="cust-status">
    <span>{String(ctx.hour).padStart(2,'0')}:42</span>
    <span style={{display:'flex', gap:6}}><span>•••</span><span>📶</span><span>🔋</span></span>
  </div>
);

// ─── MENU SCREEN ───────────────────────────────────────────────────────
const MenuScreen = ({ cart, addItem, applied, alternates, blocked, mutations, onCart, tableMode, campaigns }) => {
  // Apply visibility mutations to derive what items the customer can browse
  const visible = E.visibleMenu(window.MENU_ITEMS, mutations);

  // Group by category for display
  const byCat = {};
  visible.forEach(it => {
    const catMeta = window.CAT_BY_ID?.[it.cat] || { id: it.cat, label: it.cat };
    if (!byCat[it.cat]) byCat[it.cat] = { meta: catMeta, items: [] };
    byCat[it.cat].items.push(it);
  });
  // Reveal campaign-controlled categories first (they're the hot ones)
  const orderedCats = Object.values(byCat).sort((a, b) => {
    const aRev = mutations.showCategories.includes(a.meta.id);
    const bRev = mutations.showCategories.includes(b.meta.id);
    if (aRev !== bRev) return aRev ? -1 : 1;
    return 0;
  });

  const thresholdProgress = blocked.find(b => b.campaign.type === 'threshold' && b.progress);

  return (
    <>
      <div className="cust-head">
        <div>
          <strong>Biji Coffee Co.</strong>
          {tableMode && <span className="cust-table">👥 Table T-04 · 4 guests</span>}
          {!tableMode && <span className="cust-table">Takeaway · self-order</span>}
        </div>
      </div>

      {/* HERO BANNER - winning campaign */}
      {applied && <HeroBanner applied={applied}/>}
      {!applied && thresholdProgress && <ProgressBanner block={thresholdProgress}/>}
      {alternates.length > 0 && applied && (
        <div className="alt-hint">
          + {alternates.length} other reward{alternates.length > 1 ? 's' : ''} stacking on this cart
        </div>
      )}

      <div className="cust-menu-scroll">
      {orderedCats.map(({ meta, items }) => {
        const isRevealed = mutations.showCategories.includes(meta.id);
        return (
          <div key={meta.id}>
            <div className="cust-section-title" style={isRevealed ? {color:'var(--lime-deep)', display:'flex', alignItems:'center', gap:6} : {}}>
              {meta.label}
              {isRevealed && <span style={{fontSize:10, fontWeight:700, padding:'2px 6px', background:'var(--lime)', color:'var(--ink)', borderRadius:4, letterSpacing:'.05em'}}>LIVE NOW</span>}
            </div>
            <div className="cust-menu">
              {items.map(it => {
                const inCart = cart.items.find(i => i.id === it.id);
                return (
                  <div key={it.id} className="cust-item-row">
                    <div className="cust-item-emoji">{it.emoji}</div>
                    <div className="cust-item-info">
                      <strong>{it.name}</strong>
                      <span className="cust-item-cat">{it.cat}</span>
                      <div className="cust-item-price">
                        <strong>RM{it.price.toFixed(2)}</strong>
                        {it.twinOf && (() => {
                          const orig = window.ITEM_BY_ID[it.twinOf];
                          if (orig && orig.price > it.price) {
                            return <s style={{color:'var(--ink-3)', fontWeight:400, marginLeft:6}}>RM{orig.price.toFixed(2)}</s>;
                          }
                          return null;
                        })()}
                      </div>
                    </div>
                    <button className="add-btn" onClick={() => addItem(it)}>
                      {inCart ? `×${inCart.qty}` : '+'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      </div>

      {cart.items.length > 0 && (
        <button className="cust-cart-bar" onClick={onCart}>
          <span><strong>{cart.items.reduce((s,i)=>s+i.qty, 0)} items</strong> · RM{cart.subtotal.toFixed(2)}</span>
          <span>View cart →</span>
        </button>
      )}
    </>
  );
};

const HeroBanner = ({ applied }) => {
  const t = window.TYPE_BY_ID[applied.campaign.type];
  return (
    <div className={`cust-hero ${t.id}`}>
      <div className="cust-hero-eyebrow">{t.icon} {t.name.toUpperCase()}</div>
      <strong>{applied.ui?.headline || applied.campaign.name}</strong>
      {applied.ui?.subline && <div className="cust-hero-sub">{applied.ui.subline}</div>}
    </div>
  );
};

const ProgressBanner = ({ block }) => {
  const pct = Math.min(100, (block.progress || 0) * 100);
  return (
    <div className="cust-progress-banner">
      <div className="row" style={{justifyContent:'space-between', marginBottom:6}}>
        <strong>{block.campaign.name}</strong>
        <span className="muted" style={{fontSize:12}}>{block.reason}</span>
      </div>
      <div className="cust-progress"><div style={{width: `${pct}%`}}/></div>
    </div>
  );
};

// ─── CART SCREEN ───────────────────────────────────────────────────────
const CartScreen = ({ cart, addItem, removeItem, applied, alternates, mutations, dismissedSwaps, onAcceptSwap, onDismissSwap, grandTotal, onBack, onCheckout, tableMode }) => {
  // Active swap suggestions (e.g. bundle combo)
  const activeSwaps = mutations.suggestions.filter(s => s.kind === 'swap' && !dismissedSwaps[s.campaignId]);

  return (
    <>
      <div className="cust-head">
        <button className="back-btn" onClick={onBack}>←</button>
        <div><strong>Your cart</strong>{tableMode && <span className="cust-table">Table T-04</span>}</div>
      </div>
      <div className="cust-cart-list">
        {cart.items.length === 0 && <div className="muted" style={{padding:'40px 20px', textAlign:'center'}}>Cart is empty</div>}
        {cart.items.map((i, k) => (
          <div key={k} className={`cart-line ${i._isReward ? 'is-reward' : ''}`}>
            <div>
              <strong>{i.name}</strong>
              {i._isReward && <span className="reward-flag">REWARD · added free</span>}
              {tableMode && i.guestId !== 'me' && !i._isReward && <span className="cust-table">From: {i.guestId}</span>}
            </div>
            {!i._isReward ? (
              <div className="qty-control">
                <button onClick={() => removeItem(i.id)}>−</button>
                <span>{i.qty}</span>
                <button onClick={() => addItem(i)}>+</button>
              </div>
            ) : (
              <span className="muted" style={{fontSize:12}}>×{i.qty}</span>
            )}
            <strong className={i.price === 0 ? 'lime' : ''}>RM{(i.price * i.qty).toFixed(2)}</strong>
          </div>
        ))}

        {/* Bundle / swap suggestions */}
        {activeSwaps.map(swap => {
          const reveal = window.ITEM_BY_ID[swap.revealSkuId];
          const partsTotal = swap.hideSkuIds.reduce((s, id) => s + (window.ITEM_BY_ID[id]?.price || 0), 0);
          const savings = Math.max(0, partsTotal - (reveal?.price || 0));
          return (
            <div key={swap.campaignId} className="swap-suggest">
              <div>
                <strong>{swap.ui?.headline || 'Save with the combo'}</strong>
                <span className="muted" style={{fontSize:12, display:'block', marginTop:2}}>
                  Replace {swap.hideSkuIds.length} items · pay RM{(reveal?.price || 0).toFixed(2)} (save RM{savings.toFixed(2)})
                </span>
              </div>
              <div style={{display:'flex', gap:8}}>
                <button className="swap-skip" onClick={() => onDismissSwap(swap.campaignId)}>No</button>
                <button className="swap-accept" onClick={() => { onAcceptSwap(swap); onDismissSwap(swap.campaignId); }}>Swap</button>
              </div>
            </div>
          );
        })}

        <div className="cart-totals">
          <div className="row" style={{justifyContent:'space-between'}}>
            <span className="muted">Subtotal</span><span>RM{cart.subtotal.toFixed(2)}</span>
          </div>
          <div className="row total" style={{justifyContent:'space-between'}}>
            <strong>Total</strong><strong>RM{grandTotal.toFixed(2)}</strong>
          </div>
          <div className="pos-note">
            All prices are real menu items. The waiter rings them 1-to-1 into the POS.
          </div>
        </div>
      </div>
      {cart.items.length > 0 && (
        <button className="checkout-btn" onClick={onCheckout}>Checkout · RM{grandTotal.toFixed(2)} →</button>
      )}
    </>
  );
};

// ─── CHECKOUT SCREEN ───────────────────────────────────────────────────
const CheckoutScreen = ({ cart, mutations, grandTotal, onBack, onComplete, spinResult, setSpinResult, setCart, campaigns }) => {
  const spinCampaign = campaigns.find(c => c.type === 'spin_wheel' && c.status === 'active');
  const upsellSuggestions = mutations.suggestions.filter(s => s.kind === 'add');

  const onSpinResult = (slotSkuId) => {
    setSpinResult(slotSkuId);
    // Add the won RM0 SKU as an auto-add line
    const sku = window.ITEM_BY_ID[slotSkuId];
    if (sku) {
      setCart(c => E.recomputeCart({
        ...c,
        items: [...c.items, { ...sku, qty: 1, guestId: 'me', _campaignId: spinCampaign.id, _isReward: true }],
      }));
    }
  };

  const acceptUpsell = (sug) => {
    const sku = window.ITEM_BY_ID[sug.skuId];
    if (sku) setCart(c => E.addToCart(c, sku, 'me'));
  };

  return (
    <>
      <div className="cust-head">
        <button className="back-btn" onClick={onBack}>←</button>
        <div><strong>Checkout</strong></div>
      </div>
      <div className="cust-cart-list" style={{flex:1}}>
        {/* Smart upsell prompts (face price, no SKU mutation) */}
        {upsellSuggestions.map(sug => {
          const sku = window.ITEM_BY_ID[sug.skuId];
          if (!sku) return null;
          return (
            <div key={sug.campaignId} className="addon-card upsell">
              <h4>{sug.ui?.headline}</h4>
              <p>{sug.ui?.subline}</p>
              {sug.ui?.socialProof && <span className="social-proof">{sug.ui.socialProof}</span>}
              <button className="reveal-btn" onClick={() => acceptUpsell(sug)}>+ Add {sku.name} · RM{sku.price.toFixed(2)}</button>
            </div>
          );
        })}

        {/* Spin wheel addon */}
        {spinCampaign && !spinResult && (
          <div className="addon-card spin">
            <h4>🎰 {spinCampaign.name}</h4>
            <p>Spin once for a free item - slot lands on a real RM0 SKU added to your cart.</p>
            <SpinWheel slotSkuIds={spinCampaign.config?.slotSkuIds || ['r-ac', 'r-wc', 'r-bc']} onResult={onSpinResult}/>
          </div>
        )}
        {spinResult && (
          <div className="addon-card spin won">
            <h4>🎰 You won!</h4>
            <strong>{window.ITEM_BY_ID[spinResult]?.name || 'Reward'} · added at RM0</strong>
          </div>
        )}

        {/* Order summary - face prices only */}
        <div className="checkout-summary">
          <h4>Order summary</h4>
          {cart.items.map((i, k) => (
            <div key={k} className="row" style={{justifyContent:'space-between', fontSize:13.5, padding:'4px 0', color: i.price === 0 ? 'var(--lime-deep)' : 'inherit'}}>
              <span>{i.qty}× {i.name}{i._isReward ? ' (free)' : ''}</span>
              <span>RM{(i.price * i.qty).toFixed(2)}</span>
            </div>
          ))}
          <div className="row total" style={{justifyContent:'space-between', marginTop:8}}>
            <strong>Total</strong>
            <strong>RM{cart.subtotal.toFixed(2)}</strong>
          </div>
        </div>

        <div className="checkout-pay">
          <h4>Pay with</h4>
          <div className="pay-grid">
            <button className="pay-btn on">💳 Card</button>
            <button className="pay-btn">📱 GrabPay</button>
            <button className="pay-btn">💰 TnG</button>
          </div>
        </div>
      </div>
      <button className="checkout-btn" onClick={onComplete}>Place order · RM{cart.subtotal.toFixed(2)}</button>
    </>
  );
};

// ─── SPIN WHEEL ────────────────────────────────────────────────────────
const SpinWheel = ({ slotSkuIds, onResult }) => {
  const [spinning, setSpinning] = useState(false);
  const [angle, setAngle] = useState(0);

  const slots = slotSkuIds.map(id => window.ITEM_BY_ID[id]).filter(Boolean);
  if (slots.length === 0) return null;

  const spin = () => {
    if (spinning) return;
    setSpinning(true);
    const idx = Math.floor(Math.random() * slots.length);
    const slice = 360 / slots.length;
    const target = 360 * 5 + (360 - (idx * slice) - slice/2);
    setAngle(target);
    setTimeout(() => onResult(slots[idx].id), 3200);
  };

  const sliceDeg = 360 / slots.length;
  // Brand-aligned slice colors: lime / ink / lime-deep / brand-grey, alternating
  const palette = ['#BCF125', '#1A1A1A', '#A6D413', '#64656A'];
  // Conic gradient produces clean pie slices. Start at -sliceDeg/2 so the first
  // slice is centered at the top (0deg), pointing at the pointer.
  const gradient = slots.map((s, i) => {
    const start = i * sliceDeg;
    const end   = start + sliceDeg;
    return `${palette[i % palette.length]} ${start}deg ${end}deg`;
  }).join(', ');
  const wheelStyle = {
    transform: `rotate(${angle}deg)`,
    transition: spinning ? 'transform 3s cubic-bezier(0.2, 0.7, 0.2, 1)' : 'none',
    background: `conic-gradient(from -${sliceDeg/2}deg, ${gradient})`,
  };

  return (
    <div className="spin-wrap">
      <div className="spin-pointer">▼</div>
      <div className="spin-wheel" style={wheelStyle}>
        {slots.map((s, i) => {
          // Place label at midpoint of slice. Counter-rotate inner text to stay upright.
          const midAngle = i * sliceDeg;
          const textColor = i % 2 ? '#FFFFFF' : '#1A1A1A';
          return (
            <div key={i} className="spin-label" style={{transform: `rotate(${midAngle}deg)`}}>
              <span className="lbl" style={{
                transform: `translateX(-50%) rotate(${-midAngle}deg)`,
                color: textColor
              }}>
                {s.emoji} {s.name.replace('Promo ','')}
              </span>
            </div>
          );
        })}
      </div>
      <button className="spin-btn" onClick={spin} disabled={spinning}>{spinning ? 'Spinning…' : 'Spin'}</button>
    </div>
  );
};

// ─── SUCCESS SCREEN ────────────────────────────────────────────────────
const SuccessScreen = ({ total, cart, confetti, onNew, tableMode }) => (
  <div className="success-screen">
    {confetti && <Confetti/>}
    <div className="success-check">✓</div>
    <h2>Order placed!</h2>
    <p>Sent to the <strong>waiter's tablet</strong> at {tableMode ? 'Table T-04' : 'Counter'}</p>
    <p className="muted" style={{fontSize:13}}>Pickup ready in ~8 min · pay at counter</p>

    {/* Waiter ticket - exact list of SKUs the waiter will key into the POS */}
    <div className="waiter-ticket">
      <div className="wt-head">
        <span className="wt-tag">WAITER TABLET · KOT</span>
        <span className="wt-num">#{Math.floor(Math.random()*900)+100}</span>
      </div>
      <div className="wt-table">{tableMode ? 'Table T-04 · 4 guests' : 'Counter · takeaway'}</div>
      <div className="wt-list">
        {cart.items.map((i, k) => (
          <div key={k} className="wt-row">
            <span className="wt-qty">{i.qty}×</span>
            <span className="wt-name">{i.name}</span>
            <span className="wt-price">RM{(i.price * i.qty).toFixed(2)}</span>
          </div>
        ))}
      </div>
      <div className="wt-total">
        <span>Total to key into POS</span>
        <strong>RM{total.toFixed(2)}</strong>
      </div>
      <div className="wt-note">
        Every line is a real SKU at face price. Waiter rings 1-to-1 - no manager codes, no discount math.
      </div>
    </div>

    <button className="checkout-btn" style={{marginTop:16}} onClick={onNew}>New order</button>
  </div>
);

const Confetti = () => (
  <div className="confetti">
    {Array.from({length:30}).map((_, i) => (
      <span key={i} style={{
        left: `${Math.random() * 100}%`,
        animationDelay: `${Math.random() * 0.5}s`,
        background: ['var(--lime)','var(--plum)','#ffb800','#ff5e5b'][i % 4],
      }}/>
    ))}
  </div>
);

// ─── DEV PANEL ─────────────────────────────────────────────────────────
const DevPanel = ({ ctx, setCtx, tableMode, setTableMode, resolution, cart }) => {
  const [open, setOpen] = useState(true);
  return (
    <div className={`dev-overlay ${open ? 'open' : ''}`}>
      <button className="dev-toggle" onClick={() => setOpen(!open)}>
        {open ? '✕' : '⚙️'} {open ? 'Hide demo controls' : ''}
      </button>
      {open && (
        <>
          <div className="dev-overlay-head">
            <strong>Demo controls</strong>
            <p>Adjust to trigger different campaigns</p>
          </div>
          <div className="dev-section">
            <div className="dev-label">Hour</div>
            <input type="range" min="6" max="23" value={ctx.hour} onChange={e => setCtx({...ctx, hour: +e.target.value})}/>
            <div className="dev-readout">{String(ctx.hour).padStart(2,'0')}:00</div>
          </div>
          <div className="dev-section">
            <div className="dev-label">Day</div>
            <div className="day-pills">
              {['M','T','W','T','F','S','S'].map((d, i) => (
                <button key={i} className={`day-pill ${ctx.dayOfWeek === i ? 'on' : ''}`} onClick={() => setCtx({...ctx, dayOfWeek: i})}>{d}</button>
              ))}
            </div>
          </div>
          <div className="dev-section">
            <div className="dev-label">Weather</div>
            <div className="dev-radio">
              {['clear','rain','hot'].map(w => (
                <button key={w} className={`dev-chip ${ctx.weather === w ? 'on' : ''}`} onClick={() => setCtx({...ctx, weather: w})}>
                  {w === 'clear' ? '☀️' : w === 'rain' ? '🌧️' : '🔥'} {w}
                </button>
              ))}
            </div>
          </div>
          <div className="dev-section">
            <div className="dev-label">Cheesecake stock</div>
            <input type="range" min="0" max="50" value={ctx.inventory.bc} onChange={e => setCtx({...ctx, inventory: {...ctx.inventory, bc: +e.target.value}})}/>
            <div className="dev-readout">{ctx.inventory.bc} left</div>
          </div>
          <div className="dev-section">
            <div className="dev-label">Customer</div>
            <button className={`dev-chip ${ctx.customer.isBirthday ? 'on' : ''}`} onClick={() => setCtx({...ctx, customer: {...ctx.customer, isBirthday: !ctx.customer.isBirthday}})}>🎂 Birthday</button>
            <button className={`dev-chip ${ctx.customer.referralCode ? 'on' : ''}`} onClick={() => setCtx({...ctx, customer: {...ctx.customer, referralCode: ctx.customer.referralCode ? null : 'AISHA50'}})}>🎟️ Referred</button>
          </div>
          <div className="dev-section">
            <button className={`dev-chip ${tableMode ? 'on' : ''}`} onClick={() => setTableMode(!tableMode)}>👥 Joint table cart</button>
          </div>
          <div className="dev-section dev-engine">
            <div className="dev-label">Engine output</div>
            <div className="engine-mini">
              <strong>{resolution.applied?.campaign?.name || '- no campaign active -'}</strong>
              {resolution.applied && (
                <>
                  <span className="lime" style={{fontSize:11, fontFamily:'var(--mono)', marginTop:4, display:'block'}}>
                    op: {resolution.applied.op}
                  </span>
                  <span className="muted" style={{fontSize:11, marginTop:2, display:'block'}}>
                    est. value: RM{(resolution.applied.value || 0).toFixed(2)}
                  </span>
                </>
              )}
              <div className="muted" style={{fontSize:11, marginTop:4}}>
                {resolution.alternates.length} stacking · {resolution.blocked.length} blocked
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('cust-root'));
root.render(<CustomerApp/>);
