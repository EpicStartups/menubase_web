// Campaign type definitions + sample data for MenuBase merchant dashboard.

const CAMPAIGN_TYPES = [
  {
    id: 'threshold',
    icon: '🎁',
    name: 'Threshold Reward',
    sub: 'Spend RM50 → unlock a free item',
    tag: 'POPULAR',
    accent: 'lime',
  },
  {
    id: 'happy_hour',
    icon: '⚡',
    name: 'Happy Hour',
    sub: 'Time-based discount on items',
    tag: 'POPULAR',
    accent: 'lime',
  },
  {
    id: 'bundle',
    icon: '🎯',
    name: 'Bundle Builder',
    sub: 'Pair coffee + pastry, save RM3',
    accent: 'plum',
  },
  {
    id: 'spin_wheel',
    icon: '🎰',
    name: 'Spin & Win',
    sub: 'Surprise reward wheel',
  },
  {
    id: 'mystery',
    icon: '🎁',
    name: 'Mystery Box',
    sub: 'Surprise add-on at checkout',
  },
  {
    id: 'flash',
    icon: '🔥',
    name: 'Flash Deal',
    sub: 'Time-limited flash discount',
  },
  {
    id: 'weather',
    icon: '🌧️',
    name: 'Weather-Triggered',
    sub: 'Auto-discount on rain or heat',
    tag: 'NEW',
    accent: 'plum',
  },
  {
    id: 'inventory',
    icon: '🔄',
    name: 'Inventory-Triggered',
    sub: 'Move slow stock automatically',
    future: true,
  },
  {
    id: 'birthday',
    icon: '🎂',
    name: 'Birthday Reward',
    sub: 'Free dessert on their birthday',
    future: true,
  },
  {
    id: 'referral',
    icon: '🎟️',
    name: 'Referral Codes',
    sub: 'Customers refer friends, both win',
    future: true,
  },
  {
    id: 'offpeak',
    icon: '☕',
    name: 'Off-Peak Pricing',
    sub: 'Drive customers in slow hours',
  },
  {
    id: 'upsell_popup',
    icon: '✨',
    name: 'Smart Upsell Popup',
    sub: 'Suggest add-ons at checkout',
    tag: 'CORE',
    accent: 'lime',
  },
];

const TYPE_BY_ID = Object.fromEntries(CAMPAIGN_TYPES.map(t => [t.id, t]));

// Menu items the merchant has on file (for the picker)
// Items have visibility:
//   'always'              → normal browsable item
//   'campaign_controlled' → hidden by default; reveal_category / swap_sku shows it
//   'reward_only'         → never browsable; only auto-added by reward campaigns
const MENU_ITEMS = [
  // ── Regular items ────────────────────────────────────────────────
  { id: 'eb', name: 'Eggs Benedict', emoji: '🍳', price: 22, cat: 'Breakfast', visibility: 'always' },
  { id: 'sa', name: 'Smashed Avo Toast', emoji: '🥑', price: 18, cat: 'Breakfast', visibility: 'always' },
  { id: 'ac', name: 'Almond Croissant', emoji: '🥐', price: 12, cat: 'Pastries', visibility: 'always' },
  { id: 'bc', name: 'Basque Cheesecake', emoji: '🍰', price: 14, cat: 'Sweets', visibility: 'always' },
  { id: 'mt', name: 'Matcha Tiramisu', emoji: '🍵', price: 16, cat: 'Sweets', visibility: 'always' },
  { id: 'wc', name: 'White Coffee', emoji: '☕', price: 9, cat: 'Drinks', visibility: 'always' },
  { id: 'ml', name: 'Matcha Latte', emoji: '🍵', price: 12, cat: 'Drinks', visibility: 'always' },
  { id: 'tp', name: 'Truffle Mushroom Pasta', emoji: '🍝', price: 26, cat: 'Mains', visibility: 'always' },

  // ── Reward-only SKUs (RM0, never in menu, only auto-added) ───────
  { id: 'r-ac', name: 'Promo Almond Croissant', emoji: '🥐', price: 0, cat: 'Promo', visibility: 'reward_only', isReward: true },
  { id: 'r-bc', name: 'Promo Cheesecake', emoji: '🍰', price: 0, cat: 'Promo', visibility: 'reward_only', isReward: true },
  { id: 'r-wc', name: 'Promo White Coffee', emoji: '☕', price: 0, cat: 'Promo', visibility: 'reward_only', isReward: true },

  // ── Mystery box (flat-price SKU at RM5) ──────────────────────────
  { id: 'r-mb', name: 'Mystery Box', emoji: '📦', price: 5, cat: 'Promo', visibility: 'reward_only' },

  // ── Happy Hour twins (campaign_controlled, pre-discounted) ───────
  { id: 'hh-wc', name: 'Happy Hour White Coffee', emoji: '☕', price: 6.30, cat: 'Happy Hour', visibility: 'campaign_controlled', twinOf: 'wc' },
  { id: 'hh-ml', name: 'Happy Hour Matcha Latte', emoji: '🍵', price: 8.40, cat: 'Happy Hour', visibility: 'campaign_controlled', twinOf: 'ml' },

  // ── Off-Peak twins ────────────────────────────────────────────────
  { id: 'op-eb', name: 'Off-Peak Eggs Benedict', emoji: '🍳', price: 19.80, cat: 'Off-Peak', visibility: 'campaign_controlled', twinOf: 'eb' },
  { id: 'op-tp', name: 'Off-Peak Truffle Pasta', emoji: '🍝', price: 23.40, cat: 'Off-Peak', visibility: 'campaign_controlled', twinOf: 'tp' },

  // ── Flash twins ──────────────────────────────────────────────────
  { id: 'fl-ac', name: 'Flash Almond Croissant', emoji: '🥐', price: 9.60, cat: 'Flash', visibility: 'campaign_controlled', twinOf: 'ac' },
  { id: 'fl-bc', name: 'Flash Cheesecake', emoji: '🍰', price: 11.20, cat: 'Flash', visibility: 'campaign_controlled', twinOf: 'bc' },

  // ── Weather (Rainy Day) twins ────────────────────────────────────
  { id: 'rd-wc', name: 'Rainy Day White Coffee', emoji: '☕', price: 7, cat: 'Rainy Day', visibility: 'campaign_controlled', twinOf: 'wc' },
  { id: 'rd-ml', name: 'Rainy Day Matcha Latte', emoji: '🍵', price: 10, cat: 'Rainy Day', visibility: 'campaign_controlled', twinOf: 'ml' },

  // ── Inventory clearance twin (revealed via swap_sku) ─────────────
  { id: 'lc-bc', name: 'Last Chance Cheesecake', emoji: '🍰', price: 10.50, cat: 'Sweets', visibility: 'campaign_controlled', twinOf: 'bc' },

  // ── Bundle combo SKU ──────────────────────────────────────────────
  { id: 'cb-cp', name: 'Coffee + Pastry Combo', emoji: '☕🥐', price: 18, cat: 'Combos', visibility: 'campaign_controlled' },
];

const ITEM_BY_ID = Object.fromEntries(MENU_ITEMS.map(i => [i.id, i]));

// Categories with visibility metadata. campaign_controlled categories are
// hidden in the menu unless an active campaign reveals them.
const CATEGORIES_META = [
  { id: 'Breakfast', label: 'Breakfast', visibility: 'always' },
  { id: 'Pastries', label: 'Pastries', visibility: 'always' },
  { id: 'Sweets', label: 'Sweets', visibility: 'always' },
  { id: 'Drinks', label: 'Drinks', visibility: 'always' },
  { id: 'Mains', label: 'Mains', visibility: 'always' },
  { id: 'Happy Hour', label: 'Happy Hour Drinks', visibility: 'campaign_controlled' },
  { id: 'Off-Peak', label: 'Off-Peak Menu', visibility: 'campaign_controlled' },
  { id: 'Flash', label: 'Flash Deals', visibility: 'campaign_controlled' },
  { id: 'Rainy Day', label: 'Rainy Day Menu', visibility: 'campaign_controlled' },
  { id: 'Combos', label: 'Combos', visibility: 'campaign_controlled' },
];

const CATEGORIES = CATEGORIES_META.map(c => c.id);
const CAT_BY_ID = Object.fromEntries(CATEGORIES_META.map(c => [c.id, c]));

const DAY_PRESETS = {
  weekdays: [1, 1, 1, 1, 1, 0, 0],
  weekends: [0, 0, 0, 0, 0, 1, 1],
  all: [1, 1, 1, 1, 1, 1, 1],
};

// Pre-loaded sample campaigns (used when user clicks "Load sample data")
const SAMPLE_CAMPAIGNS = [
  {
    id: 'c1',
    type: 'happy_hour',
    name: 'Afternoon Happy Hour',
    status: 'active',
    activeDays: [1, 1, 1, 1, 1, 0, 0],
    startTime: '14:00',
    endTime: '17:00',
    config: {
      discountType: 'percentage',
      discountValue: 30,
      appliesTo: 'category',
      categoryIds: ['Drinks'],
    },
    redemptions: 1284,
    revenue: 8240,
  },
  {
    id: 'c2',
    type: 'threshold',
    name: 'Free Croissant Promo',
    status: 'active',
    activeDays: [1, 1, 1, 1, 1, 1, 1],
    startTime: '09:00',
    endTime: '17:00',
    config: {
      thresholdAmount: 50,
      rewardType: 'free_item',
      rewardItemId: 'ac',
      message: 'FREE Almond Croissant 🥐',
    },
    redemptions: 412,
    revenue: 3140,
  },
  {
    id: 'c3',
    type: 'spin_wheel',
    name: 'Weekend Spin & Win',
    status: 'paused',
    activeDays: [0, 0, 0, 0, 0, 1, 1],
    startTime: '11:00',
    endTime: '21:00',
    config: { prizes: 6 },
    redemptions: 89,
    revenue: 720,
  },
  {
    id: 'c4',
    type: 'inventory',
    name: 'End-of-day Cheesecake',
    status: 'active',
    activeDays: [1, 1, 1, 1, 1, 1, 1],
    startTime: '17:00',
    endTime: '22:00',
    config: { itemId: 'bc', threshold: 10, discount: 25 },
    redemptions: 38,
    revenue: 290,
  },
  {
    id: 'c5',
    type: 'weather',
    name: 'Rainy Day Special',
    status: 'active',
    activeDays: [1, 1, 1, 1, 1, 1, 1],
    startTime: 'auto',
    endTime: 'auto',
    config: { condition: 'rain', discount: 'RM2 off hot drinks' },
    redemptions: 156,
    revenue: 1120,
  },
  {
    id: 'c6',
    type: 'bundle',
    name: 'Coffee + Pastry Combo',
    status: 'active',
    activeDays: [1, 1, 1, 1, 1, 1, 1],
    startTime: '07:00',
    endTime: '11:00',
    config: { groupA: 'Drinks', groupB: 'Pastries', discount: 3 },
    redemptions: 624,
    revenue: 4180,
  },
  {
    id: 'c7',
    type: 'upsell_popup',
    name: 'Complete the meal · drink + dessert',
    status: 'active',
    activeDays: [1, 1, 1, 1, 1, 1, 1],
    startTime: '00:00',
    endTime: '23:59',
    config: {
      maxPrompts: 2,
      prompts: [
        {
          id: 'p1',
          condition: 'has_breakfast_no_drink',
          suggestItemId: 'wc',
          headline: 'Complete your meal?',
          subline: 'Creamy, smooth · perfect pairing',
          socialProof: '89% of customers add a drink ☕',
        },
        {
          id: 'p2',
          condition: 'subtotal_gte_2000',
          suggestItemId: 'bc',
          headline: 'End on a sweet note?',
          subline: 'Burnt top, jiggly creamy centre',
          socialProof: "Today's crowd favourite 🏆",
        },
      ],
    },
    redemptions: 2104,
    revenue: 16832,
  },
];

window.CAMPAIGN_TYPES = CAMPAIGN_TYPES;
window.TYPE_BY_ID = TYPE_BY_ID;
window.MENU_ITEMS = MENU_ITEMS;
window.ITEM_BY_ID = ITEM_BY_ID;
window.CATEGORIES = CATEGORIES;
window.CATEGORIES_META = CATEGORIES_META;
window.CAT_BY_ID = CAT_BY_ID;
window.DAY_PRESETS = DAY_PRESETS;
window.SAMPLE_CAMPAIGNS = SAMPLE_CAMPAIGNS;

// ── DEMO CAMPAIGNS ────────────────────────────────────────────────
// One self-contained, ALWAYS-ON campaign per mechanic — so the embedded
// Mechanics demos always show that exact mechanic firing, regardless of
// time/day/state. Each is whitelisted into the customer app when ?demo=<id>.

const DEMO_CAMPAIGNS = {
  threshold: [{
    id: 'd-threshold', type: 'threshold', name: 'Spend RM50, free croissant',
    status: 'active', activeDays: [1,1,1,1,1,1,1], startTime: '00:00', endTime: '23:59',
    config: { thresholdAmount: 50, rewardType: 'free_item', rewardItemId: 'ac', message: 'FREE Almond Croissant 🥐' },
    priority: 50,
  }],
  happy_hour: [{
    id: 'd-happy', type: 'happy_hour', name: 'Afternoon Happy Hour',
    status: 'active', activeDays: [1,1,1,1,1,1,1], startTime: '00:00', endTime: '23:59',
    config: { discountType: 'percentage', discountValue: 30, appliesTo: 'category', categoryIds: ['Drinks'] },
    priority: 60,
  }],
  bundle: [{
    id: 'd-bundle', type: 'bundle', name: 'Coffee + Pastry Combo',
    status: 'active', activeDays: [1,1,1,1,1,1,1], startTime: '00:00', endTime: '23:59',
    config: { groupA: 'Drinks', groupB: 'Pastries', discount: 3 },
    priority: 40,
  }],
  spin_wheel: [{
    id: 'd-spin', type: 'spin_wheel', name: 'Spin & Win',
    status: 'active', activeDays: [1,1,1,1,1,1,1], startTime: '00:00', endTime: '23:59',
    config: { prizes: 6 },
    priority: 10,
  }],
  mystery: [{
    id: 'd-mystery', type: 'mystery', name: 'Mystery Box · RM5',
    status: 'active', activeDays: [1,1,1,1,1,1,1], startTime: '00:00', endTime: '23:59',
    config: { price: 5, label: 'Pick of the day' },
    priority: 10,
  }],
  flash: [{
    id: 'd-flash', type: 'flash', name: 'Flash · 20% off pastries',
    status: 'active', activeDays: [1,1,1,1,1,1,1], startTime: '00:00', endTime: '23:59',
    config: { duration: 5, discountValue: 20, target: 'Pastries', endsAt: Date.now() + 5 * 60 * 1000 },
    priority: 90,
  }],
  weather: [{
    id: 'd-weather', type: 'weather', name: 'Rainy Day Special',
    status: 'active', activeDays: [1,1,1,1,1,1,1], startTime: 'auto', endTime: 'auto',
    config: { condition: 'rain', discount: 'RM2 off hot drinks' },
    priority: 30,
  }],
  inventory: [{
    id: 'd-inv', type: 'inventory', name: 'End-of-day Cheesecake',
    status: 'active', activeDays: [1,1,1,1,1,1,1], startTime: '00:00', endTime: '23:59',
    config: { itemId: 'bc', threshold: 10, discount: 25 },
    priority: 50,
  }],
  birthday: [{
    id: 'd-bday', type: 'birthday', name: 'Birthday Reward',
    status: 'active', activeDays: [1,1,1,1,1,1,1], startTime: '00:00', endTime: '23:59',
    config: { reward: 'Free cheesecake', minSpend: 25 },
    priority: 70,
  }],
  referral: [{
    id: 'd-ref', type: 'referral', name: 'Referral · RM5 off',
    status: 'active', activeDays: [1,1,1,1,1,1,1], startTime: '00:00', endTime: '23:59',
    config: { friendReward: 5, referrerReward: 5, minSpend: 25 },
    priority: 30,
  }],
  offpeak: [{
    id: 'd-offpeak', type: 'offpeak', name: 'Off-Peak · RM2 off',
    status: 'active', activeDays: [1,1,1,1,1,1,1], startTime: '00:00', endTime: '23:59',
    config: { discountType: 'flat', discountValue: 2 },
    priority: 30,
  }],
  upsell_popup: [{
    id: 'd-upsell', type: 'upsell_popup', name: 'Complete the meal',
    status: 'active', activeDays: [1,1,1,1,1,1,1], startTime: '00:00', endTime: '23:59',
    config: {
      maxPrompts: 2,
      prompts: [{
        id: 'p1', condition: 'has_breakfast_no_drink', suggestItemId: 'wc',
        headline: 'Complete your meal?', subline: 'Creamy, smooth · perfect pairing',
        socialProof: '89% of customers add a drink ☕',
      }],
    },
    priority: 5,
  }],
};

window.DEMO_CAMPAIGNS = DEMO_CAMPAIGNS;
