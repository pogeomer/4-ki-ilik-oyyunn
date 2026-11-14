/**
 * ============================================================================
 * 0. SENTETİK SES MOTORU (WEB AUDIO API - SIFIR HARİCİ DOSYA)
 * ============================================================================
 */
class SoundFX {
  static ctx = null;
  static muted = false;

  static init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  static play(type) {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.ctx.destination);

    if (type === 'shoot') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(110, now + 0.07);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.07);
      osc.start(now); osc.stop(now + 0.07);
    } else if (type === 'coin') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(980, now);
      osc.frequency.setValueAtTime(1320, now + 0.06);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.14);
      osc.start(now); osc.stop(now + 0.14);
    } else if (type === 'skill') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.exponentialRampToValueAtTime(620, now + 0.22);
      gain.gain.setValueAtTime(0.09, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.22);
      osc.start(now); osc.stop(now + 0.22);
    } else if (type === 'boss') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(95, now);
      osc.frequency.linearRampToValueAtTime(55, now + 0.45);
      gain.gain.setValueAtTime(0.14, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.45);
      osc.start(now); osc.stop(now + 0.45);
    }
  }
}

/**
 * ============================================================================
 * 1. SUPABASE BAĞLANTISI VE KAYIT YÖNETİCİSİ (EKİPMAN & KIŞLA DESTEKLİ)
 * ============================================================================
 */
const SUPABASE_URL = 'https://gzwjzfkqwypspmqxncqg.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_muXI5UcyGzPKnOcyB-RB2A_07QTs-fC';

const supabaseClient = SUPABASE_URL.startsWith('http')
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

class SaveManager {
  static STORAGE_KEY = 'CIRCLE_DEFENSE_PRO_V4';

  static getOrCreatePlayerId() {
    let pid = localStorage.getItem('CD_PLAYER_ID');
    if (!pid) {
      pid = 'cmd_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
      localStorage.setItem('CD_PLAYER_ID', pid);
    }
    return pid;
  }

  static getDefaultUpgrades() {
    return {
      PALADIN: { dmg: 0, spd: 0, spec: 0 },
      ARCHER: { dmg: 0, spd: 0, spec: 0 },
      FIRE_MAGE: { dmg: 0, spd: 0, spec: 0 },
      LIGHTNING_MAGE: { dmg: 0, spd: 0, spec: 0 },
      BASE: { hp: 0, armor: 0 },
      INVENTORY: { owned: [], equipped: [] } // Satın alınan ve kuşanılan ekipmanlar
    };
  }

  static normalizeUpgrades(rawUpg) {
    const def = this.getDefaultUpgrades();
    if (!rawUpg) return def;
    // Eski SWORDSMAN kaydı varsa PALADIN'e aktar
    const paladinData = rawUpg.PALADIN || rawUpg.SWORDSMAN || def.PALADIN;
    return {
      PALADIN: { ...def.PALADIN, ...paladinData },
      ARCHER: { ...def.ARCHER, ...(rawUpg.ARCHER || {}) },
      FIRE_MAGE: { ...def.FIRE_MAGE, ...(rawUpg.FIRE_MAGE || {}) },
      LIGHTNING_MAGE: { ...def.LIGHTNING_MAGE, ...(rawUpg.LIGHTNING_MAGE || {}) },
      BASE: { ...def.BASE, ...(rawUpg.BASE || {}) },
      INVENTORY: {
        owned: Array.isArray(rawUpg.INVENTORY?.owned) ? rawUpg.INVENTORY.owned : [],
        equipped: Array.isArray(rawUpg.INVENTORY?.equipped) ? rawUpg.INVENTORY.equipped.slice(0, 3) : []
      }
    };
  }

  static getDefaultData() {
    return {
      playerId: this.getOrCreatePlayerId(),
      nickname: 'Komutan_' + Math.floor(100 + Math.random() * 899),
      gold: 0,
      bestWave: 1,
      totalKills: 0,
      upgrades: this.getDefaultUpgrades(),
      activeRun: null
    };
  }

  static loadLocal() {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY) || localStorage.getItem('CIRCLE_DEFENSE_HARDCORE_V3');
      if (!raw) return this.getDefaultData();
      const parsed = JSON.parse(raw);
      return {
        ...this.getDefaultData(),
        ...parsed,
        upgrades: this.normalizeUpgrades(parsed.upgrades)
      };
    } catch (e) {
      return this.getDefaultData();
    }
  }

  static saveLocal(data) {
    try { localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data)); } catch (e) {}
  }

  static async save(data) {
    this.saveLocal(data);
    const badge = document.getElementById('cloudStatus');
    if (!supabaseClient) return;

    try {
      if (badge) { badge.textContent = '⏳ Kaydediliyor...'; badge.style.color = '#38bdf8'; }
      const { error } = await supabaseClient
        .from('player_saves')
        .upsert({
          player_id: data.playerId,
          nickname: data.nickname,
          gold: data.gold,
          best_wave: data.bestWave,
          total_kills: data.totalKills,
          upgrades: data.upgrades,
          active_run: data.activeRun,
          updated_at: new Date().toISOString()
        }, { onConflict: 'player_id' });

      if (error) throw error;
      if (badge) { badge.textContent = '☁️ Supabase Senkronize'; badge.style.color = '#4ade80'; }
    } catch (err) {
      if (badge) { badge.textContent = '⚠️ Yerel Kayıt Aktif'; badge.style.color = '#fbbf24'; }
    }
  }

  static async syncFromCloud(localData) {
    if (!supabaseClient) return localData;
    try {
      const { data, error } = await supabaseClient
        .from('player_saves')
        .select('*')
        .eq('player_id', localData.playerId)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        const merged = {
          playerId: data.player_id,
          nickname: data.nickname || localData.nickname,
          gold: Math.max(data.gold, localData.gold),
          bestWave: Math.max(data.best_wave, localData.bestWave),
          totalKills: Math.max(data.total_kills, localData.totalKills),
          upgrades: this.normalizeUpgrades(data.upgrades || localData.upgrades),
          activeRun: data.active_run || localData.activeRun
        };
        this.saveLocal(merged);
        return merged;
      } else {
        await this.save(localData);
        return localData;
      }
    } catch (e) {
      return localData;
    }
  }

  static async fetchLeaderboard() {
    const box = document.getElementById('leaderboardBox');
    if (!supabaseClient) return;
    try {
      const { data, error } = await supabaseClient
        .from('player_saves')
        .select('nickname, best_wave, total_kills')
        .order('best_wave', { ascending: false })
        .order('total_kills', { ascending: false })
        .limit(10);

      if (error) throw error;
      if (!data || data.length === 0) {
        box.innerHTML = `<div class="lb-row"><span>Henüz kayıtlı komutan yok. İlk sen ol!</span></div>`;
        return;
      }
      box.innerHTML = data.map((row, idx) => `
        <div class="lb-row">
          <span><b>#${idx + 1}</b> ${row.nickname}</span>
          <span>🏆 Dalga <b>${row.best_wave}</b> | 💀 ${row.total_kills} Leş</span>
        </div>
      `).join('');
    } catch (e) {
      box.innerHTML = `<div class="lb-row"><span>Liderlik tablosu yüklenemedi.</span></div>`;
    }
  }
}

let playerSave = SaveManager.loadLocal();

/**
 * ============================================================================
 * 2. YENİLENMİŞ 4 KARAKTER SINIFI (PALADİN DAHİL) & ÇİFT AKTİF YETENEK
 * ============================================================================
 */
const HERO_CONFIGS = {
  PALADIN: {
    type: 'PALADIN', name: 'Kutsal Paladin', icon: '🛡️', color: '#38bdf8',
    role: 'Kutsal Tank & Şifacı',
    desc: 'Kutsal çekicini fırlatır, yaklaşanları iter ve her 4. vuruşunda Mevziyi otomatik iyileştirir!',
    skill1Name: '[Q] Kutsal İnfaz', skill1Icon: '🔨',
    skill2Name: '[E] İlahi Kalkan (4sn Dokunulmazlık)', skill2Icon: '✨',
    range: 195, damage: 30, cooldown: 0.8, aoeRadius: 62, stunDuration: 0.3, knockback: 28, projSpeed: 500
  },
  ARCHER: {
    type: 'ARCHER', name: 'Gölge Okçusu', icon: '🏹', color: '#4ade80',
    role: 'Uzun Menzil / Nişancı',
    desc: 'Uzaktaki hedeflere yüksek hızda zırh delici oklar gönderir.',
    skill1Name: '[Q] Ok Yağmuru', skill1Icon: '🏹',
    skill2Name: '[E] Gölge Yaylımı (5sn 3x Hız)', skill2Icon: '💨',
    range: 345, damage: 19, cooldown: 0.42, aoeRadius: 0, stunDuration: 0, knockback: 5, projSpeed: 750
  },
  FIRE_MAGE: {
    type: 'FIRE_MAGE', name: 'Ateş Büyücüsü', icon: '🔥', color: '#fb923c',
    role: 'Yıkıcı Alan Hasarı (AoE)',
    desc: 'Sürüleri yakar. Sersemlemiş düşmana %50 KRİTİK vurur!',
    skill1Name: '[Q] Kıyamet Meteoru', skill1Icon: '☄️',
    skill2Name: '[E] Lav Halkası (Çemberi Yakar)', skill2Icon: '🌋',
    range: 270, damage: 36, cooldown: 1.55, aoeRadius: 80, stunDuration: 0, knockback: 10, projSpeed: 400
  },
  LIGHTNING_MAGE: {
    type: 'LIGHTNING_MAGE', name: 'Fırtına Büyücüsü', icon: '⚡', color: '#c084fc',
    role: 'Kitle Kontrol & Girdap',
    desc: 'Düşman gruplarını elektrikle çarparak sersemletir.',
    skill1Name: '[Q] Zincirleme Yıldırım', skill1Icon: '⚡',
    skill2Name: '[E] Manyetik Girdap (Vakum)', skill2Icon: '🌀',
    range: 255, damage: 16, cooldown: 1.35, aoeRadius: 65, stunDuration: 1.2, knockback: 0, projSpeed: 640
  }
};

/**
 * ============================================================================
 * 3. KIŞLA MAĞAZA AĞACI VE CEPHANELİK (EKİPMAN MARKETİ)
 * ============================================================================
 */
const SHOP_TREE = {
  PALADIN: {
    label: '🛡️ Kutsal Paladin',
    items: [
      { key: 'dmg', name: 'Adalet Çekici', desc: 'Seviye başı +%8 Çekiç Hasarı', baseCost: 20, costMult: 1.6, maxLvl: 10 },
      { key: 'spd', name: 'Kutsal Coşku', desc: 'Seviye başı +%5 Saldırı Hızı', baseCost: 25, costMult: 1.65, maxLvl: 10 },
      { key: 'spec', name: 'Şifa Işığı', desc: 'Her 4. vuruştaki Mevzi şifasını +2 artırır ve geri itmeyi güçlendirir', baseCost: 30, costMult: 1.75, maxLvl: 10 }
    ]
  },
  ARCHER: {
    label: '🏹 Gölge Okçusu',
    items: [
      { key: 'dmg', name: 'Ejder Kemiği Oklar', desc: 'Seviye başı +%8 Ok Hasarı', baseCost: 20, costMult: 1.6, maxLvl: 10 },
      { key: 'spd', name: 'Çevik Kiriş', desc: 'Seviye başı +%5 Atış Hızı', baseCost: 25, costMult: 1.65, maxLvl: 10 },
      { key: 'spec', name: 'Şahin Gözü', desc: 'Seviye başı +20 Menzil', baseCost: 30, costMult: 1.7, maxLvl: 10 }
    ]
  },
  FIRE_MAGE: {
    label: '🔥 Ateş Büyücüsü',
    items: [
      { key: 'dmg', name: 'Güneş Çekirdeği', desc: 'Seviye başı +%8 Ateş Hasarı', baseCost: 20, costMult: 1.6, maxLvl: 10 },
      { key: 'spd', name: 'Alev Akışı', desc: 'Seviye başı +%5 Büyü Hızı', baseCost: 25, costMult: 1.65, maxLvl: 10 },
      { key: 'spec', name: 'Süpernova', desc: 'Seviye başı +8 Patlama Çapı (AoE)', baseCost: 35, costMult: 1.75, maxLvl: 10 }
    ]
  },
  LIGHTNING_MAGE: {
    label: '⚡ Fırtına Büyücüsü',
    items: [
      { key: 'dmg', name: 'Yüksek Voltaj', desc: 'Seviye başı +%8 Şimşek Hasarı', baseCost: 20, costMult: 1.6, maxLvl: 10 },
      { key: 'spd', name: 'İyon Fırtınası', desc: 'Seviye başı +%5 Saldırı Hızı', baseCost: 25, costMult: 1.65, maxLvl: 10 },
      { key: 'spec', name: 'Kalıcı Felç', desc: 'Seviye başı +0.15 sn Sersemletme Süresi', baseCost: 35, costMult: 1.8, maxLvl: 10 }
    ]
  },
  BASE: {
    label: '🏰 Mevzi & Kale',
    items: [
      { key: 'hp', name: 'Granit Surlar', desc: 'Seviye başı +35 Maksimum Mevzi Canı', baseCost: 18, costMult: 1.55, maxLvl: 10 },
      { key: 'armor', name: 'Büyülü Bariyer', desc: 'Mevziye gelen tüm hasarı seviye başı %4 azaltır', baseCost: 30, costMult: 1.75, maxLvl: 10 }
    ]
  }
};

// CEPHANELİK: Satın Alınıp Kuşanılabilen (Equip) 8 Efsanevi Ekipman
const EQUIPMENT_ITEMS = [
  { id: 'vampire_fang', name: '🧛 Vampir Dişi', cost: 45, desc: 'Öldürülen her 12 düşmanda bir Mevzi +6 Can yeniler.' },
  { id: 'midas_ring', name: '💍 Midas Yüzüğü', cost: 60, desc: 'Canavarlardan altın düşme şansını %40 artırır!' },
  { id: 'war_horn', name: '📯 Savaş Borusu', cost: 55, desc: 'Tüm takımın (Sen + 3 Bot) saldırı hızını %12 artırır.' },
  { id: 'arcane_lens', name: '🔮 Büyü Merceği', cost: 50, desc: 'Tüm alan hasarı (AoE) çaplarını ve menzilleri %15 büyütür.' },
  { id: 'thorn_shield', name: '🌵 Dikenli Kalkan', cost: 40, desc: 'Mevziye çarpan düşmanların hasarını %15 kırar.' },
  { id: 'chrono_hourglass', name: '⏳ Zaman Kumsaati', cost: 75, desc: '[Q], [E] ve [R] yeteneklerinin bekleme süresini %20 kısaltır!' },
  { id: 'giant_slayer', name: '🗡️ Dev Katili', cost: 70, desc: 'Tank ve Boss canavarlarına +%30 ekstra hasar verir!' },
  { id: 'holy_grail', name: '🏆 Kutsal Kadeh', cost: 90, desc: 'Her dalga sonunda Mevziye otomatik +25 Can onarımı yapar.' }
];

function hasEquip(id) {
  return playerSave.upgrades.INVENTORY.equipped.includes(id);
}

/**
 * ============================================================================
 * 4. KONTROLCÜLER VE VARLIKLAR
 * ============================================================================
 */
class AIController {
  getTargetDirection(hero, enemies, focusTarget) {
    if (focusTarget && focusTarget.hp > 0) {
      const d = Math.hypot(focusTarget.x - hero.x, focusTarget.y - hero.y);
      if (d <= hero.getEffectiveRange()) return { x: (focusTarget.x - hero.x) / d, y: (focusTarget.y - hero.y) / d };
    }
    let target = null, minDistance = hero.getEffectiveRange();
    for (const e of enemies) {
      const dist = Math.hypot(e.x - hero.x, e.y - hero.y);
      if (dist <= minDistance) { minDistance = dist; target = e; }
    }
    if (!target) return null;
    const dx = target.x - hero.x, dy = target.y - hero.y, mag = Math.hypot(dx, dy) || 1;
    return { x: dx / mag, y: dy / mag };
  }
}

class PlayerController {
  constructor() { this.aimPos = null; this.aiFallback = new AIController(); }
  setAimWorldPos(pos) { this.aimPos = pos; }
  getTargetDirection(hero, enemies, focusTarget) {
    if (this.aimPos) {
      const dx = this.aimPos.x - hero.x, dy = this.aimPos.y - hero.y, mag = Math.hypot(dx, dy) || 1;
      return { x: dx / mag, y: dy / mag };
    }
    return this.aiFallback.getTargetDirection(hero, enemies, focusTarget);
  }
}

class Hero {
  constructor(slotAngle, stats, controller, isPlayer, engine) {
    this.slotAngle = slotAngle;
    this.x = 0; this.y = 0;
    this.stats = { ...stats };
    this.controller = controller;
    this.isPlayer = isPlayer;
    this.engine = engine;
    this.cooldownTimer = 0;
    this.attackCount = 0;
    this.buffTimer = 0; // [E] yeteneği güçlendirme süresi
    this.aimDir = { x: Math.cos(slotAngle), y: Math.sin(slotAngle) };

    const upg = playerSave.upgrades[this.stats.type] || { dmg: 0, spd: 0, spec: 0 };
    this.stats.damage = Math.round(this.stats.damage * (1 + upg.dmg * 0.08));
    this.stats.cooldown *= Math.pow(0.95, upg.spd);

    if (this.stats.type === 'PALADIN') {
      this.stats.knockback += upg.spec * 6;
      this.paladinHealAmount = 3 + upg.spec * 2;
    } else if (this.stats.type === 'ARCHER') {
      this.stats.range += upg.spec * 20;
    } else if (this.stats.type === 'FIRE_MAGE') {
      this.stats.aoeRadius += upg.spec * 8;
    } else if (this.stats.type === 'LIGHTNING_MAGE') {
      this.stats.stunDuration += upg.spec * 0.15;
    }

    // Ekipman Bonusları
    if (hasEquip('war_horn')) this.stats.cooldown *= 0.88;
    if (hasEquip('arcane_lens')) {
      this.stats.range = Math.round(this.stats.range * 1.15);
      this.stats.aoeRadius = Math.round(this.stats.aoeRadius * 1.15);
    }

    if (this.isPlayer) {
      this.stats.damage = Math.round(this.stats.damage * 1.25);
      this.stats.cooldown *= 0.85;
    }
  }

  getEffectiveRange() {
    const formMult = this.engine.formation === 'ATTACK' ? 1.25 : (this.engine.formation === 'DEFENSE' ? 0.85 : 1.0);
    return this.stats.range * formMult;
  }

  getEffectiveCooldown() {
    let cd = this.stats.cooldown * (this.engine.formation === 'ATTACK' ? 0.78 : 1.0);
    if (this.buffTimer > 0 && this.stats.type === 'ARCHER') cd *= 0.35; // Gölge Yaylımı: 3x Hız!
    return cd;
  }

  updatePosition(rotationOffset) {
    const currentAngle = this.slotAngle + rotationOffset;
    const formRadiusMult = this.engine.formation === 'ATTACK' ? 0.92 : (this.engine.formation === 'DEFENSE' ? 0.45 : 0.68);
    const r = this.engine.safeZoneRadius * formRadiusMult;
    this.x = Math.cos(currentAngle) * r;
    this.y = Math.sin(currentAngle) * r;
  }

  update(dt, enemies, focusTarget) {
    if (this.cooldownTimer > 0) this.cooldownTimer -= dt;
    if (this.buffTimer > 0) this.buffTimer -= dt;

    const dir = this.controller.getTargetDirection(this, enemies, focusTarget);
    if (dir) {
      this.aimDir = dir;
      if (this.cooldownTimer <= 0) {
        this.attackCount++;
        // Kutsal Paladin Pasifi: Her 4. vuruşta Mevziyi iyileştirir!
        if (this.stats.type === 'PALADIN' && this.attackCount % 4 === 0) {
          this.engine.healBase(this.paladinHealAmount || 3);
        }
        this.engine.spawnProjectile(this, dir, false);
        this.cooldownTimer = this.getEffectiveCooldown();
      }
    }
  }
}

class Enemy {
  constructor(x, y, type, scale) {
    this.x = x; this.y = y; this.type = type;
    const goldChanceMult = hasEquip('midas_ring') ? 1.4 : 1.0;

    if (type === 'SWARM') {
      this.hp = 68 * scale; this.speed = 104; this.radius = 12; this.color = '#f43f5e'; this.damage = 10;
      this.goldValue = Math.random() < (0.07 * goldChanceMult) ? 1 : 0;
    } else if (type === 'TANK') {
      this.hp = 540 * scale; this.speed = 42; this.radius = 24; this.color = '#a855f7'; this.damage = 30;
      this.goldValue = Math.random() < (0.65 * goldChanceMult) ? (2 + Math.floor(Math.random() * 2)) : 0;
    } else if (type === 'BOSS') {
      this.hp = 1900 * scale; this.speed = 28; this.radius = 36; this.color = '#eab308'; this.damage = 65;
      this.goldValue = 14;
    } else {
      this.hp = 155 * scale; this.speed = 64; this.radius = 16; this.color = '#ef4444'; this.damage = 16;
      this.goldValue = Math.random() < (0.13 * goldChanceMult) ? 1 : 0;
    }
    this.maxHp = this.hp;
    this.stunTimer = 0;
  }

  update(dt, vortexPos) {
    if (this.stunTimer > 0) { this.stunTimer -= dt; return; }
    // Eğer Şimşek Büyücüsünün [E] Manyetik Girdabı aktifse düşmanlar girdaba çekilir!
    if (vortexPos && this.type !== 'BOSS') {
      const dx = vortexPos.x - this.x, dy = vortexPos.y - this.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < 260) {
        this.x += (dx / d) * 150 * dt;
        this.y += (dy / d) * 150 * dt;
        return;
      }
    }
    const dist = Math.hypot(this.x, this.y) || 1;
    this.x -= (this.x / dist) * this.speed * dt;
    this.y -= (this.y / dist) * this.speed * dt;
  }
}

/**
 * ============================================================================
 * 5. ANA OYUN MOTORU (ÇİFT YETENEK, EKİPMAN, KOMBO VE EKRAN SARSINTISI)
 * ============================================================================
 */
class GameEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.worldSize = 850;
    this.viewScale = 1;
    this.centerX = 0; this.centerY = 0;

    this.safeZoneRadius = 90;
    this.formation = 'BALANCED';
    this.baseHp = 100;
    this.maxBaseHp = 100;
    this.invulnerableTimer = 0; // Paladin [E] İlahi Kalkan süresi
    this.lavaRingTimer = 0;     // Ateş Büyücüsü [E] Lav Halkası süresi
    this.vortex = null;         // Şimşek Büyücüsü [E] Manyetik Girdap objesi

    this.kills = 0;
    this.runGoldEarned = 0;
    this.comboCount = 0;
    this.comboTimer = 0;
    this.screenShake = 0;

    this.wave = 1;
    this.selectedClass = 'PALADIN';
    this.waveEnemiesRemaining = 0;
    this.bossSpawnedThisWave = false;
    this.spawnTimer = 0;

    this.rotationOffset = 0;
    this.targetRotationOffset = 0;

    this.heroes = [];
    this.enemies = [];
    this.projectiles = [];
    this.effects = [];
    this.floatingTexts = [];
    this.focusTarget = null;

    this.playerController = new PlayerController();
    this.playerHero = null;
    this.skill1Cooldown = 0;
    this.skill2Cooldown = 0;
    this.ultiCooldown = 0;
    this.paused = true;

    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.bindInputs();
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = window.innerWidth * dpr;
    this.canvas.height = window.innerHeight * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.centerX = window.innerWidth / 2;
    this.centerY = window.innerHeight / 2;
    this.viewScale = Math.min(window.innerWidth, window.innerHeight) / this.worldSize;
  }

  screenToWorld(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left - this.centerX) / this.viewScale,
      y: (clientY - rect.top - this.centerY) / this.viewScale
    };
  }

  healBase(amount) {
    if (this.baseHp <= 0) return;
    this.baseHp = Math.min(this.maxBaseHp, this.baseHp + amount);
    this.addFloatingText(0, -30, `+${amount} 💚 ŞİFA`, '#4ade80');
    this.updateHUD();
  }

  setFormation(form) {
    this.formation = form;
    document.getElementById('formDef').classList.toggle('active', form === 'DEFENSE');
    document.getElementById('formBal').classList.toggle('active', form === 'BALANCED');
    document.getElementById('formAtk').classList.toggle('active', form === 'ATTACK');
    const msg = form === 'DEFENSE' ? '🛡️ KALKAN DÜZENİ!' : (form === 'ATTACK' ? '⚔️ TAARRUZ DÜZENİ!' : '⚖️ DENGELİ DÜZEN');
    this.addFloatingText(0, -this.safeZoneRadius - 20, msg, '#38bdf8');
  }

  startWithHero(selectedClass, resumeState = null) {
    if (!HERO_CONFIGS[selectedClass]) selectedClass = 'PALADIN';
    this.selectedClass = selectedClass;
    this.runGoldEarned = 0;
    this.comboCount = 0;
    const allOrder = ['PALADIN', 'ARCHER', 'FIRE_MAGE', 'LIGHTNING_MAGE'];
    const ordered = [selectedClass, ...allOrder.filter(c => c !== selectedClass)];

    const baseUpg = playerSave.upgrades.BASE || { hp: 0, armor: 0 };
    this.maxBaseHp = 100 + (baseUpg.hp * 35);
    this.baseHp = resumeState ? resumeState.baseHp : this.maxBaseHp;
    this.kills = resumeState ? resumeState.kills : 0;

    this.heroes = ordered.map((cls, idx) => {
      const angle = (idx * Math.PI) / 2;
      const isPlayer = idx === 0;
      const ctrl = isPlayer ? this.playerController : new AIController();
      const h = new Hero(angle, HERO_CONFIGS[cls], ctrl, isPlayer, this);
      if (isPlayer) this.playerHero = h;
      return h;
    });

    document.getElementById('skill1Icon').textContent = this.playerHero.stats.skill1Icon;
    document.getElementById('skill2Icon').textContent = this.playerHero.stats.skill2Icon;
    this.startWave(resumeState ? resumeState.wave : 1);
    this.paused = false;
    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  startWave(waveNum) {
    this.wave = waveNum;
    this.waveEnemiesRemaining = 12 + waveNum * 7;
    this.bossSpawnedThisWave = false;
    this.spawnTimer = 0.4;

    if (this.wave > playerSave.bestWave) playerSave.bestWave = this.wave;
    playerSave.activeRun = {
      selectedClass: this.selectedClass,
      wave: this.wave,
      baseHp: this.baseHp,
      kills: this.kills
    };
    SaveManager.save(playerSave);
    this.updateHUD();
  }

  rotateCircle(dir) { this.targetRotationOffset += dir * (Math.PI / 4); }

  getCooldownMult() {
    return hasEquip('chrono_hourglass') ? 0.8 : 1.0;
  }

  // 1. AKTİF YETENEK [Q]
  triggerSkill1() {
    if (this.skill1Cooldown > 0 || !this.playerHero || this.paused) return;
    this.skill1Cooldown = 5.5 * this.getCooldownMult();
    SoundFX.play('skill');
    this.screenShake = 8;
    const h = this.playerHero, dir = h.aimDir;

    if (h.stats.type === 'PALADIN') {
      this.healBase(20);
      this.effects.push({ x: 0, y: 0, radius: this.safeZoneRadius + 105, color: '#38bdf8', life: 0.4 });
      for (const e of this.enemies) {
        const d = Math.hypot(e.x, e.y);
        if (d <= this.safeZoneRadius + 105) {
          e.hp -= h.stats.damage * 2.0; e.stunTimer = 1.6;
          e.x += (e.x / (d || 1)) * 95; e.y += (e.y / (d || 1)) * 95;
        }
      }
      this.addFloatingText(0, -50, '🔨 KUTSAL İNFAZ (+20 CAN)!', '#38bdf8');
    } else if (h.stats.type === 'ARCHER') {
      for (let i = -4; i <= 4; i++) {
        const spread = i * 0.11, cos = Math.cos(spread), sin = Math.sin(spread);
        const rDir = { x: dir.x * cos - dir.y * sin, y: dir.x * sin + dir.y * cos };
        this.projectiles.push({
          x: h.x, y: h.y, vx: rDir.x * 800, vy: rDir.y * 800,
          distTraveled: 0, maxRange: 440, damage: h.stats.damage * 1.6,
          aoeRadius: 42, stunDuration: 0.3, knockback: 14, color: '#4ade80', heroType: 'ARCHER'
        });
      }
      this.addFloatingText(h.x, h.y - 30, '🏹 OK YAĞMURU!', '#4ade80');
    } else if (h.stats.type === 'FIRE_MAGE') {
      const targetX = h.x + dir.x * 200, targetY = h.y + dir.y * 200;
      this.effects.push({ x: targetX, y: targetY, radius: 150, color: '#f97316', life: 0.45 });
      for (const e of this.enemies) {
        if (Math.hypot(e.x - targetX, e.y - targetY) <= 150 + e.radius) {
          e.hp -= h.stats.damage * 2.5;
        }
      }
      this.addFloatingText(targetX, targetY - 40, '☄️ KIYAMET METEORU!', '#fb923c');
    } else if (h.stats.type === 'LIGHTNING_MAGE') {
      const sorted = [...this.enemies].sort((a, b) => Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y)).slice(0, 8);
      sorted.forEach(e => {
        e.hp -= h.stats.damage * 2.1; e.stunTimer = 2.2;
        this.effects.push({ x: e.x, y: e.y, radius: 48, color: '#c084fc', life: 0.35 });
      });
      this.addFloatingText(h.x, h.y - 30, '⚡ ZİNCİRLEME YILDIRIM!', '#c084fc');
    }
  }

  // 2. TAKTİKSEL SINIF YETENEĞİ [E]
  triggerSkill2() {
    if (this.skill2Cooldown > 0 || !this.playerHero || this.paused) return;
    this.skill2Cooldown = 9.0 * this.getCooldownMult();
    SoundFX.play('skill');
    const h = this.playerHero, dir = h.aimDir;

    if (h.stats.type === 'PALADIN') {
      this.invulnerableTimer = 4.0;
      this.addFloatingText(0, -65, '✨ İLAHİ KALKAN (4 SN DOKUNULMAZLIK)!', '#fde047');
    } else if (h.stats.type === 'ARCHER') {
      h.buffTimer = 5.0;
      this.addFloatingText(h.x, h.y - 40, '💨 GÖLGE YAYLIMI (3X HIZ)!', '#4ade80');
    } else if (h.stats.type === 'FIRE_MAGE') {
      this.lavaRingTimer = 4.5;
      this.addFloatingText(0, -65, '🌋 LAV HALKASI AKTİF!', '#fb923c');
    } else if (h.stats.type === 'LIGHTNING_MAGE') {
      this.vortex = { x: dir.x * 210, y: dir.y * 210, timer: 4.0 };
      this.addFloatingText(this.vortex.x, this.vortex.y - 35, '🌀 MANYETİK GİRDAP!', '#c084fc');
    }
  }

  // TAM TAKIM KOMUTAN ULTİSİ [R]
  triggerUltimate() {
    if (this.ultiCooldown > 0 || !this.playerHero || this.paused) return;
    this.ultiCooldown = 12.0 * this.getCooldownMult();
    SoundFX.play('skill');
    this.screenShake = 14;
    for (const h of this.heroes) {
      for (let i = 0; i < 10; i++) {
        const ang = (i * Math.PI * 2) / 10;
        this.spawnProjectile(h, { x: Math.cos(ang), y: Math.sin(ang) }, true);
      }
    }
    this.addFloatingText(0, -75, '🔥 TAM TAKIM ULTİ YAYLIM ATEŞİ!', '#fde047');
  }

  spawnProjectile(hero, dir, isUlti) {
    SoundFX.play('shoot');
    const s = hero.stats;
    const comboMult = 1 + Math.min(0.5, this.comboCount * 0.02);
    this.projectiles.push({
      x: hero.x, y: hero.y,
      vx: dir.x * s.projSpeed, vy: dir.y * s.projSpeed,
      distTraveled: 0,
      maxRange: isUlti ? hero.getEffectiveRange() * 1.35 : hero.getEffectiveRange(),
      damage: (isUlti ? s.damage * 1.5 : s.damage) * comboMult,
      aoeRadius: isUlti ? Math.max(50, s.aoeRadius * 1.3) : s.aoeRadius,
      stunDuration: s.stunDuration, knockback: s.knockback, color: s.color, heroType: s.type
    });
  }

  spawnEnemy() {
    const angle = Math.random() * Math.PI * 2;
    const spawnDist = (this.worldSize * 0.5) + 35;
    const x = Math.cos(angle) * spawnDist, y = Math.sin(angle) * spawnDist;
    const scale = Math.pow(1.26, this.wave - 1);

    if (this.wave % 5 === 0 && !this.bossSpawnedThisWave) {
      this.bossSpawnedThisWave = true;
      SoundFX.play('boss');
      this.screenShake = 12;
      this.enemies.push(new Enemy(x, y, 'BOSS', scale));
      this.addFloatingText(0, -120, '⚠️ KUŞATMA GOLEMİ (BOSS) GELDİ!', '#eab308');
      return;
    }

    let type = 'NORMAL';
    const r = Math.random();
    if (r < 0.35) type = 'SWARM';
    else if (this.wave >= 2 && r > 0.76) type = 'TANK';

    this.enemies.push(new Enemy(x, y, type, scale));
  }

  update(dt) {
    this.rotationOffset += (this.targetRotationOffset - this.rotationOffset) * Math.min(1, dt * 10);
    if (this.screenShake > 0) this.screenShake = Math.max(0, this.screenShake - dt * 30);

    // Kombo sayacı
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) { this.comboCount = 0; this.updateHUD(); }
    }

    // Aktif Alan Yetenekleri (İlahi Kalkan, Lav Halkası, Manyetik Girdap)
    if (this.invulnerableTimer > 0) this.invulnerableTimer = Math.max(0, this.invulnerableTimer - dt);
    if (this.lavaRingTimer > 0) {
      this.lavaRingTimer = Math.max(0, this.lavaRingTimer - dt);
      for (const e of this.enemies) {
        if (Math.hypot(e.x, e.y) <= this.safeZoneRadius + 55) {
          e.hp -= 55 * dt;
        }
      }
    }
    if (this.vortex) {
      this.vortex.timer -= dt;
      if (this.vortex.timer <= 0) this.vortex = null;
    }

    // Buton Cooldown Güncellemeleri
    const updateBtn = (cd, btnId, txtId, readyLbl) => {
      document.getElementById(btnId).classList.toggle('cooldown', cd > 0);
      document.getElementById(txtId).textContent = cd > 0 ? cd.toFixed(1) + 's' : readyLbl;
    };
    this.skill1Cooldown = Math.max(0, this.skill1Cooldown - dt);
    this.skill2Cooldown = Math.max(0, this.skill2Cooldown - dt);
    this.ultiCooldown = Math.max(0, this.ultiCooldown - dt);
    updateBtn(this.skill1Cooldown, 'btnSkill1', 'skill1Timer', 'YETENEK 1 [Q]');
    updateBtn(this.skill2Cooldown, 'btnSkill2', 'skill2Timer', 'YETENEK 2 [E]');
    updateBtn(this.ultiCooldown, 'btnUlti', 'ultiTimer', 'HAZIR [R]');

    if (this.waveEnemiesRemaining > 0) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnEnemy();
        this.waveEnemiesRemaining--;
        this.spawnTimer = Math.max(0.22, 0.95 - this.wave * 0.06);
      }
    } else if (this.enemies.length === 0) {
      playerSave.gold += 3;
      this.runGoldEarned += 3;
      if (hasEquip('holy_grail')) this.healBase(25);
      this.openUpgradeModal();
      return;
    }

    for (const h of this.heroes) {
      h.updatePosition(this.rotationOffset);
      h.update(dt, this.enemies, this.focusTarget);
    }

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      const sx = p.vx * dt, sy = p.vy * dt;
      p.x += sx; p.y += sy;
      p.distTraveled += Math.hypot(sx, sy);

      let hitEnemy = null;
      for (const e of this.enemies) {
        if (Math.hypot(e.x - p.x, e.y - p.y) <= e.radius + 9) { hitEnemy = e; break; }
      }
      if (hitEnemy || p.distTraveled >= p.maxRange) {
        if (hitEnemy || p.aoeRadius > 0) this.applyDamage(p, hitEnemy);
        this.projectiles.splice(i, 1);
      }
    }

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      e.update(dt, this.vortex);

      if (e.hp <= 0) {
        if (this.focusTarget === e) this.focusTarget = null;
        this.enemies.splice(i, 1);
        this.kills++;
        playerSave.totalKills++;
        this.comboCount++;
        this.comboTimer = 3.5;

        // Vampir Dişi Ekipmanı: Her 12 leşte +6 Can
        if (hasEquip('vampire_fang') && this.kills % 12 === 0) this.healBase(6);

        if (e.goldValue > 0) {
          SoundFX.play('coin');
          playerSave.gold += e.goldValue;
          this.runGoldEarned += e.goldValue;
          this.addFloatingText(e.x, e.y, `+${e.goldValue} 🪙`, '#fde047');
        }
        SaveManager.saveLocal(playerSave);
        this.updateHUD();
        continue;
      }

      if (Math.hypot(e.x, e.y) <= this.safeZoneRadius) {
        if (this.invulnerableTimer > 0) {
          this.addFloatingText(e.x, e.y, '🛡️ KORUNDU!', '#fde047');
          this.enemies.splice(i, 1);
          continue;
        }
        const armorLvl = (playerSave.upgrades.BASE && playerSave.upgrades.BASE.armor) || 0;
        let armorMult = Math.max(0.45, 1 - armorLvl * 0.04);
        if (hasEquip('thorn_shield')) armorMult *= 0.85;

        const formMult = this.formation === 'DEFENSE' ? 0.7 : (this.formation === 'ATTACK' ? 1.25 : 1.0);
        const finalDmg = Math.max(1, Math.round(e.damage * formMult * armorMult));

        this.baseHp = Math.max(0, this.baseHp - finalDmg);
        this.screenShake = 6;
        this.addFloatingText(e.x, e.y, `-${finalDmg} MEVZİ`, '#ef4444');
        if (this.focusTarget === e) this.focusTarget = null;
        this.enemies.splice(i, 1);
        this.updateHUD();
        if (this.baseHp <= 0) { this.gameOver(); return; }
      }
    }

    for (let i = this.effects.length - 1; i >= 0; i--) {
      this.effects[i].life -= dt;
      if (this.effects[i].life <= 0) this.effects.splice(i, 1);
    }
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y -= 34 * dt; ft.life -= dt;
      if (ft.life <= 0) this.floatingTexts.splice(i, 1);
    }
  }

  applyDamage(p, directTarget) {
    if (p.aoeRadius > 0) {
      this.effects.push({ x: p.x, y: p.y, radius: p.aoeRadius, color: p.color, life: 0.22 });
      for (const e of this.enemies) {
        if (Math.hypot(e.x - p.x, e.y - p.y) <= p.aoeRadius + e.radius) this.hitSingleEnemy(e, p);
      }
    } else if (directTarget) {
      this.hitSingleEnemy(directTarget, p);
    }
  }

  hitSingleEnemy(e, p) {
    let dmg = p.damage, isCrit = false;
    if ((p.heroType === 'FIRE_MAGE' && e.stunTimer > 0) || e === this.focusTarget) {
      dmg = Math.round(dmg * 1.45); isCrit = true;
    }
    if (hasEquip('giant_slayer') && (e.type === 'TANK' || e.type === 'BOSS')) {
      dmg = Math.round(dmg * 1.3);
    }
    e.hp -= dmg;
    if (p.stunDuration > 0) {
      const stunRes = e.type === 'BOSS' ? 0.35 : 1.0;
      e.stunTimer = Math.max(e.stunDuration * stunRes, e.stunTimer);
    }
    if (p.knockback > 0) {
      const kbRes = e.type === 'BOSS' ? 0.15 : (e.type === 'TANK' ? 0.4 : 1.0);
      const d = Math.hypot(e.x, e.y) || 1;
      e.x += (e.x / d) * p.knockback * kbRes;
      e.y += (e.y / d) * p.knockback * kbRes;
    }
    this.addFloatingText(e.x, e.y - 14, isCrit ? `💥${Math.round(dmg)}` : `${Math.round(dmg)}`, isCrit ? '#fde047' : '#f8fafc');
  }

  addFloatingText(x, y, text, color) {
    this.floatingTexts.push({ x, y, text, color, life: 0.75 });
  }

  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    ctx.save();
    const shakeX = this.screenShake > 0 ? (Math.random() - 0.5) * this.screenShake : 0;
    const shakeY = this.screenShake > 0 ? (Math.random() - 0.5) * this.screenShake : 0;
    ctx.translate(this.centerX + shakeX, this.centerY + shakeY);
    ctx.scale(this.viewScale, this.viewScale);

    const half = this.worldSize / 2;
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.3)';
    ctx.lineWidth = 1.5;
    for (let i = -400; i <= 400; i += 80) {
      ctx.beginPath(); ctx.moveTo(i, -half); ctx.lineTo(i, half); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-half, i); ctx.lineTo(half, i); ctx.stroke();
    }

    // Manyetik Girdap Çizimi
    if (this.vortex) {
      ctx.beginPath();
      ctx.arc(this.vortex.x, this.vortex.y, 85, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(192, 132, 252, 0.22)';
      ctx.fill();
      ctx.strokeStyle = '#c084fc'; ctx.lineWidth = 3; ctx.stroke();
    }

    // Lav Halkası Çizimi
    if (this.lavaRingTimer > 0) {
      ctx.beginPath();
      ctx.arc(0, 0, this.safeZoneRadius + 48, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(249, 115, 22, 0.25)';
      ctx.fill();
      ctx.strokeStyle = '#fb923c'; ctx.lineWidth = 4; ctx.stroke();
    }

    if (this.playerHero) {
      ctx.beginPath();
      ctx.arc(this.playerHero.x, this.playerHero.y, this.playerHero.getEffectiveRange(), 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.18)';
      ctx.lineWidth = 2; ctx.setLineDash([8, 8]); ctx.stroke(); ctx.setLineDash([]);
    }

    // Mevzi Çemberi
    ctx.beginPath();
    ctx.arc(0, 0, this.safeZoneRadius, 0, Math.PI * 2);
    ctx.fillStyle = this.invulnerableTimer > 0 ? 'rgba(253, 224, 71, 0.3)' : 'rgba(15, 23, 42, 0.85)';
    ctx.fill();
    ctx.lineWidth = this.invulnerableTimer > 0 ? 6 : 4;
    ctx.strokeStyle = this.invulnerableTimer > 0 ? '#fde047' : (this.formation === 'DEFENSE' ? '#38bdf8' : (this.formation === 'ATTACK' ? '#f97316' : '#64748b'));
    ctx.stroke();

    for (const ef of this.effects) {
      ctx.beginPath(); ctx.arc(ef.x, ef.y, ef.radius, 0, Math.PI * 2);
      ctx.fillStyle = ef.color + '44'; ctx.fill();
      ctx.strokeStyle = ef.color; ctx.lineWidth = 2.5; ctx.stroke();
    }

    for (const h of this.heroes) {
      const r = h.isPlayer ? 24 : 19;
      ctx.beginPath(); ctx.arc(h.x, h.y, r, 0, Math.PI * 2);
      ctx.fillStyle = h.stats.color; ctx.fill();
      ctx.lineWidth = h.isPlayer ? 4 : 2;
      ctx.strokeStyle = h.buffTimer > 0 ? '#4ade80' : (h.isPlayer ? '#fde047' : '#0f172a');
      ctx.stroke();

      ctx.font = `${h.isPlayer ? 20 : 16}px sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(h.stats.icon, h.x, h.y);

      ctx.font = 'bold 11px sans-serif';
      ctx.fillStyle = h.isPlayer ? '#fde047' : '#94a3b8';
      ctx.fillText(h.isPlayer ? '👑 LİDER' : 'BOT', h.x, h.y + r + 12);
    }

    for (const p of this.projectiles) {
      ctx.beginPath(); ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
      ctx.fillStyle = p.color; ctx.fill();
    }

    for (const e of this.enemies) {
      if (this.focusTarget === e) {
        ctx.beginPath(); ctx.arc(e.x, e.y, e.radius + 9, 0, Math.PI * 2);
        ctx.strokeStyle = '#fde047'; ctx.lineWidth = 3; ctx.stroke();
      }
      ctx.beginPath(); ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
      ctx.fillStyle = e.stunTimer > 0 ? '#60a5fa' : e.color; ctx.fill();
      ctx.lineWidth = e.type === 'BOSS' ? 4 : 2;
      ctx.strokeStyle = e.type === 'BOSS' ? '#fde047' : '#090d16'; ctx.stroke();

      const bw = e.radius * 2.2;
      ctx.fillStyle = '#090d16'; ctx.fillRect(e.x - bw / 2, e.y - e.radius - 11, bw, 5);
      ctx.fillStyle = e.type === 'BOSS' ? '#fde047' : '#22c55e';
      ctx.fillRect(e.x - bw / 2, e.y - e.radius - 11, bw * Math.max(0, e.hp / e.maxHp), 5);
    }

    for (const ft of this.floatingTexts) {
      ctx.font = 'bold 16px sans-serif'; ctx.fillStyle = ft.color;
      ctx.textAlign = 'center'; ctx.fillText(ft.text, ft.x, ft.y);
    }

    ctx.restore();
  }

  loop(now) {
    const dt = Math.min(0.1, (now - this.lastTime) / 1000);
    this.lastTime = now;
    if (!this.paused) { this.update(dt); this.render(); }
    requestAnimationFrame((t) => this.loop(t));
  }

  updateHUD() {
    document.getElementById('hpFill').style.width = `${(this.baseHp / this.maxBaseHp) * 100}%`;
    document.getElementById('hpText').textContent = `${Math.ceil(this.baseHp)}/${this.maxBaseHp}`;
    document.getElementById('waveText').textContent = `DALGA ${this.wave}`;
    document.getElementById('goldText').textContent = `🪙 ${playerSave.gold}`;
    const mult = (1 + Math.min(0.5, this.comboCount * 0.02)).toFixed(2);
    document.getElementById('comboText').textContent = `🔥 x${mult}`;
  }

  openUpgradeModal() {
    this.paused = true;
    SaveManager.save(playerSave);
    const screen = document.getElementById('upgradeScreen');
    const container = document.getElementById('upgradeCards');
    container.innerHTML = '';

    const upgrades = [
      { title: 'Komutanın Öfkesi', icon: '👑', desc: 'Lider karakterinin hasarı bu seferlik %18 artar.', apply: () => this.playerHero.stats.damage = Math.round(this.playerHero.stats.damage * 1.18) },
      { title: 'Hızlı Nişan', icon: '⚡', desc: 'Tüm takımın saldırı hızı bu seferlik %12 artar.', apply: () => this.heroes.forEach(h => h.stats.cooldown *= 0.88) },
      { title: 'Acil Tahkimat', icon: '🛡️', desc: 'Mevziye anında +40 Can onarımı yapılır.', apply: () => this.healBase(40) }
    ];

    upgrades.forEach(u => {
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `<div class="card-icon" style="background:#334155">${u.icon}</div><h3>${u.title}</h3><p>${u.desc}</p>`;
      card.onclick = () => {
        u.apply();
        screen.classList.add('hidden');
        this.startWave(this.wave + 1);
        this.paused = false;
      };
      container.appendChild(card);
    });
    screen.classList.remove('hidden');
  }

  gameOver() {
    this.paused = true;
    playerSave.activeRun = null;
    SaveManager.save(playerSave);
    document.getElementById('gameOverStats').innerHTML = `
      Ulaşılan Dalga: <b>${this.wave}</b> (Rekor: ${playerSave.bestWave})<br>
      Bu Seferde Toplanan Altın: <b>+${this.runGoldEarned} 🪙</b> (Hazine: <b>${playerSave.gold} 🪙</b>)
    `;
    document.getElementById('gameOverScreen').classList.remove('hidden');
  }

  bindInputs() {
    let draggingWheel = false, lastTouchAngle = 0;

    this.canvas.addEventListener('pointerdown', (e) => {
      const wPos = this.screenToWorld(e.clientX, e.clientY);
      if (Math.hypot(wPos.x, wPos.y) <= this.safeZoneRadius + 40) {
        draggingWheel = true;
        lastTouchAngle = Math.atan2(wPos.y, wPos.x);
        return;
      }
      for (const en of this.enemies) {
        if (Math.hypot(en.x - wPos.x, en.y - wPos.y) <= en.radius + 25) {
          this.focusTarget = en;
          this.addFloatingText(en.x, en.y - 25, '🎯 HEDEF!', '#fde047');
          break;
        }
      }
      this.playerController.setAimWorldPos(wPos);
    });

    this.canvas.addEventListener('pointermove', (e) => {
      if (e.buttons === 0 && !e.touches) return;
      const wPos = this.screenToWorld(e.clientX, e.clientY);
      if (draggingWheel) {
        const currentAngle = Math.atan2(wPos.y, wPos.x);
        let diff = currentAngle - lastTouchAngle;
        if (diff > Math.PI) diff -= Math.PI * 2;
        if (diff < -Math.PI) diff += Math.PI * 2;
        this.targetRotationOffset += diff;
        lastTouchAngle = currentAngle;
      } else {
        this.playerController.setAimWorldPos(wPos);
      }
    });

    window.addEventListener('pointerup', () => { draggingWheel = false; this.playerController.setAimWorldPos(null); });
    document.getElementById('btnRotLeft').onclick = () => this.rotateCircle(-1);
    document.getElementById('btnRotRight').onclick = () => this.rotateCircle(1);
    document.getElementById('btnSkill1').onclick = () => this.triggerSkill1();
    document.getElementById('btnSkill2').onclick = () => this.triggerSkill2();
    document.getElementById('btnUlti').onclick = () => this.triggerUltimate();

    // Oyun İçi Ses ve Duraklatma / Güvenli Çıkış
    document.getElementById('btnMute').onclick = () => {
      SoundFX.muted = !SoundFX.muted;
      document.getElementById('btnMute').textContent = SoundFX.muted ? '🔇' : '🔊';
    };
    document.getElementById('btnPause').onclick = () => {
      this.paused = true;
      document.getElementById('pauseStatsText').innerHTML = `Dalga: <b>${this.wave}</b> | Bu Tur Kazanılan: <b>+${this.runGoldEarned} 🪙</b><br>Çekilirsen kazandığın tüm altınlar hazinene eklenir!`;
      document.getElementById('pauseModal').classList.remove('hidden');
    };
    document.getElementById('btnResumeGame').onclick = () => {
      document.getElementById('pauseModal').classList.add('hidden');
      this.lastTime = performance.now();
      this.paused = false;
    };
    document.getElementById('btnRetreatGame').onclick = async () => {
      playerSave.activeRun = null;
      await SaveManager.save(playerSave);
      location.reload();
    };

    window.addEventListener('keydown', (e) => {
      if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') this.rotateCircle(-1);
      if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') this.rotateCircle(1);
      if (e.key === 'q' || e.key === 'Q') this.triggerSkill1();
      if (e.key === 'e' || e.key === 'E') this.triggerSkill2();
      if (e.key === 'r' || e.key === 'R' || e.code === 'Space') this.triggerUltimate();
      if (e.key === 'Escape') document.getElementById('btnPause').click();
      if (e.key === '1') this.setFormation('DEFENSE');
      if (e.key === '2') this.setFormation('BALANCED');
      if (e.key === '3') this.setFormation('ATTACK');
    });
  }
}

/**
 * ============================================================================
 * 6. 4 SEKMELİ KARARGÂH, KIŞLA VE EKİPMAN MARKETİ YÖNETİMİ
 * ============================================================================
 */
const engine = new GameEngine(document.getElementById('gameCanvas'));
let activeShopTab = 'PALADIN';

// Alt Menü Sekme Geçişleri
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.menu-page').forEach(p => p.classList.add('hidden'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.remove('hidden');
    renderAllMenus();
  };
});

function renderAllMenus() {
  document.getElementById('nickInput').value = playerSave.nickname;
  document.getElementById('uiGold').textContent = playerSave.gold;
  document.getElementById('uiBestWave').textContent = playerSave.bestWave;
  document.getElementById('uiTotalKills').textContent = playerSave.totalKills;

  // Savaş Sekmesi: Yarıda Kalan Oyun & Kuşanılan Ekipman Özeti
  const resumeBtn = document.getElementById('btnResumeRun');
  if (playerSave.activeRun && playerSave.activeRun.wave > 1) {
    const r = playerSave.activeRun;
    const cls = HERO_CONFIGS[r.selectedClass] ? r.selectedClass : 'PALADIN';
    resumeBtn.classList.remove('hidden');
    resumeBtn.textContent = `▶️ Kaldığın Savaşa Devam Et (${HERO_CONFIGS[cls].name} - Dalga ${r.wave})`;
    resumeBtn.onclick = () => startGame(cls, r);
  } else {
    resumeBtn.classList.add('hidden');
  }

  const eqIds = playerSave.upgrades.INVENTORY.equipped;
  const previewEl = document.getElementById('battleEquipPreview');
  if (eqIds.length === 0) {
    previewEl.innerHTML = `<span>🎒 Aktif Ekipman Yok — <b>Ekipman</b> sekmesinden yadigâr kuşanabilirsin!</span>`;
  } else {
    const names = eqIds.map(id => EQUIPMENT_ITEMS.find(x => x.id === id)?.name).filter(Boolean).join(' • ');
    previewEl.innerHTML = `<span>🎒 <b>Kuşanılan Ekipmanlar:</b> ${names}</span>`;
  }

  renderHeroSelectCards();
  renderBarracks();
  renderArmory();
}

function startGame(cls, resumeState) {
  document.getElementById('mainMenu').classList.add('hidden');
  document.getElementById('hud').classList.remove('hidden');
  document.getElementById('controls').classList.remove('hidden');
  engine.startWithHero(cls, resumeState);
}

function renderHeroSelectCards() {
  const cardsRoot = document.getElementById('heroCards');
  cardsRoot.innerHTML = '';
  Object.values(HERO_CONFIGS).forEach(cfg => {
    const upg = playerSave.upgrades[cfg.type] || { dmg: 0, spd: 0, spec: 0 };
    const totalLvl = upg.dmg + upg.spd + upg.spec;
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div class="card-icon" style="background:${cfg.color}22; border:2px solid ${cfg.color}">${cfg.icon}</div>
      <h3>${cfg.name} <span style="color:#fde047; font-size:0.75rem;">[Sv.${totalLvl}]</span></h3>
      <span class="role">${cfg.role}</span>
      <p>${cfg.desc}</p>
      <div class="skill-tag">
        <div><b>${cfg.skill1Name}</b></div>
        <div><b>${cfg.skill2Name}</b></div>
      </div>
    `;
    card.onclick = () => startGame(cfg.type, null);
    cardsRoot.appendChild(card);
  });
}

function renderBarracks() {
  const tabsEl = document.getElementById('shopTabs');
  tabsEl.innerHTML = '';
  Object.keys(SHOP_TREE).forEach(tabKey => {
    const btn = document.createElement('button');
    btn.className = 'tab-btn' + (activeShopTab === tabKey ? ' active' : '');
    btn.textContent = SHOP_TREE[tabKey].label;
    btn.onclick = () => { activeShopTab = tabKey; renderBarracks(); };
    tabsEl.appendChild(btn);
  });

  const shopGrid = document.getElementById('shopGrid');
  shopGrid.innerHTML = '';
  const currentGroup = SHOP_TREE[activeShopTab];
  const groupSave = playerSave.upgrades[activeShopTab];

  currentGroup.items.forEach(item => {
    const lvl = groupSave[item.key] || 0;
    const isMax = lvl >= item.maxLvl;
    const cost = Math.round(item.baseCost * Math.pow(item.costMult, lvl));
    const pct = (lvl / item.maxLvl) * 100;

    const div = document.createElement('div');
    div.className = 'shop-item';
    div.innerHTML = `
      <h4>${item.name} (Sv. ${lvl}/${item.maxLvl})</h4>
      <div class="lvl-bar"><div class="lvl-fill" style="width:${pct}%"></div></div>
      <span>${item.desc}</span>
      <button class="btn-buy" ${(isMax || playerSave.gold < cost) ? 'disabled' : ''}>
        ${isMax ? 'MAKSİMUM SEVİYE' : `Geliştir (🪙 ${cost})`}
      </button>
    `;
    div.querySelector('button').onclick = async () => {
      if (!isMax && playerSave.gold >= cost) {
        SoundFX.play('coin');
        playerSave.gold -= cost;
        playerSave.upgrades[activeShopTab][item.key] = lvl + 1;
        renderAllMenus();
        await SaveManager.save(playerSave);
      }
    };
    shopGrid.appendChild(div);
  });
}

function renderArmory() {
  const inv = playerSave.upgrades.INVENTORY;
  const slotsEl = document.getElementById('equippedSlots');
  slotsEl.innerHTML = '';

  for (let i = 0; i < 3; i++) {
    const eqId = inv.equipped[i];
    const item = EQUIPMENT_ITEMS.find(x => x.id === eqId);
    const slot = document.createElement('div');
    slot.className = 'equip-slot' + (item ? ' filled' : '');
    if (item) {
      slot.innerHTML = `<b>${item.name}</b><span style="color:#f87171; font-size:0.62rem;">[Çıkarmak İçin Dokun]</span>`;
      slot.onclick = async () => {
        inv.equipped.splice(i, 1);
        renderAllMenus();
        await SaveManager.save(playerSave);
      };
    } else {
      slot.innerHTML = `<span>Boş Yuva ${i + 1}</span>`;
    }
    slotsEl.appendChild(slot);
  }

  const armoryGrid = document.getElementById('armoryGrid');
  armoryGrid.innerHTML = '';
  EQUIPMENT_ITEMS.forEach(item => {
    const isOwned = inv.owned.includes(item.id);
    const isEquipped = inv.equipped.includes(item.id);

    const div = document.createElement('div');
    div.className = 'shop-item';
    let btnHtml = '';
    if (!isOwned) {
      btnHtml = `<button class="btn-buy" ${playerSave.gold < item.cost ? 'disabled' : ''}>Satın Al (🪙 ${item.cost})</button>`;
    } else if (isEquipped) {
      btnHtml = `<button class="btn-buy unequip-btn">Çıkar (Kuşanıldı)</button>`;
    } else {
      btnHtml = `<button class="btn-buy equipped-btn" ${inv.equipped.length >= 3 ? 'disabled' : ''}>${inv.equipped.length >= 3 ? 'Yuvalar Dolu (3/3)' : 'Kuşan (Equip)'}</button>`;
    }

    div.innerHTML = `
      <h4>${item.name}</h4>
      <span>${item.desc}</span>
      ${btnHtml}
    `;

    div.querySelector('button').onclick = async () => {
      if (!isOwned && playerSave.gold >= item.cost) {
        SoundFX.play('coin');
        playerSave.gold -= item.cost;
        inv.owned.push(item.id);
        if (inv.equipped.length < 3) inv.equipped.push(item.id);
      } else if (isOwned && isEquipped) {
        inv.equipped = inv.equipped.filter(id => id !== item.id);
      } else if (isOwned && !isEquipped && inv.equipped.length < 3) {
        inv.equipped.push(item.id);
      }
      renderAllMenus();
      await SaveManager.save(playerSave);
    };
    armoryGrid.appendChild(div);
  });
}

document.getElementById('btnSaveNick').onclick = async () => {
  const val = document.getElementById('nickInput').value.trim();
  if (val.length >= 2) {
    playerSave.nickname = val;
    await SaveManager.save(playerSave);
    await SaveManager.fetchLeaderboard();
  }
};

(async () => {
  renderAllMenus();
  playerSave = await SaveManager.syncFromCloud(playerSave);
  renderAllMenus();
  await SaveManager.fetchLeaderboard();
})();
