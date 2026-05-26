// MenuBase Campaign Engine — POS-INDEPENDENT MODEL
// ─────────────────────────────────────────────────────────────────────────
// FOUNDATIONAL CONSTRAINT (read first):
//
// MenuBase has NO POS integration. Orders flow customer → tablet → waiter
// → manually keyed into the POS the merchant already owns. This means:
//
//   "MenuBase NEVER invents a price the POS doesn't already know about."
//
// Every campaign reduces to ONE of FOUR POS-safe operations:
//
//   1. ADD_LINE        — auto-add a pre-made RM0/flat-price SKU to cart
//                        (threshold reward, spin win, mystery box, birthday)
//   2. REVEAL_CATEGORY — show/hide a campaign-controlled category of
//                        pre-discounted twin SKUs (happy hour, flash, weather, off-peak)
//   3. SWAP_SKU        — hide regular SKU, reveal a clearance/combo twin
//                        (inventory clearance, bundle suggestion)
//   4. SUGGEST_LINE    — UX prompt to add an existing SKU at face price
//                        (smart upsell — already POS-safe)
//
// The engine NEVER produces percent-off or fixed-RM-off math. Discounts
// live in the SKU prices the merchant pre-created, not in engine arithmetic.
// ─────────────────────────────────────────────────────────────────────────

const STORE_KEYS = {
  campaigns:    'menubase:campaigns',
  cart:         'menubase:cart',
  table:        'menubase:table',
  ctx:          'menubase:context',
  claims:       'menubase:claims',
};

// ─── STORAGE ────────────────────────────────────────────────────────────
const Store = {
  read(key, fallback) {
    try {
      const raw = localStorage.getItem(STORE_KEYS[key]);
      return raw ? JSON.parse(raw) : fallback;
    } catch { return fallback; }
  },
  write(key, value) {
    try {
      localStorage.setItem(STORE_KEYS[key], JSON.stringify(value));
      window.dispatchEvent(new CustomEvent('menubase:store', { detail: { key } }));
    } catch {}
  },
  subscribe(key, fn) {
    const handler = (e) => {
      if (e.type === 'storage' && e.key === STORE_KEYS[key]) fn();
      else if (e.type === 'menubase:store' && e.detail?.key === key) fn();
    };
    window.addEventListener('storage', handler);
    window.addEventListener('menubase:store', handler);
    return () => {
      window.removeEventListener('storage', handler);
      window.removeEventListener('menubase:store', handler);
    };
  },
};

// ─── DEFAULT CONTEXT ────────────────────────────────────────────────────
const DEFAULT_CONTEXT = {
  now:        new Date().toISOString(),
  dayOfWeek:  new Date().getDay() === 0 ? 6 : new Date().getDay() - 1,
  hour:       new Date().getHours(),
  weather:    'clear',
  inventory:  {},
  customer: {
    id:        'cust_demo',
    isBirthday: false,
    isFirstOrder: false,
    referralCode: null,
  },
};

// ─── HELPERS ────────────────────────────────────────────────────────────
const item = (id) => window.ITEM_BY_ID?.[id];

// Estimated savings = used ONLY for ranking + headline copy. Never for arithmetic.
function estimateSavings(op, payload) {
  if (!op) return 0;
  switch (op) {
    case 'add_line': {
      // Free item = its full menu-equivalent price the customer would have paid.
      // Mystery box at RM5 = no "savings" in cart math sense.
      const sku = item(payload.skuId);
      if (!sku) return 0;
      // If this is a reward twin (e.g. r-ac), find its non-reward equivalent.
      const twin = payload.equivalentSkuId ? item(payload.equivalentSkuId) : null;
      if (twin && sku.price === 0) return twin.price;
      return 0;
    }
    case 'reveal_category': {
      // Sum (regular price - twin price) across visible items in the category.
      const cat = payload.categoryId;
      const twins = (window.MENU_ITEMS || []).filter(i => i.cat === cat && i.twinOf);
      return twins.reduce((s, t) => {
        const original = item(t.twinOf);
        return s + (original ? Math.max(0, original.price - t.price) : 0);
      }, 0);
    }
    case 'swap_sku': {
      const hide = item(payload.hideSkuId);
      const reveal = item(payload.revealSkuId);
      if (!hide || !reveal) return 0;
      return Math.max(0, hide.price - reveal.price);
    }
    case 'suggest_line':
      return 0; // pure UX
    default:
      return 0;
  }
}

// ─── ELIGIBILITY ────────────────────────────────────────────────────────
// Every evaluator returns:
//   {
//     eligible:  bool,
//     reason:    string,
//     op:        'add_line' | 'reveal_category' | 'swap_sku' | 'suggest_line',
//     payload:   { ... typed by op ... },
//     ui:        { headline, subline?, accent?, label? },
//     value:     number,    // estimated savings (RM), used for ranking only
//     progress?: number,    // 0..1, for threshold-style progress bars
//   }
// ─────────────────────────────────────────────────────────────────────────
function evaluate(campaign, cart, ctx) {
  if (campaign.status !== 'active') return { eligible: false, value: 0, reason: 'not active' };
  if (!withinSchedule(campaign, ctx)) return { eligible: false, value: 0, reason: 'outside schedule' };

  switch (campaign.type) {
    case 'threshold':    return evalThreshold(campaign, cart);
    case 'happy_hour':   return evalHappyHour(campaign, cart, ctx);
    case 'bundle':       return evalBundle(campaign, cart);
    case 'weather':      return evalWeather(campaign, cart, ctx);
    case 'inventory':    return evalInventory(campaign, cart, ctx);
    case 'birthday':     return evalBirthday(campaign, cart, ctx);
    case 'offpeak':      return evalOffpeak(campaign, cart, ctx);
    case 'flash':        return evalFlash(campaign, cart);
    case 'mystery':      return evalMystery(campaign, cart);
    case 'spin_wheel':   return evalSpin(campaign, cart);
    case 'referral':     return evalReferral(campaign, cart, ctx);
    case 'upsell_popup': return evalUpsell(campaign, cart);
    default:             return { eligible: false, value: 0, reason: 'unknown type' };
  }
}

function withinSchedule(c, ctx) {
  const days = c.activeDays || [1,1,1,1,1,1,1];
  if (!days[ctx.dayOfWeek]) return false;
  if (c.allDay) return true;
  if (c.startTime === 'auto') return true;
  const [sh] = (c.startTime || '00:00').split(':').map(Number);
  const [eh] = (c.endTime || '23:59').split(':').map(Number);
  return ctx.hour >= sh && ctx.hour < eh;
}

// ── 1. THRESHOLD → ADD_LINE ────────────────────────────────────────────
function evalThreshold(c, cart) {
  const min = c.config?.thresholdAmount || 50;
  if (cart.subtotal < min) {
    return {
      eligible: false, value: 0,
      reason: `RM${(min - cart.subtotal).toFixed(2)} away`,
      progress: cart.subtotal / min,
    };
  }
  // Look up the reward SKU (a real RM0 SKU pre-created in POS)
  const rewardSku = c.config?.rewardSkuId || `r-${c.config?.rewardItemId}` || 'r-ac';
  const sku = item(rewardSku);
  const equivalent = sku?.twinOf || c.config?.rewardItemId;
  const value = estimateSavings('add_line', { skuId: rewardSku, equivalentSkuId: equivalent });
  return {
    eligible: true,
    op: 'add_line',
    payload: { skuId: rewardSku, equivalentSkuId: equivalent, displayPrice: sku?.price ?? 0 },
    ui: { headline: c.config?.message || `FREE ${sku?.name || 'reward'}`, accent: 'lime' },
    value,
    reason: `Cart ≥ RM${min}`,
  };
}

// ── 2. HAPPY HOUR → REVEAL_CATEGORY ────────────────────────────────────
function evalHappyHour(c, cart, ctx) {
  // Reveals a campaign_controlled category. The category's twin SKUs are
  // pre-priced in the merchant's POS — engine just toggles visibility.
  const categoryId = c.config?.categoryId || 'Happy Hour';
  const value = estimateSavings('reveal_category', { categoryId });
  return {
    eligible: true,
    op: 'reveal_category',
    payload: { categoryId, visibleUntil: c.endTime || '17:00' },
    ui: { headline: 'Happy Hour active', subline: `Ends at ${c.endTime || '17:00'}`, accent: 'lime' },
    value,
    reason: 'Inside happy hour window',
  };
}

// ── 3. BUNDLE → SWAP_SKU (suggest combo) ──────────────────────────────
function evalBundle(c, cart) {
  const cfg = c.config || {};
  // Find one item in each defined group in the cart
  const a = cart.items.find(i => item(i.id)?.cat === cfg.groupA);
  const b = cart.items.find(i => item(i.id)?.cat === cfg.groupB);
  if (!a || !b) return { eligible: false, value: 0, reason: `needs ${cfg.groupA} + ${cfg.groupB}` };

  // The combo SKU the merchant pre-created
  const comboSku = cfg.comboSkuId || 'cb-cp';
  const combo = item(comboSku);
  if (!combo) return { eligible: false, value: 0, reason: 'combo SKU missing' };

  const partsTotal = (item(a.id)?.price || 0) + (item(b.id)?.price || 0);
  const savings = Math.max(0, partsTotal - combo.price);
  return {
    eligible: true,
    op: 'swap_sku',
    payload: {
      hideSkuIds: [a.id, b.id],   // remove these two lines from cart on accept
      revealSkuId: comboSku,      // add this one combo line
      mode: 'suggest',            // doesn't auto-apply; customer must accept
    },
    ui: { headline: `Save RM${savings.toFixed(2)} with the combo`, subline: combo.name, accent: 'plum' },
    value: savings,
    reason: 'cart has bundle parts',
  };
}

// ── 4. WEATHER → REVEAL_CATEGORY ───────────────────────────────────────
function evalWeather(c, cart, ctx) {
  const cfg = c.config || {};
  const trigger = cfg.condition || 'rain';
  if (ctx.weather !== trigger) return { eligible: false, value: 0, reason: `needs ${trigger}` };
  const categoryId = cfg.categoryId || 'Rainy Day';
  const value = estimateSavings('reveal_category', { categoryId });
  const labels = { rain: 'Rainy day menu unlocked ☔', hot: 'Hot day specials ☀️', cold: 'Cold day comforts ❄️' };
  return {
    eligible: true,
    op: 'reveal_category',
    payload: { categoryId, visibleUntil: 'while_weather_holds' },
    ui: { headline: labels[trigger] || 'Weather menu active', accent: 'plum' },
    value,
    reason: `${trigger} detected`,
  };
}

// ── 5. INVENTORY → SWAP_SKU ────────────────────────────────────────────
function evalInventory(c, cart, ctx) {
  const cfg = c.config || {};
  const stock = ctx.inventory[cfg.itemId] ?? 99;
  if (stock >= cfg.threshold) return { eligible: false, value: 0, reason: `stock ok (${stock})` };

  // Find the pre-created clearance twin
  const clearanceSku = cfg.clearanceSkuId || `lc-${cfg.itemId}`;
  const reveal = item(clearanceSku);
  if (!reveal) return { eligible: false, value: 0, reason: 'clearance SKU missing' };

  const value = estimateSavings('swap_sku', { hideSkuId: cfg.itemId, revealSkuId: clearanceSku });
  return {
    eligible: true,
    op: 'swap_sku',
    payload: {
      hideSkuIds: [cfg.itemId],   // hide regular cheesecake
      revealSkuId: clearanceSku,  // show last-chance cheesecake
      mode: 'auto',               // applied automatically
    },
    ui: { headline: `Last ${stock} · ${reveal.name}`, subline: `RM${reveal.price.toFixed(2)}`, accent: 'plum' },
    value,
    reason: `stock ${stock} < ${cfg.threshold}`,
  };
}

// ── 6. BIRTHDAY → ADD_LINE ─────────────────────────────────────────────
function evalBirthday(c, cart, ctx) {
  if (!ctx.customer.isBirthday) return { eligible: false, value: 0, reason: 'not your birthday' };
  if (cart.subtotal < (c.config?.minSpend || 25)) {
    return { eligible: false, value: 0, reason: `RM${c.config?.minSpend || 25} min spend` };
  }
  const rewardSku = c.config?.rewardSkuId || 'r-bc';
  const sku = item(rewardSku);
  return {
    eligible: true,
    op: 'add_line',
    payload: { skuId: rewardSku, equivalentSkuId: sku?.twinOf || 'bc', displayPrice: 0 },
    ui: { headline: '🎂 Happy birthday — free cheesecake', accent: 'lime' },
    value: estimateSavings('add_line', { skuId: rewardSku, equivalentSkuId: sku?.twinOf }),
    reason: 'birthday match',
  };
}

// ── 7. OFF-PEAK → REVEAL_CATEGORY ──────────────────────────────────────
function evalOffpeak(c, cart, ctx) {
  // Schedule already vetted by withinSchedule. Just reveal the category.
  const categoryId = c.config?.categoryId || 'Off-Peak';
  return {
    eligible: true,
    op: 'reveal_category',
    payload: { categoryId, visibleUntil: c.endTime },
    ui: { headline: 'Off-peak menu active', subline: `Ends at ${c.endTime || '16:00'}`, accent: 'plum' },
    value: estimateSavings('reveal_category', { categoryId }),
    reason: 'inside off-peak window',
  };
}

// ── 8. FLASH → REVEAL_CATEGORY ─────────────────────────────────────────
function evalFlash(c, cart) {
  const cfg = c.config || {};
  // Flash is time-bound separately — check endsAt
  if (cfg.endsAt && Date.now() > cfg.endsAt) return { eligible: false, value: 0, reason: 'flash ended' };
  const categoryId = cfg.categoryId || 'Flash';
  return {
    eligible: true,
    op: 'reveal_category',
    payload: { categoryId, visibleUntil: cfg.endsAt },
    ui: { headline: 'Flash deal · ends soon', accent: 'lime' },
    value: estimateSavings('reveal_category', { categoryId }),
    reason: 'inside flash window',
  };
}

// ── 9. MYSTERY → ADD_LINE (flat-price SKU at RM5) ──────────────────────
function evalMystery(c, cart) {
  if (cart.subtotal === 0) return { eligible: false, value: 0, reason: 'empty cart' };
  const skuId = c.config?.skuId || 'r-mb';
  const sku = item(skuId);
  return {
    eligible: true,
    op: 'add_line',
    payload: { skuId, displayPrice: sku?.price || 5, mode: 'opt_in' },
    ui: { headline: `Add mystery box · RM${(sku?.price || 5).toFixed(2)}`, accent: 'plum' },
    value: 0, // not a saving; opt-in upside
    reason: 'mystery available',
  };
}

// ── 10. SPIN → ADD_LINE (winning slot maps to RM0 SKU) ─────────────────
function evalSpin(c, cart) {
  if (cart.subtotal === 0) return { eligible: false, value: 0, reason: 'empty cart' };
  // Spin slots are all RM0 SKUs the merchant pre-created.
  // Engine just declares the campaign eligible at checkout.
  // The actual slot picked happens client-side at spin-time and emits add_line.
  return {
    eligible: true,
    op: 'add_line',
    payload: {
      skuId: null,                 // determined at spin time
      mode: 'spin_at_checkout',
      slotSkuIds: c.config?.slotSkuIds || ['r-ac', 'r-wc', 'r-bc'],
    },
    ui: { headline: 'Spin to win at checkout 🎰', accent: 'plum' },
    value: 3,
    reason: 'spin available',
  };
}

// ── 11. REFERRAL → ADD_LINE ────────────────────────────────────────────
function evalReferral(c, cart, ctx) {
  if (!ctx.customer.referralCode) return { eligible: false, value: 0, reason: 'no code applied' };
  const rewardSku = c.config?.rewardSkuId || 'r-wc';
  const sku = item(rewardSku);
  return {
    eligible: true,
    op: 'add_line',
    payload: { skuId: rewardSku, equivalentSkuId: sku?.twinOf, displayPrice: 0 },
    ui: { headline: 'Friend code applied · free coffee', accent: 'lime' },
    value: estimateSavings('add_line', { skuId: rewardSku, equivalentSkuId: sku?.twinOf }),
    reason: 'referral code match',
  };
}

// ── 12. UPSELL → SUGGEST_LINE ──────────────────────────────────────────
function evalUpsell(c, cart) {
  // Pure UX. Suggests a face-price SKU. Already POS-safe.
  const cfg = c.config || {};
  const prompts = cfg.prompts || [];
  // Pick first matching prompt
  for (const p of prompts) {
    if (matchesUpsellCondition(p.condition, cart)) {
      const sku = item(p.suggestItemId);
      if (!sku) continue;
      return {
        eligible: true,
        op: 'suggest_line',
        payload: { skuId: p.suggestItemId, displayPrice: sku.price },
        ui: { headline: p.headline, subline: p.subline, accent: 'lime', socialProof: p.socialProof },
        value: 0,
        reason: `matches ${p.condition}`,
      };
    }
  }
  return { eligible: false, value: 0, reason: 'no prompt matches' };
}

function matchesUpsellCondition(cond, cart) {
  if (cond === 'has_breakfast_no_drink') {
    const hasBreakfast = cart.items.some(i => item(i.id)?.cat === 'Breakfast');
    const hasDrink = cart.items.some(i => item(i.id)?.cat === 'Drinks');
    return hasBreakfast && !hasDrink;
  }
  if (cond === 'subtotal_gte_2000') return cart.subtotal >= 20;
  return false;
}

// ─── RESOLVE: best-for-customer wins ────────────────────────────────────
// Returns:
//   {
//     applied:    ResolvedReward | null,
//     alternates: ResolvedReward[],
//     blocked:    {campaign, reason}[],
//     menuMutations: { showCategories[], hideCategories[], showItems[], hideItems[], autoAddLines[], suggestions[] },
//   }
function resolve(campaigns, cart, ctx = DEFAULT_CONTEXT) {
  const evaluated = campaigns.map(c => ({ campaign: c, ...evaluate(c, cart, ctx) }));

  const eligible = evaluated.filter(e => e.eligible);
  const blocked  = evaluated.filter(e => !e.eligible).map(e => ({ campaign: e.campaign, reason: e.reason, progress: e.progress }));

  // Sort by op priority (REVEAL/SWAP run together, ADD_LINE picks single winner) + value desc.
  const stackingOps = ['reveal_category', 'swap_sku', 'suggest_line'];
  const exclusiveOps = ['add_line']; // Only ONE add_line wins (highest value)

  const stackable = eligible.filter(e => stackingOps.includes(e.op));
  const exclusive = eligible.filter(e => exclusiveOps.includes(e.op));

  // Pick highest-value add_line as the headline-applied campaign.
  exclusive.sort((a, b) => {
    if (b.value !== a.value) return b.value - a.value;
    const ai = campaigns.findIndex(c => c.id === a.campaign.id);
    const bi = campaigns.findIndex(c => c.id === b.campaign.id);
    return ai - bi;
  });

  const applied = exclusive[0] || stackable[0] || null;
  const alternates = [
    ...exclusive.slice(1),
    ...stackable.filter(e => e !== applied),
  ];

  // Aggregate menu mutations across all eligible (stack-able) campaigns.
  const menuMutations = aggregateMutations([applied, ...stackable.filter(e => e !== applied)].filter(Boolean));

  return { applied, alternates, blocked, menuMutations };
}

function aggregateMutations(eligibles) {
  const showCategories = new Set();
  const hideCategories = new Set();
  const showItems = new Set();
  const hideItems = new Set();
  const autoAddLines = [];
  const suggestions = [];

  for (const e of eligibles) {
    if (!e.op) continue;
    switch (e.op) {
      case 'reveal_category':
        showCategories.add(e.payload.categoryId);
        break;
      case 'swap_sku': {
        const { hideSkuIds = [], revealSkuId, mode } = e.payload;
        if (mode === 'auto') {
          hideSkuIds.forEach(id => hideItems.add(id));
          if (revealSkuId) showItems.add(revealSkuId);
        } else {
          // suggest mode → goes into suggestions, not auto-applied
          suggestions.push({
            campaignId: e.campaign.id,
            kind: 'swap',
            hideSkuIds, revealSkuId,
            ui: e.ui,
          });
        }
        break;
      }
      case 'add_line':
        autoAddLines.push({
          campaignId: e.campaign.id,
          skuId: e.payload.skuId,
          displayPrice: e.payload.displayPrice,
          mode: e.payload.mode || 'auto',
          slotSkuIds: e.payload.slotSkuIds,
          ui: e.ui,
        });
        break;
      case 'suggest_line':
        suggestions.push({
          campaignId: e.campaign.id,
          kind: 'add',
          skuId: e.payload.skuId,
          displayPrice: e.payload.displayPrice,
          ui: e.ui,
        });
        break;
    }
  }

  return {
    showCategories: [...showCategories],
    hideCategories: [...hideCategories],
    showItems: [...showItems],
    hideItems: [...hideItems],
    autoAddLines,
    suggestions,
  };
}

// ─── MENU VISIBILITY HELPER ─────────────────────────────────────────────
// Apply menu mutations to derive what the customer should actually see.
function visibleMenu(allItems, mutations) {
  const hiddenById = new Set(mutations.hideItems);
  const shownById = new Set(mutations.showItems);
  const shownByCat = new Set(mutations.showCategories);

  return allItems.filter(it => {
    if (hiddenById.has(it.id)) return false;
    if (it.visibility === 'always') return true;
    if (it.visibility === 'reward_only') return false; // never browsable
    if (it.visibility === 'campaign_controlled') {
      return shownById.has(it.id) || shownByCat.has(it.cat);
    }
    return true;
  });
}

// ─── CART HELPERS ───────────────────────────────────────────────────────
function emptyCart() {
  return { items: [], subtotal: 0, tableId: null, guests: [] };
}

function recomputeCart(cart) {
  const subtotal = cart.items.reduce((s, i) => s + i.price * i.qty, 0);
  return { ...cart, subtotal };
}

function addToCart(cart, it, guestId = 'me') {
  const existing = cart.items.find(i => i.id === it.id && i.guestId === guestId);
  let items;
  if (existing) {
    items = cart.items.map(i => i === existing ? { ...i, qty: i.qty + 1 } : i);
  } else {
    items = [...cart.items, { ...it, qty: 1, guestId }];
  }
  return recomputeCart({ ...cart, items });
}

function removeFromCart(cart, itemId, guestId = 'me') {
  const items = cart.items.map(i => {
    if (i.id === itemId && i.guestId === guestId) return { ...i, qty: i.qty - 1 };
    return i;
  }).filter(i => i.qty > 0);
  return recomputeCart({ ...cart, items });
}

// Apply auto-add lines to cart (idempotent — won't double-add same campaign).
function applyAutoAdds(cart, autoAddLines) {
  let next = { ...cart, items: [...cart.items] };
  for (const line of autoAddLines) {
    if (line.mode !== 'auto') continue; // skip opt-in / spin-at-checkout
    if (!line.skuId) continue;
    // Skip if already added by this campaign
    if (next.items.some(i => i._campaignId === line.campaignId)) continue;
    const sku = item(line.skuId);
    if (!sku) continue;
    next.items.push({
      ...sku,
      qty: 1,
      guestId: 'me',
      _campaignId: line.campaignId,
      _isReward: true,
    });
  }
  return recomputeCart(next);
}

// Strip auto-added reward lines whose triggering campaign no longer applies
// (e.g. customer removed a regular item, fell below threshold).
function pruneStaleRewards(cart, activeCampaignIds) {
  const activeSet = new Set(activeCampaignIds);
  const items = cart.items.filter(i => !i._campaignId || activeSet.has(i._campaignId));
  return recomputeCart({ ...cart, items });
}

// ─── EXPORTS ────────────────────────────────────────────────────────────
window.MenuBaseEngine = {
  Store,
  STORE_KEYS,
  DEFAULT_CONTEXT,
  evaluate,
  resolve,
  visibleMenu,
  emptyCart,
  recomputeCart,
  addToCart,
  removeFromCart,
  applyAutoAdds,
  pruneStaleRewards,
};
