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

const {
  useState,
  useEffect,
  useMemo
} = React;
const E = window.MenuBaseEngine;
const CustomerApp = () => {
  const urlParams = (() => {
    try {
      return new URLSearchParams(window.location.search);
    } catch (e) {
      return new URLSearchParams();
    }
  })();
  const demoMode = urlParams.has('demo');
  const hideDev = urlParams.get('hideDev') === '1' || demoMode;
  const compact = urlParams.get('compact') === '1' || demoMode;
  const [campaigns, setCampaigns] = useState(() => {
    if (demoMode) {
      const t = urlParams.get('demo');
      const demoSet = window.DEMO_CAMPAIGNS && window.DEMO_CAMPAIGNS[t] || [];
      return demoSet.length ? demoSet : window.SAMPLE_CAMPAIGNS || [];
    }
    const saved = E.Store.read('campaigns', null);
    return saved && saved.length > 0 ? saved : window.SAMPLE_CAMPAIGNS || [];
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
  const [spinDecision, setSpinDecision] = useState(null); // null | 'accepted' | 'skipped'
  const [confetti, setConfetti] = useState(false);
  const [dismissedSwaps, setDismissedSwaps] = useState({});
  const [ctx, setCtx] = useState(() => ({
    ...E.DEFAULT_CONTEXT,
    hour: urlParams.get('hour') ? +urlParams.get('hour') : 15,
    dayOfWeek: urlParams.get('day') ? +urlParams.get('day') : 2,
    weather: urlParams.get('weather') || 'clear',
    inventory: {
      bc: urlParams.get('stock_bc') ? +urlParams.get('stock_bc') : 8,
      mt: 99
    },
    customer: {
      id: 'cust_demo',
      isBirthday: urlParams.get('birthday') === '1',
      isFirstOrder: false,
      referralCode: urlParams.get('referral') === '1' ? 'AISHA50' : null
    }
  }));
  const active = campaigns.filter(c => c.status === 'active');
  const resolution = E.resolve(active, cart, ctx);
  const mutations = resolution.menuMutations;

  // Auto-add reward lines (threshold reward, birthday reward, etc) and prune stale ones
  useEffect(() => {
    const eligibleCampaignIds = [resolution.applied?.campaign?.id, ...resolution.alternates.map(a => a.campaign.id)].filter(Boolean);
    setCart(c => {
      const pruned = E.pruneStaleRewards(c, eligibleCampaignIds);
      return E.applyAutoAdds(pruned, mutations.autoAddLines);
    });
  }, [resolution.applied?.campaign?.id, mutations.autoAddLines.length]);

  // Cart total = pure sum of line items (face prices only - no discount math)
  const grandTotal = cart.subtotal;
  const addItem = item => setCart(c => E.addToCart(c, item, 'me'));
  const removeItem = id => setCart(c => E.removeFromCart(c, id, 'me'));
  const acceptSwap = swap => {
    setCart(c => {
      let next = {
        ...c,
        items: [...c.items]
      };
      // Remove the parts
      next.items = next.items.filter(i => !swap.hideSkuIds.includes(i.id));
      // Add the combo
      const combo = window.ITEM_BY_ID[swap.revealSkuId];
      if (combo) next.items.push({
        ...combo,
        qty: 1,
        guestId: 'me'
      });
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
    setSpinDecision(null);
    setConfetti(false);
  };
  return /*#__PURE__*/React.createElement("div", {
    className: `cust-app-root ${compact ? 'compact' : ''}`
  }, /*#__PURE__*/React.createElement("div", {
    className: "cust-phone"
  }, /*#__PURE__*/React.createElement("div", {
    className: "phone-notch"
  }), /*#__PURE__*/React.createElement("div", {
    className: "phone-screen"
  }, /*#__PURE__*/React.createElement(CustStatus, {
    ctx: ctx
  }), screen === 'menu' && /*#__PURE__*/React.createElement(MenuScreen, {
    cart: cart,
    addItem: addItem,
    removeItem: removeItem,
    applied: resolution.applied,
    alternates: resolution.alternates,
    blocked: resolution.blocked,
    mutations: mutations,
    onCart: () => setScreen('cart'),
    tableMode: tableMode,
    campaigns: active
  }), screen === 'cart' && /*#__PURE__*/React.createElement(CartScreen, {
    cart: cart,
    addItem: addItem,
    removeItem: removeItem,
    applied: resolution.applied,
    alternates: resolution.alternates,
    mutations: mutations,
    dismissedSwaps: dismissedSwaps,
    onAcceptSwap: acceptSwap,
    onDismissSwap: id => setDismissedSwaps(s => ({
      ...s,
      [id]: true
    })),
    grandTotal: grandTotal,
    onBack: () => setScreen('menu'),
    onCheckout: () => setScreen('checkout'),
    tableMode: tableMode
  }), screen === 'checkout' && /*#__PURE__*/React.createElement(CheckoutScreen, {
    cart: cart,
    mutations: mutations,
    grandTotal: grandTotal,
    onBack: () => setScreen('cart'),
    onComplete: completeOrder,
    spinResult: spinResult,
    setSpinResult: setSpinResult,
    spinDecision: spinDecision,
    setSpinDecision: setSpinDecision,
    setCart: setCart,
    campaigns: active
  }), screen === 'success' && /*#__PURE__*/React.createElement(SuccessScreen, {
    total: grandTotal,
    cart: cart,
    confetti: confetti,
    onNew: newOrder,
    tableMode: tableMode
  }))), !hideDev && /*#__PURE__*/React.createElement(DevPanel, {
    ctx: ctx,
    setCtx: setCtx,
    tableMode: tableMode,
    setTableMode: setTableMode,
    resolution: resolution,
    cart: cart
  }));
};

// ─── STATUS BAR ────────────────────────────────────────────────────────
const CustStatus = ({
  ctx
}) => /*#__PURE__*/React.createElement("div", {
  className: "cust-status"
}, /*#__PURE__*/React.createElement("span", null, String(ctx.hour).padStart(2, '0'), ":42"), /*#__PURE__*/React.createElement("span", {
  style: {
    display: 'flex',
    gap: 6
  }
}, /*#__PURE__*/React.createElement("span", null, "\u2022\u2022\u2022"), /*#__PURE__*/React.createElement("span", null, "\uD83D\uDCF6"), /*#__PURE__*/React.createElement("span", null, "\uD83D\uDD0B")));

// ─── MENU SCREEN ───────────────────────────────────────────────────────
const MenuScreen = ({
  cart,
  addItem,
  removeItem,
  applied,
  alternates,
  blocked,
  mutations,
  onCart,
  tableMode,
  campaigns
}) => {
  // Apply visibility mutations to derive what items the customer can browse
  const visible = E.visibleMenu(window.MENU_ITEMS, mutations);

  // Group by category for display
  const byCat = {};
  visible.forEach(it => {
    const catMeta = window.CAT_BY_ID?.[it.cat] || {
      id: it.cat,
      label: it.cat
    };
    if (!byCat[it.cat]) byCat[it.cat] = {
      meta: catMeta,
      items: []
    };
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
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "cust-head"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("strong", null, "Biji Coffee Co."), tableMode && /*#__PURE__*/React.createElement("span", {
    className: "cust-table"
  }, "\uD83D\uDC65 Table T-04 \xB7 4 guests"), !tableMode && /*#__PURE__*/React.createElement("span", {
    className: "cust-table"
  }, "Takeaway \xB7 self-order"))), applied && /*#__PURE__*/React.createElement(HeroBanner, {
    applied: applied
  }), !applied && thresholdProgress && /*#__PURE__*/React.createElement(ProgressBanner, {
    block: thresholdProgress
  }), alternates.length > 0 && applied && /*#__PURE__*/React.createElement("div", {
    className: "alt-hint"
  }, "+ ", alternates.length, " other reward", alternates.length > 1 ? 's' : '', " stacking on this cart"), /*#__PURE__*/React.createElement("div", {
    className: "cust-menu-scroll"
  }, orderedCats.map(({
    meta,
    items
  }) => {
    const isRevealed = mutations.showCategories.includes(meta.id);
    return /*#__PURE__*/React.createElement("div", {
      key: meta.id
    }, /*#__PURE__*/React.createElement("div", {
      className: "cust-section-title",
      style: isRevealed ? {
        color: 'var(--lime-deep)',
        display: 'flex',
        alignItems: 'center',
        gap: 6
      } : {}
    }, meta.label, isRevealed && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 10,
        fontWeight: 700,
        padding: '2px 6px',
        background: 'var(--lime)',
        color: 'var(--ink)',
        borderRadius: 4,
        letterSpacing: '.05em'
      }
    }, "LIVE NOW")), /*#__PURE__*/React.createElement("div", {
      className: "cust-menu"
    }, items.map(it => {
      const inCart = cart.items.find(i => i.id === it.id);
      return /*#__PURE__*/React.createElement("div", {
        key: it.id,
        className: "cust-item-row"
      }, /*#__PURE__*/React.createElement("div", {
        className: "cust-item-emoji"
      }, it.emoji), /*#__PURE__*/React.createElement("div", {
        className: "cust-item-info"
      }, /*#__PURE__*/React.createElement("strong", null, it.name), /*#__PURE__*/React.createElement("span", {
        className: "cust-item-cat"
      }, it.cat), /*#__PURE__*/React.createElement("div", {
        className: "cust-item-price"
      }, /*#__PURE__*/React.createElement("strong", null, "RM", it.price.toFixed(2)), it.twinOf && (() => {
        const orig = window.ITEM_BY_ID[it.twinOf];
        if (orig && orig.price > it.price) {
          return /*#__PURE__*/React.createElement("s", {
            style: {
              color: 'var(--ink-3)',
              fontWeight: 400,
              marginLeft: 6
            }
          }, "RM", orig.price.toFixed(2));
        }
        return null;
      })())), inCart ? /*#__PURE__*/React.createElement("div", {
        className: "qty-stepper"
      }, /*#__PURE__*/React.createElement("button", {
        className: "qty-step-btn",
        onClick: () => removeItem(it.id),
        "aria-label": "Remove one"
      }, "\u2212"), /*#__PURE__*/React.createElement("span", {
        className: "qty-step-num"
      }, inCart.qty), /*#__PURE__*/React.createElement("button", {
        className: "qty-step-btn",
        onClick: () => addItem(it),
        "aria-label": "Add one"
      }, "+")) : /*#__PURE__*/React.createElement("button", {
        className: "add-btn",
        onClick: () => addItem(it),
        "aria-label": "Add to cart"
      }, "+"));
    })));
  })), cart.items.length > 0 && /*#__PURE__*/React.createElement("button", {
    className: "cust-cart-bar",
    onClick: onCart
  }, /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("strong", null, cart.items.reduce((s, i) => s + i.qty, 0), " items"), " \xB7 RM", cart.subtotal.toFixed(2)), /*#__PURE__*/React.createElement("span", null, "View cart \u2192")));
};
const HeroBanner = ({
  applied
}) => {
  const t = window.TYPE_BY_ID[applied.campaign.type];
  return /*#__PURE__*/React.createElement("div", {
    className: `cust-hero ${t.id}`
  }, /*#__PURE__*/React.createElement("div", {
    className: "cust-hero-eyebrow"
  }, t.icon, " ", t.name.toUpperCase()), /*#__PURE__*/React.createElement("strong", null, applied.ui?.headline || applied.campaign.name), applied.ui?.subline && /*#__PURE__*/React.createElement("div", {
    className: "cust-hero-sub"
  }, applied.ui.subline));
};
const ProgressBanner = ({
  block
}) => {
  const pct = Math.min(100, (block.progress || 0) * 100);
  return /*#__PURE__*/React.createElement("div", {
    className: "cust-progress-banner"
  }, /*#__PURE__*/React.createElement("div", {
    className: "row",
    style: {
      justifyContent: 'space-between',
      marginBottom: 6
    }
  }, /*#__PURE__*/React.createElement("strong", null, block.campaign.name), /*#__PURE__*/React.createElement("span", {
    className: "muted",
    style: {
      fontSize: 12
    }
  }, block.reason)), /*#__PURE__*/React.createElement("div", {
    className: "cust-progress"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: `${pct}%`
    }
  })));
};

// ─── CART SCREEN ───────────────────────────────────────────────────────
const CartScreen = ({
  cart,
  addItem,
  removeItem,
  applied,
  alternates,
  mutations,
  dismissedSwaps,
  onAcceptSwap,
  onDismissSwap,
  grandTotal,
  onBack,
  onCheckout,
  tableMode
}) => {
  // Active swap suggestions (e.g. bundle combo)
  const activeSwaps = mutations.suggestions.filter(s => s.kind === 'swap' && !dismissedSwaps[s.campaignId]);
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "cust-head"
  }, /*#__PURE__*/React.createElement("button", {
    className: "back-btn",
    onClick: onBack
  }, "\u2190"), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("strong", null, "Your cart"), tableMode && /*#__PURE__*/React.createElement("span", {
    className: "cust-table"
  }, "Table T-04"))), /*#__PURE__*/React.createElement("div", {
    className: "cust-cart-list"
  }, cart.items.length === 0 && /*#__PURE__*/React.createElement("div", {
    className: "muted",
    style: {
      padding: '40px 20px',
      textAlign: 'center'
    }
  }, "Cart is empty"), cart.items.map((i, k) => /*#__PURE__*/React.createElement("div", {
    key: k,
    className: `cart-line ${i._isReward ? 'is-reward' : ''}`
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("strong", null, i.name), i._isReward && /*#__PURE__*/React.createElement("span", {
    className: "reward-flag"
  }, "REWARD \xB7 added free"), tableMode && i.guestId !== 'me' && !i._isReward && /*#__PURE__*/React.createElement("span", {
    className: "cust-table"
  }, "From: ", i.guestId)), !i._isReward ? /*#__PURE__*/React.createElement("div", {
    className: "qty-control"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => removeItem(i.id)
  }, "\u2212"), /*#__PURE__*/React.createElement("span", null, i.qty), /*#__PURE__*/React.createElement("button", {
    onClick: () => addItem(i)
  }, "+")) : /*#__PURE__*/React.createElement("span", {
    className: "muted",
    style: {
      fontSize: 12
    }
  }, "\xD7", i.qty), /*#__PURE__*/React.createElement("strong", {
    className: i.price === 0 ? 'lime' : ''
  }, "RM", (i.price * i.qty).toFixed(2)))), activeSwaps.map(swap => {
    const reveal = window.ITEM_BY_ID[swap.revealSkuId];
    const partsTotal = swap.hideSkuIds.reduce((s, id) => s + (window.ITEM_BY_ID[id]?.price || 0), 0);
    const savings = Math.max(0, partsTotal - (reveal?.price || 0));
    return /*#__PURE__*/React.createElement("div", {
      key: swap.campaignId,
      className: "swap-suggest"
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("strong", null, swap.ui?.headline || 'Save with the combo'), /*#__PURE__*/React.createElement("span", {
      className: "muted",
      style: {
        fontSize: 12,
        display: 'block',
        marginTop: 2
      }
    }, "Replace ", swap.hideSkuIds.length, " items \xB7 pay RM", (reveal?.price || 0).toFixed(2), " (save RM", savings.toFixed(2), ")")), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 8
      }
    }, /*#__PURE__*/React.createElement("button", {
      className: "swap-skip",
      onClick: () => onDismissSwap(swap.campaignId)
    }, "No"), /*#__PURE__*/React.createElement("button", {
      className: "swap-accept",
      onClick: () => {
        onAcceptSwap(swap);
        onDismissSwap(swap.campaignId);
      }
    }, "Swap")));
  }), /*#__PURE__*/React.createElement("div", {
    className: "cart-totals"
  }, /*#__PURE__*/React.createElement("div", {
    className: "row",
    style: {
      justifyContent: 'space-between'
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "muted"
  }, "Subtotal"), /*#__PURE__*/React.createElement("span", null, "RM", cart.subtotal.toFixed(2))), /*#__PURE__*/React.createElement("div", {
    className: "row total",
    style: {
      justifyContent: 'space-between'
    }
  }, /*#__PURE__*/React.createElement("strong", null, "Total"), /*#__PURE__*/React.createElement("strong", null, "RM", grandTotal.toFixed(2))), /*#__PURE__*/React.createElement("div", {
    className: "pos-note"
  }, "All prices are real menu items. The waiter rings them 1-to-1 into the POS."))), cart.items.length > 0 && /*#__PURE__*/React.createElement("button", {
    className: "checkout-btn",
    onClick: onCheckout
  }, "Checkout \xB7 RM", grandTotal.toFixed(2), " \u2192"));
};

// ─── CHECKOUT SCREEN ───────────────────────────────────────────────────
const CheckoutScreen = ({
  cart,
  mutations,
  grandTotal,
  onBack,
  onComplete,
  spinResult,
  setSpinResult,
  spinDecision,
  setSpinDecision,
  setCart,
  campaigns
}) => {
  const spinCampaign = campaigns.find(c => c.type === 'spin_wheel' && c.status === 'active');
  const upsellSuggestions = mutations.suggestions.filter(s => s.kind === 'add');

  // Wheel lands - just record the slot, don't add to cart yet (let user decide)
  const onSpinResult = slotSkuId => {
    setSpinResult(slotSkuId);
  };
  const acceptSpinPrize = () => {
    const sku = window.ITEM_BY_ID[spinResult];
    if (sku && spinCampaign) {
      setCart(c => E.recomputeCart({
        ...c,
        items: [...c.items, {
          ...sku,
          qty: 1,
          guestId: 'me',
          _campaignId: spinCampaign.id,
          _isReward: true
        }]
      }));
    }
    setSpinDecision('accepted');
  };
  const skipSpinPrize = () => {
    setSpinDecision('skipped');
  };
  const acceptUpsell = sug => {
    const sku = window.ITEM_BY_ID[sug.skuId];
    if (sku) setCart(c => E.addToCart(c, sku, 'me'));
  };
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "cust-head"
  }, /*#__PURE__*/React.createElement("button", {
    className: "back-btn",
    onClick: onBack
  }, "\u2190"), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("strong", null, "Checkout"))), /*#__PURE__*/React.createElement("div", {
    className: "cust-cart-list",
    style: {
      flex: 1
    }
  }, upsellSuggestions.map(sug => {
    const sku = window.ITEM_BY_ID[sug.skuId];
    if (!sku) return null;
    return /*#__PURE__*/React.createElement("div", {
      key: sug.campaignId,
      className: "addon-card upsell"
    }, /*#__PURE__*/React.createElement("h4", null, sug.ui?.headline), /*#__PURE__*/React.createElement("p", null, sug.ui?.subline), sug.ui?.socialProof && /*#__PURE__*/React.createElement("span", {
      className: "social-proof"
    }, sug.ui.socialProof), /*#__PURE__*/React.createElement("button", {
      className: "reveal-btn",
      onClick: () => acceptUpsell(sug)
    }, "+ Add ", sku.name, " \xB7 RM", sku.price.toFixed(2)));
  }), spinCampaign && !spinResult && /*#__PURE__*/React.createElement("div", {
    className: "addon-card spin"
  }, /*#__PURE__*/React.createElement("h4", null, "\uD83C\uDFB0 ", spinCampaign.name), /*#__PURE__*/React.createElement("p", null, "Spin once for a free item. Lands on a real RM0 SKU you can add to your cart."), /*#__PURE__*/React.createElement(SpinWheel, {
    slotSkuIds: spinCampaign.config?.slotSkuIds || ['r-ac', 'r-wc', 'r-bc'],
    onResult: onSpinResult
  })), spinResult && spinDecision === null && /*#__PURE__*/React.createElement("div", {
    className: "addon-card spin pending"
  }, /*#__PURE__*/React.createElement("h4", null, "\uD83C\uDF89 You landed on ", window.ITEM_BY_ID[spinResult]?.name || 'a reward', "!"), /*#__PURE__*/React.createElement("p", null, "Free, at RM0. Add it to your order, or skip and check out without."), /*#__PURE__*/React.createElement("div", {
    className: "spin-actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: "reveal-btn",
    onClick: acceptSpinPrize
  }, "+ Add to cart"), /*#__PURE__*/React.createElement("button", {
    className: "skip-btn",
    onClick: skipSpinPrize
  }, "Skip"))), spinDecision === 'accepted' && /*#__PURE__*/React.createElement("div", {
    className: "addon-card spin won"
  }, /*#__PURE__*/React.createElement("h4", null, "\uD83C\uDFB0 Prize added"), /*#__PURE__*/React.createElement("strong", null, window.ITEM_BY_ID[spinResult]?.name || 'Reward', " \xB7 added at RM0")), spinDecision === 'skipped' && /*#__PURE__*/React.createElement("div", {
    className: "addon-card spin skipped"
  }, /*#__PURE__*/React.createElement("h4", null, "\uD83C\uDFB0 Prize skipped"), /*#__PURE__*/React.createElement("p", null, "No worries. ", window.ITEM_BY_ID[spinResult]?.name || 'The reward', " stays in the wheel.")), /*#__PURE__*/React.createElement("div", {
    className: "checkout-summary"
  }, /*#__PURE__*/React.createElement("h4", null, "Order summary"), cart.items.map((i, k) => /*#__PURE__*/React.createElement("div", {
    key: k,
    className: "row",
    style: {
      justifyContent: 'space-between',
      fontSize: 13.5,
      padding: '4px 0',
      color: i.price === 0 ? 'var(--lime-deep)' : 'inherit'
    }
  }, /*#__PURE__*/React.createElement("span", null, i.qty, "\xD7 ", i.name, i._isReward ? ' (free)' : ''), /*#__PURE__*/React.createElement("span", null, "RM", (i.price * i.qty).toFixed(2)))), /*#__PURE__*/React.createElement("div", {
    className: "row total",
    style: {
      justifyContent: 'space-between',
      marginTop: 8
    }
  }, /*#__PURE__*/React.createElement("strong", null, "Total"), /*#__PURE__*/React.createElement("strong", null, "RM", cart.subtotal.toFixed(2)))), /*#__PURE__*/React.createElement("div", {
    className: "checkout-pay"
  }, /*#__PURE__*/React.createElement("h4", null, "Pay with"), /*#__PURE__*/React.createElement("div", {
    className: "pay-grid"
  }, /*#__PURE__*/React.createElement("button", {
    className: "pay-btn on"
  }, "\uD83D\uDCB3 Card"), /*#__PURE__*/React.createElement("button", {
    className: "pay-btn"
  }, "\uD83D\uDCF1 GrabPay"), /*#__PURE__*/React.createElement("button", {
    className: "pay-btn"
  }, "\uD83D\uDCB0 TnG")))), /*#__PURE__*/React.createElement("button", {
    className: "checkout-btn",
    onClick: onComplete
  }, "Place order \xB7 RM", cart.subtotal.toFixed(2)));
};

// ─── SPIN WHEEL ────────────────────────────────────────────────────────
const SpinWheel = ({
  slotSkuIds,
  onResult
}) => {
  const [spinning, setSpinning] = useState(false);
  const [angle, setAngle] = useState(0);
  const slots = slotSkuIds.map(id => window.ITEM_BY_ID[id]).filter(Boolean);
  if (slots.length === 0) return null;
  const spin = () => {
    if (spinning) return;
    setSpinning(true);
    const idx = Math.floor(Math.random() * slots.length);
    const slice = 360 / slots.length;
    const target = 360 * 5 + (360 - idx * slice - slice / 2);
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
    const end = start + sliceDeg;
    return `${palette[i % palette.length]} ${start}deg ${end}deg`;
  }).join(', ');
  const wheelStyle = {
    transform: `rotate(${angle}deg)`,
    transition: spinning ? 'transform 3s cubic-bezier(0.2, 0.7, 0.2, 1)' : 'none',
    background: `conic-gradient(from -${sliceDeg / 2}deg, ${gradient})`
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "spin-wrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "spin-pointer"
  }, "\u25BC"), /*#__PURE__*/React.createElement("div", {
    className: "spin-wheel",
    style: wheelStyle
  }, slots.map((s, i) => {
    // Place label at midpoint of slice. Counter-rotate inner text to stay upright.
    const midAngle = i * sliceDeg;
    const textColor = i % 2 ? '#FFFFFF' : '#1A1A1A';
    return /*#__PURE__*/React.createElement("div", {
      key: i,
      className: "spin-label",
      style: {
        transform: `rotate(${midAngle}deg)`
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "lbl",
      style: {
        transform: `translateX(-50%) rotate(${-midAngle}deg)`,
        color: textColor
      }
    }, s.emoji, " ", s.name.replace('Promo ', '')));
  })), /*#__PURE__*/React.createElement("button", {
    className: "spin-btn",
    onClick: spin,
    disabled: spinning
  }, spinning ? 'Wait…' : 'Spin'));
};

// ─── SUCCESS SCREEN ────────────────────────────────────────────────────
const SuccessScreen = ({
  total,
  cart,
  confetti,
  onNew,
  tableMode
}) => /*#__PURE__*/React.createElement("div", {
  className: "success-screen"
}, confetti && /*#__PURE__*/React.createElement(Confetti, null), /*#__PURE__*/React.createElement("div", {
  className: "success-check"
}, "\u2713"), /*#__PURE__*/React.createElement("h2", null, "Order placed!"), /*#__PURE__*/React.createElement("p", null, "Sent to the ", /*#__PURE__*/React.createElement("strong", null, "waiter's tablet"), " at ", tableMode ? 'Table T-04' : 'Counter'), /*#__PURE__*/React.createElement("p", {
  className: "muted",
  style: {
    fontSize: 13
  }
}, "Pickup ready in ~8 min \xB7 pay at counter"), /*#__PURE__*/React.createElement("div", {
  className: "waiter-ticket"
}, /*#__PURE__*/React.createElement("div", {
  className: "wt-head"
}, /*#__PURE__*/React.createElement("span", {
  className: "wt-tag"
}, "WAITER TABLET \xB7 KOT"), /*#__PURE__*/React.createElement("span", {
  className: "wt-num"
}, "#", Math.floor(Math.random() * 900) + 100)), /*#__PURE__*/React.createElement("div", {
  className: "wt-table"
}, tableMode ? 'Table T-04 · 4 guests' : 'Counter · takeaway'), /*#__PURE__*/React.createElement("div", {
  className: "wt-list"
}, cart.items.map((i, k) => /*#__PURE__*/React.createElement("div", {
  key: k,
  className: "wt-row"
}, /*#__PURE__*/React.createElement("span", {
  className: "wt-qty"
}, i.qty, "\xD7"), /*#__PURE__*/React.createElement("span", {
  className: "wt-name"
}, i.name), /*#__PURE__*/React.createElement("span", {
  className: "wt-price"
}, "RM", (i.price * i.qty).toFixed(2))))), /*#__PURE__*/React.createElement("div", {
  className: "wt-total"
}, /*#__PURE__*/React.createElement("span", null, "Total to key into POS"), /*#__PURE__*/React.createElement("strong", null, "RM", total.toFixed(2))), /*#__PURE__*/React.createElement("div", {
  className: "wt-note"
}, "Every line is a real SKU at face price. Waiter rings 1-to-1 - no manager codes, no discount math.")), /*#__PURE__*/React.createElement("button", {
  className: "checkout-btn",
  style: {
    marginTop: 16
  },
  onClick: onNew
}, "New order"));
const Confetti = () => /*#__PURE__*/React.createElement("div", {
  className: "confetti"
}, Array.from({
  length: 30
}).map((_, i) => /*#__PURE__*/React.createElement("span", {
  key: i,
  style: {
    left: `${Math.random() * 100}%`,
    animationDelay: `${Math.random() * 0.5}s`,
    background: ['var(--lime)', 'var(--plum)', '#ffb800', '#ff5e5b'][i % 4]
  }
})));

// ─── DEV PANEL ─────────────────────────────────────────────────────────
const DevPanel = ({
  ctx,
  setCtx,
  tableMode,
  setTableMode,
  resolution,
  cart
}) => {
  const [open, setOpen] = useState(true);
  return /*#__PURE__*/React.createElement("div", {
    className: `dev-overlay ${open ? 'open' : ''}`
  }, /*#__PURE__*/React.createElement("button", {
    className: "dev-toggle",
    onClick: () => setOpen(!open)
  }, open ? '✕' : '⚙️', " ", open ? 'Hide demo controls' : ''), open && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "dev-overlay-head"
  }, /*#__PURE__*/React.createElement("strong", null, "Demo controls"), /*#__PURE__*/React.createElement("p", null, "Adjust to trigger different campaigns")), /*#__PURE__*/React.createElement("div", {
    className: "dev-section"
  }, /*#__PURE__*/React.createElement("div", {
    className: "dev-label"
  }, "Hour"), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "6",
    max: "23",
    value: ctx.hour,
    onChange: e => setCtx({
      ...ctx,
      hour: +e.target.value
    })
  }), /*#__PURE__*/React.createElement("div", {
    className: "dev-readout"
  }, String(ctx.hour).padStart(2, '0'), ":00")), /*#__PURE__*/React.createElement("div", {
    className: "dev-section"
  }, /*#__PURE__*/React.createElement("div", {
    className: "dev-label"
  }, "Day"), /*#__PURE__*/React.createElement("div", {
    className: "day-pills"
  }, ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => /*#__PURE__*/React.createElement("button", {
    key: i,
    className: `day-pill ${ctx.dayOfWeek === i ? 'on' : ''}`,
    onClick: () => setCtx({
      ...ctx,
      dayOfWeek: i
    })
  }, d)))), /*#__PURE__*/React.createElement("div", {
    className: "dev-section"
  }, /*#__PURE__*/React.createElement("div", {
    className: "dev-label"
  }, "Weather"), /*#__PURE__*/React.createElement("div", {
    className: "dev-radio"
  }, ['clear', 'rain', 'hot'].map(w => /*#__PURE__*/React.createElement("button", {
    key: w,
    className: `dev-chip ${ctx.weather === w ? 'on' : ''}`,
    onClick: () => setCtx({
      ...ctx,
      weather: w
    })
  }, w === 'clear' ? '☀️' : w === 'rain' ? '🌧️' : '🔥', " ", w)))), /*#__PURE__*/React.createElement("div", {
    className: "dev-section"
  }, /*#__PURE__*/React.createElement("div", {
    className: "dev-label"
  }, "Cheesecake stock"), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "0",
    max: "50",
    value: ctx.inventory.bc,
    onChange: e => setCtx({
      ...ctx,
      inventory: {
        ...ctx.inventory,
        bc: +e.target.value
      }
    })
  }), /*#__PURE__*/React.createElement("div", {
    className: "dev-readout"
  }, ctx.inventory.bc, " left")), /*#__PURE__*/React.createElement("div", {
    className: "dev-section"
  }, /*#__PURE__*/React.createElement("div", {
    className: "dev-label"
  }, "Customer"), /*#__PURE__*/React.createElement("button", {
    className: `dev-chip ${ctx.customer.isBirthday ? 'on' : ''}`,
    onClick: () => setCtx({
      ...ctx,
      customer: {
        ...ctx.customer,
        isBirthday: !ctx.customer.isBirthday
      }
    })
  }, "\uD83C\uDF82 Birthday"), /*#__PURE__*/React.createElement("button", {
    className: `dev-chip ${ctx.customer.referralCode ? 'on' : ''}`,
    onClick: () => setCtx({
      ...ctx,
      customer: {
        ...ctx.customer,
        referralCode: ctx.customer.referralCode ? null : 'AISHA50'
      }
    })
  }, "\uD83C\uDF9F\uFE0F Referred")), /*#__PURE__*/React.createElement("div", {
    className: "dev-section"
  }, /*#__PURE__*/React.createElement("button", {
    className: `dev-chip ${tableMode ? 'on' : ''}`,
    onClick: () => setTableMode(!tableMode)
  }, "\uD83D\uDC65 Joint table cart")), /*#__PURE__*/React.createElement("div", {
    className: "dev-section dev-engine"
  }, /*#__PURE__*/React.createElement("div", {
    className: "dev-label"
  }, "Engine output"), /*#__PURE__*/React.createElement("div", {
    className: "engine-mini"
  }, /*#__PURE__*/React.createElement("strong", null, resolution.applied?.campaign?.name || '- no campaign active -'), resolution.applied && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
    className: "lime",
    style: {
      fontSize: 11,
      fontFamily: 'var(--mono)',
      marginTop: 4,
      display: 'block'
    }
  }, "op: ", resolution.applied.op), /*#__PURE__*/React.createElement("span", {
    className: "muted",
    style: {
      fontSize: 11,
      marginTop: 2,
      display: 'block'
    }
  }, "est. value: RM", (resolution.applied.value || 0).toFixed(2))), /*#__PURE__*/React.createElement("div", {
    className: "muted",
    style: {
      fontSize: 11,
      marginTop: 4
    }
  }, resolution.alternates.length, " stacking \xB7 ", resolution.blocked.length, " blocked")))));
};
const root = ReactDOM.createRoot(document.getElementById('cust-root'));
root.render(/*#__PURE__*/React.createElement(CustomerApp, null));