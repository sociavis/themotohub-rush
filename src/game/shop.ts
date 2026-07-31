import { T, rgba, tC } from './themes';
import { mxBike, setBikeBodyColor, setPartTier } from './bike';
import { achState, ACH_DEFS } from './achievements';
import type { RGB } from './types';
import * as THREE from 'three';

// ── Upgrade System ──

export interface UpgradeState {
  funds: number;
  tires: number;   // 0-3
  engine: number;   // 0-3
  gearbox: number;  // 0-3
  suspension: number; // 0-3
  bikeColor: number; // index into BIKE_COLORS
  ownedColors: Set<number>;
  prevUnlocked: number; // track previously counted achievements
}

const UPGRADE_COSTS = [100, 300, 600]; // cost for level 1, 2, 3
export const ACHIEVEMENT_REWARD = 75; // funds per achievement

export const BIKE_COLORS: { name: string; color: RGB }[] = [
  { name: 'MotoHub Red', color: [237, 47, 54] },
  { name: 'Factory Blue', color: [20, 90, 220] },
  { name: 'Team Green', color: [60, 175, 45] },
  { name: 'Moto Orange', color: [255, 90, 10] },
  { name: 'Retro Yellow', color: [245, 200, 20] },
  { name: 'Works White', color: [235, 232, 225] },
  { name: 'Magenta Works', color: [200, 30, 120] },
  { name: 'Stealth Black', color: [35, 35, 40] },
];

const COLOR_COSTS = [0, 150, 150, 200, 200, 250, 250, 300]; // cost per color

export const upgrades: UpgradeState = {
  funds: 0,
  tires: 0,
  engine: 0,
  gearbox: 0,
  suspension: 0,
  bikeColor: 0,
  ownedColors: new Set([0]), // default color is free
  prevUnlocked: 0,
};

// Load from localStorage
function loadUpgrades(): void {
  try {
    const saved = localStorage.getItem('mx_upgrades');
    if (saved) {
      const data = JSON.parse(saved);
      upgrades.funds = data.funds || 0;
      upgrades.tires = data.tires || 0;
      upgrades.engine = data.engine || 0;
      upgrades.gearbox = data.gearbox || 0;
      upgrades.suspension = data.suspension || 0;
      upgrades.bikeColor = data.bikeColor || 0;
      upgrades.ownedColors = new Set(data.ownedColors || [0]);
      upgrades.prevUnlocked = data.prevUnlocked || 0;
    }
  } catch {}
}

export function saveUpgrades(): void {
  try {
    localStorage.setItem('mx_upgrades', JSON.stringify({
      funds: upgrades.funds,
      tires: upgrades.tires,
      engine: upgrades.engine,
      gearbox: upgrades.gearbox,
      suspension: upgrades.suspension,
      bikeColor: upgrades.bikeColor,
      ownedColors: [...upgrades.ownedColors],
      prevUnlocked: upgrades.prevUnlocked,
    }));
  } catch {}
}

// Apply upgrades to bike stats
export function applyUpgrades(): void {
  // Base stats
  mxBike.maxSpeed = 16 + upgrades.engine * 2;      // 16, 18, 20, 22
  mxBike.accel = 12 + upgrades.gearbox * 2.5;      // 12, 14.5, 17, 19.5
  mxBike.turnSpeed = 3.8 + upgrades.tires * 0.4;   // 3.8, 4.2, 4.6, 5.0

  // Upgrade tier finishes on the actual bike parts
  setPartTier('tires', upgrades.tires);
  setPartTier('engine', upgrades.engine);
  setPartTier('gearbox', upgrades.gearbox);
  setPartTier('suspension', upgrades.suspension);

  // Apply bike color to all body plastics (and the rider's jersey)
  const col = BIKE_COLORS[upgrades.bikeColor].color;
  const c = new THREE.Color(col[0] / 255, col[1] / 255, col[2] / 255);
  setBikeBodyColor(c);
  for (const fn of bikeColorListeners) fn(c);
}

// Other modules (rider, previews) can react to bike color changes
const bikeColorListeners: ((c: THREE.Color) => void)[] = [];
export function onBikeColorChange(fn: (c: THREE.Color) => void): void {
  bikeColorListeners.push(fn);
}

// Get suspension bonus (reduces landing penalty, improves bump handling)
export function getSuspensionBonus(): number {
  return 1 + upgrades.suspension * 0.15; // 1.0, 1.15, 1.3, 1.45
}

// Get tire grip bonus (reduces cornering loss)
export function getTireGrip(): number {
  return 1 - upgrades.tires * 0.15; // 1.0, 0.85, 0.7, 0.55 — multiplied with cornering loss
}

// Check for new achievement funds
export function checkAchievementFunds(): void {
  const currentUnlocked = achState.unlocked.size;
  if (currentUnlocked > upgrades.prevUnlocked) {
    const newAchs = currentUnlocked - upgrades.prevUnlocked;
    upgrades.funds += newAchs * ACHIEVEMENT_REWARD;
    upgrades.prevUnlocked = currentUnlocked;
    saveUpgrades();
  }
}

// Purchase upgrade
export function buyUpgrade(category: 'tires' | 'engine' | 'gearbox' | 'suspension'): boolean {
  const currentLevel = upgrades[category];
  if (currentLevel >= 3) return false;
  const cost = UPGRADE_COSTS[currentLevel];
  if (upgrades.funds < cost) return false;
  upgrades.funds -= cost;
  upgrades[category]++;
  applyUpgrades();
  saveUpgrades();
  return true;
}

// Purchase bike color
export function buyColor(idx: number): boolean {
  if (upgrades.ownedColors.has(idx)) {
    upgrades.bikeColor = idx;
    applyUpgrades();
    saveUpgrades();
    return true;
  }
  const cost = COLOR_COSTS[idx];
  if (upgrades.funds < cost) return false;
  upgrades.funds -= cost;
  upgrades.ownedColors.add(idx);
  upgrades.bikeColor = idx;
  applyUpgrades();
  saveUpgrades();
  return true;
}

export function mergeServerUpgrades(serverDataStr: string): void {
  if (!serverDataStr) return;
  try {
    const data = JSON.parse(serverDataStr);
    // Take the maximum funds (don't lose money)
    upgrades.funds = Math.max(upgrades.funds, data.funds || 0);
    // Take the maximum upgrade levels
    upgrades.tires = Math.max(upgrades.tires, data.tires || 0);
    upgrades.engine = Math.max(upgrades.engine, data.engine || 0);
    upgrades.gearbox = Math.max(upgrades.gearbox, data.gearbox || 0);
    upgrades.suspension = Math.max(upgrades.suspension, data.suspension || 0);
    // Merge owned colors
    if (data.ownedColors) for (const c of data.ownedColors) upgrades.ownedColors.add(c);
    // Take bikeColor from server if it's owned
    if (data.bikeColor !== undefined && upgrades.ownedColors.has(data.bikeColor)) {
      upgrades.bikeColor = data.bikeColor;
    }
    // Take the max prevUnlocked
    upgrades.prevUnlocked = Math.max(upgrades.prevUnlocked, data.prevUnlocked || 0);
    saveUpgrades();
    applyUpgrades();
  } catch {}
}

export function getUpgradeSaveData(): object {
  return {
    funds: upgrades.funds,
    tires: upgrades.tires,
    engine: upgrades.engine,
    gearbox: upgrades.gearbox,
    suspension: upgrades.suspension,
    bikeColor: upgrades.bikeColor,
    ownedColors: [...upgrades.ownedColors],
    prevUnlocked: upgrades.prevUnlocked,
  };
}

// ── Shop UI ──

let shopOpen = false;

export function initShop(): void {
  loadUpgrades();
  applyUpgrades();

  const shopBtn = document.getElementById('shopBtn');
  const shopPanel = document.getElementById('shopPanel');
  if (!shopBtn || !shopPanel) return;

  shopBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleShop(); });
  shopBtn.addEventListener('touchstart', (e) => { e.stopPropagation(); e.preventDefault(); toggleShop(); }, { passive: false });
}

function toggleShop(): void {
  shopOpen = !shopOpen;
  const panel = document.getElementById('shopPanel')!;
  if (shopOpen) {
    renderShop();
    panel.classList.add('open');
    // Close other panels
    document.getElementById('profilePanel')?.classList.remove('open');
    document.getElementById('leaderboardPanel')?.classList.remove('open');
    document.getElementById('statsPanel')?.classList.remove('open');
  } else {
    panel.classList.remove('open');
  }
}

export function renderShop(): void {
  checkAchievementFunds();
  const panel = document.getElementById('shopPanel')!;
  const t = T();

  const categories = [
    { key: 'tires' as const, name: 'Tires', desc: ['Stock knobbies', 'Intermediate tread', 'Soft compound', 'Factory grip'] },
    { key: 'engine' as const, name: 'Engine', desc: ['Stock 250f', '250f ported', '350f bored', '450f race'] },
    { key: 'gearbox' as const, name: 'Gearing', desc: ['Stock gears', 'Close ratio', 'Works gears', 'Factory shift'] },
    { key: 'suspension' as const, name: 'Suspension', desc: ['Stock forks', 'Revalved forks', 'Race-tuned', 'Factory kit'] },
  ];

  let html = `<div class="panel-title" style="color:${rgba(t.primary, 0.8)}">SHOP</div>`;
  html += `<div class="panel-close" id="shopClose" style="color:${rgba(t.primary, 0.6)}">×</div>`;
  html += `<div class="shop-funds"><div class="shop-funds-label">AVAILABLE FUNDS</div><div class="shop-funds-val">◉ ${upgrades.funds}</div></div>`;

  for (const cat of categories) {
    const lvl = upgrades[cat.key];
    const nextCost = lvl < 3 ? UPGRADE_COSTS[lvl] : 0;
    const canBuy = lvl < 3 && upgrades.funds >= nextCost;

    html += `<div class="shop-category">`;
    html += `<div class="shop-cat-title" style="color:${rgba(t.primary, 0.7)}">${cat.name}</div>`;
    html += `<div class="shop-item">`;
    html += `<div class="shop-item-info"><div class="shop-item-name">${cat.desc[lvl]}</div>`;
    html += `<div class="shop-item-desc">${lvl < 3 ? 'Next: ' + cat.desc[lvl + 1] : 'MAX LEVEL'}</div>`;
    html += `<div class="shop-item-lvl">`;
    for (let i = 0; i < 3; i++) {
      html += `<div class="shop-lvl-pip${i < lvl ? ' filled' : ''}" style="${i < lvl ? 'background:' + rgba(t.primary, 1) : ''}"></div>`;
    }
    html += `</div></div>`;
    if (lvl < 3) {
      html += `<div class="shop-buy-btn${canBuy ? '' : ' owned'}" data-upgrade="${cat.key}">◉ ${nextCost}</div>`;
    } else {
      html += `<div class="shop-buy-btn owned">MAX</div>`;
    }
    html += `</div></div>`;
  }

  // Bike colors
  html += `<div class="shop-category"><div class="shop-cat-title" style="color:${rgba(t.primary, 0.7)}">BIKE COLOR</div>`;
  html += `<div class="shop-color-grid">`;
  for (let i = 0; i < BIKE_COLORS.length; i++) {
    const c = BIKE_COLORS[i];
    const owned = upgrades.ownedColors.has(i);
    const active = upgrades.bikeColor === i;
    const cost = COLOR_COSTS[i];
    html += `<div class="shop-color-swatch${owned ? ' owned' : ''}${active ? ' active' : ''}" data-color="${i}" style="background:rgb(${c.color.join(',')});${active ? 'box-shadow:0 0 10px rgb(' + c.color.join(',') + ')' : ''}" title="${c.name}${owned ? '' : ' — ' + cost}"></div>`;
  }
  html += `</div></div>`;

  panel.innerHTML = html;
  panel.style.borderColor = rgba(t.primary, 0.3);
  panel.style.color = rgba(t.secondary, 0.8);

  // Event listeners
  panel.querySelector('#shopClose')?.addEventListener('click', () => toggleShop());

  panel.querySelectorAll('.shop-buy-btn:not(.owned)').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const key = (e.target as HTMLElement).dataset.upgrade as 'tires' | 'engine' | 'gearbox' | 'suspension';
      if (key && buyUpgrade(key)) renderShop();
    });
  });

  panel.querySelectorAll('.shop-color-swatch').forEach(swatch => {
    swatch.addEventListener('click', (e) => {
      const idx = +(e.target as HTMLElement).dataset.color!;
      if (buyColor(idx)) renderShop();
    });
  });
}
