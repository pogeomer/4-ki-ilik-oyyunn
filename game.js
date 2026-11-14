/**
 * ============================================================================
 * 0. SUPABASE BAĞLANTISI VE KARAKTER BAZLI KAYIT YÖNETİCİSİ
 * ============================================================================
 */
const SUPABASE_URL = 'https://gzwjzfkqwypspmqxncqg.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_muXI5UcyGzPKnOcyB-RB2A_07QTs-fC';

const supabaseClient = SUPABASE_URL.startsWith('http')
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

class SaveManager {
  static STORAGE_KEY = 'CIRCLE_DEFENSE_HARDCORE_V3';

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
      SWORDSMAN: { dmg: 0, spd: 0, spec: 0 },
      ARCHER: { dmg: 0, spd: 0, spec: 0 },
      FIRE_MAGE: { dmg: 0, spd: 0, spec: 0 },
      LIGHTNING_MAGE: { dmg: 0, spd: 0, spec: 0 },
      BASE: { hp: 0, armor: 0 }
    };
  }

  static normalizeUpgrades(rawUpg) {
    const def = this.getDefaultUpgrades();
    if (!rawUpg || typeof rawUpg.SWORDSMAN !== 'object') return def;
    return {
      SWORDSMAN: { ...def.SWORDSMAN, ...rawUpg.SWORDSMAN },
      ARCHER: { ...def.ARCHER, ...rawUpg.ARCHER },
      FIRE_MAGE: { ...def.FIRE_MAGE, ...rawUpg.FIRE_MAGE },
      LIGHTNING_MAGE: { ...def.LIGHTNING_MAGE, ...rawUpg.LIGHTNING_MAGE },
      BASE: { ...def.BASE, ...rawUpg.BASE }
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
      const raw = localStorage.getItem(this.STORAGE_KEY);
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
        .limit(5);

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
 * 1. KARAKTER SINIFLARI VE KIŞLA MAĞAZA AĞACI (YAVAŞ & PAHALI GELİŞİM)
 * ============================================================================
 * Başlangıç hasarları düşürüldü; oyuncunun gelişmek için mağazaya ihtiyacı var!
 */
const HERO_CONFIGS = {
  SWORDSMAN: {
    type: 'SWORDSMAN', name: 'Kılıç Ustası', icon: '⚔️', color: '#38bdf8',
    role: 'Yakın Dövüş / Tank', desc: 'Yaklaşan düşmanları biçer ve geri iter.',
    skillName: 'Sarsıcı Kalkan', range: 135, damage: 26, cooldown: 0.85, aoeRadius: 50, stunDuration: 0, knockback: 24, projSpeed: 460
  },
  ARCHER: {
    type: 'ARCHER', name: 'Okçu', icon: '🏹', color: '#4ade80',
    role: 'Uzun Menzil / Nişancı', desc: 'Uzaktaki hedeflere seri oklar gönderir.',
    skillName: 'Ok Yağmuru', range: 330, damage: 17, cooldown: 0.44, aoeRadius: 0, stunDuration: 0, knockback: 4, projSpeed: 720
  },
  FIRE_MAGE: {
    type: 'FIRE_MAGE', name: 'Ateş Büyücüsü', icon: '🔥', color: '#fb923c',
    role: 'Alan Hasarı (AoE)', desc: 'Sürüleri yakar. Sersemlemiş düşmana %50 KRİTİK vurur!',
    skillName: 'Kıyamet Meteoru', range: 260, damage: 34, cooldown: 1.65, aoeRadius: 75, stunDuration: 0, knockback: 8, projSpeed: 380
  },
  LIGHTNING_MAGE: {
    type: 'LIGHTNING_MAGE', name: 'Şimşek Büyücüsü', icon: '⚡', color: '#c084fc',
    role: 'Kitle Kontrol / Stun', desc: 'Düşman gruplarını elektrikle çarparak sersemletir.',
    skillName: 'Yüksek Voltaj', range: 245, damage: 14, cooldown: 1.45, aoeRadius: 60, stunDuration: 1.1, knockback: 0, projSpeed: 620
  }
};

// Her Karakter İçin Özel Mağaza Ağacı (Max 10 Seviye, Aşamalı & Pahalı)
const SHOP_TREE = {
  SWORDSMAN: {
    label: '⚔️ Kılıç Ustası',
    items: [
      { key: 'dmg', name: 'Ağır Kılıç Eğitimi', desc: 'Seviye başı +%8 Kılıç Hasarı', baseCost: 25, costMult: 1.65, maxLvl: 10 },
      { key: 'spd', name: 'Çevik Bilek', desc: 'Seviye başı +%5 Saldırı Hızı', baseCost: 30, costMult: 1.7, maxLvl: 10 },
      { key: 'spec', name: 'Sarsıcı Darbe', desc: 'Seviye başı +6 Geri İtme ve Alan Çapı', baseCost: 40, costMult: 1.8, maxLvl: 10 }
    ]
  },
  ARCHER: {
    label: '🏹 Okçu',
    items: [
      { key: 'dmg', name: 'Zırh Delici Oklar', desc: 'Seviye başı +%8 Ok Hasarı', baseCost: 25, costMult: 1.65, maxLvl: 10 },
      { key: 'spd', name: 'Seri Yay Kirişi', desc: 'Seviye başı +%5 Atış Hızı', baseCost: 30, costMult: 1.7, maxLvl: 10 },
      { key: 'spec', name: 'Kartal Gözü', desc: 'Seviye başı +18 Menzil', baseCost: 35, costMult: 1.75, maxLvl: 10 }
    ]
  },
  FIRE_MAGE: {
    label: '🔥 Ateş Büyücüsü',
    items: [
      { key: 'dmg', name: 'Cehennem Ateşi', desc: 'Seviye başı +%8 Ateş Hasarı', baseCost: 25, costMult: 1.65, maxLvl: 10 },
      { key: 'spd', name: 'Büyü Akışı', desc: 'Seviye başı +%5 Büyü Hızı', baseCost: 30, costMult: 1.7, maxLvl: 10 },
      { key: 'spec', name: 'Büyük Patlama', desc: 'Seviye başı +8 Patlama Çapı (AoE)', baseCost: 40, costMult: 1.8, maxLvl: 10 }
    ]
  },
  LIGHTNING_MAGE: {
    label: '⚡ Şimşek Büyücüsü',
    items: [
      { key: 'dmg', name: 'Yüksek Gerilim', desc: 'Seviye başı +%8 Şimşek Hasarı', baseCost: 25, costMult: 1.65, maxLvl: 10 },
      { key: 'spd', name: 'Fırtına Çağıran', desc: 'Seviye başı +%5 Saldırı Hızı', baseCost: 30, costMult: 1.7, maxLvl: 10 },
      { key: 'spec', name: 'Şok Dalgaları', desc: 'Seviye başı +0.15 sn Sersemletme Süresi', baseCost: 45, costMult: 1.85, maxLvl: 10 }
    ]
  },
  BASE: {
    label: '🛡️ Mevzi & Tahkimat',
    items: [
      { key: 'hp', name: 'Taş Duvarlar', desc: 'Seviye başı +30 Maksimum Mevzi Canı', baseCost: 20, costMult: 1.6, maxLvl: 10 },
      { key: 'armor', name: 'Dikenli Siper', desc: 'Mevziye gelen tüm hasarı seviye başı %4 azaltır', baseCost: 35, costMult: 1.8, maxLvl: 10 }
    ]
  }
};

/**
 * ============================================================================
 * 2. KONTROLCÜLER VE VARLIKLAR (HARDCORE DÜŞMAN DENGELEMESİ)
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
    this.aimDir = { x: Math.cos(slotAngle), y: Math.sin(slotAngle) };

    // BU KARAKTERİN KIŞLA'DAKİ ÖZEL YÜKSELTMELERİNİ UYGULA!
    const upg = playerSave.upgrades[this.stats.type] || { dmg: 0, spd: 0, spec: 0 };
    this.stats.damage = Math.round(this.stats.damage * (1 + upg.dmg * 0.08));
    this.stats.cooldown *= Math.pow(0.95, upg.spd);

    if (this.stats.type === 'SWORDSMAN') {
      this.stats.knockback += upg.spec * 6;
      this.stats.aoeRadius += upg.spec * 5;
    } else if (this.stats.type === 'ARCHER') {
      this.stats.range += upg.spec * 18;
    } else if (this.stats.type === 'FIRE_MAGE') {
      this.stats.aoeRadius += upg.spec * 8;
    } else if (this.stats.type === 'LIGHTNING_MAGE') {
      this.stats.stunDuration += upg.spec * 0.15;
    }

    // Seçilen Lider Bonusu (+%20 Hasar)
    if (this.isPlayer) {
      this.stats.damage = Math.round(this.stats.damage * 1.20);
      this.stats.cooldown *= 0.88;
    }
  }

  getEffectiveRange() {
    const formMult = this.engine.formation === 'ATTACK' ? 1.25 : (this.engine.formation === 'DEFENSE' ? 0.85 : 1.0);
    return this.stats.range * formMult;
  }

  getEffectiveCooldown() {
    const formMult = this.engine.formation === 'ATTACK' ? 0.78 : 1.0;
    return this.stats.cooldown * formMult;
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
    const dir = this.controller.getTargetDirection(this, enemies, focusTarget);
    if (dir) {
      this.aimDir = dir;
      if (this.cooldownTimer <= 0) {
        this.engine.spawnProjectile(this, dir, false);
        this.cooldownTimer = this.getEffectiveCooldown();
      }
    }
  }
}

class Enemy {
  constructor(x, y, type, scale) {
    this.x = x; this.y = y; this.type = type;

    // ZORLAŞTIRILMIŞ CANAVAR İSTATİSTİKLERİ VE NADİR ALTIN DÜŞME ORANLARI
    if (type === 'SWARM') {
      // Hızlı Örümcek Sürüsü: %6 ihtimalle 1 altın
      this.hp = 68 * scale; this.speed = 104; this.radius = 12; this.color = '#f43f5e'; this.damage = 10;
      this.goldValue = Math.random() < 0.06 ? 1 : 0;
    } else if (type === 'TANK') {
      // Zırhlı Dev: %65 ihtimalle 2-3 altın, geri itmeye dirençli
      this.hp = 540 * scale; this.speed = 42; this.radius = 24; this.color = '#a855f7'; this.damage = 30;
      this.goldValue = Math.random() < 0.65 ? (2 + Math.floor(Math.random() * 2)) : 0;
    } else if (type === 'BOSS') {
      // 5 Dalgada Bir Gelen Kuşatma Golemi: Kesin 12 Altın bırakır!
      this.hp = 1900 * scale; this.speed = 28; this.radius = 36; this.color = '#eab308'; this.damage = 65;
      this.goldValue = 12;
    } else {
      // Normal Savaşçı: %12 ihtimalle 1 altın
      this.hp = 155 * scale; this.speed = 64; this.radius = 16; this.color = '#ef4444'; this.damage = 16;
      this.goldValue = Math.random() < 0.12 ? 1 : 0;
    }
    this.maxHp = this.hp;
    this.stunTimer = 0;
  }

  update(dt) {
    if (this.stunTimer > 0) { this.stunTimer -= dt; return; }
    const dist = Math.hypot(this.x, this.y) || 1;
    this.x -= (this.x / dist) * this.speed * dt;
    this.y -= (this.y / dist) * this.speed * dt;
  }
}

/**
 * ============================================================================
 * 3. ANA OYUN MOTORU
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
    this.kills = 0;
    this.runGoldEarned = 0;
    this.wave = 1;
    this.selectedClass = 'SWORDSMAN';
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
    this.skillCooldown = 0;
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

  setFormation(form) {
    this.formation = form;
    document.getElementById('formDef').classList.toggle('active', form === 'DEFENSE');
    document.getElementById('formBal').classList.toggle('active', form === 'BALANCED');
    document.getElementById('formAtk').classList.toggle('active', form === 'ATTACK');
    const msg = form === 'DEFENSE' ? '🛡️ KALKAN DÜZENİ!' : (form === 'ATTACK' ? '⚔️ TAARRUZ DÜZENİ!' : '⚖️ DENGELİ DÜZEN');
    this.addFloatingText(0, -this.safeZoneRadius - 20, msg, '#38bdf8');
  }

  startWithHero(selectedClass, resumeState = null) {
    this.selectedClass = selectedClass;
    this.runGoldEarned = 0;
    const allOrder = ['SWORDSMAN', 'ARCHER', 'FIRE_MAGE', 'LIGHTNING_MAGE'];
    const ordered = [selectedClass, ...allOrder.filter(c => c !== selectedClass)];

    const baseUpg = playerSave.upgrades.BASE || { hp: 0, armor: 0 };
    this.maxBaseHp = 100 + (baseUpg.hp * 30);
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

    document.getElementById('skillIcon').textContent = this.playerHero.stats.icon;
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

  triggerActiveSkill() {
    if (this.skillCooldown > 0 || !this.playerHero || this.paused) return;
    this.skillCooldown = 6.0;
    const h = this.playerHero, dir = h.aimDir;

    if (h.stats.type === 'SWORDSMAN') {
      this.baseHp = Math.min(this.maxBaseHp, this.baseHp + 12);
      this.updateHUD();
      this.effects.push({ x: 0, y: 0, radius: this.safeZoneRadius + 90, color: '#38bdf8', life: 0.35 });
      for (const e of this.enemies) {
        const d = Math.hypot(e.x, e.y);
        if (d <= this.safeZoneRadius + 90) {
          e.hp -= h.stats.damage * 1.5; e.stunTimer = 1.4;
          e.x += (e.x / (d || 1)) * 75; e.y += (e.y / (d || 1)) * 75;
        }
      }
      this.addFloatingText(0, -40, '⚔️ SARSICI KALKAN!', '#38bdf8');
    } else if (h.stats.type === 'ARCHER') {
      for (let i = -3; i <= 4; i++) {
        const spread = i * 0.12, cos = Math.cos(spread), sin = Math.sin(spread);
        const rDir = { x: dir.x * cos - dir.y * sin, y: dir.x * sin + dir.y * cos };
        this.projectiles.push({
          x: h.x, y: h.y, vx: rDir.x * 780, vy: rDir.y * 780,
          distTraveled: 0, maxRange: 420, damage: h.stats.damage * 1.4,
          aoeRadius: 40, stunDuration: 0.2, knockback: 12, color: '#4ade80', heroType: 'ARCHER'
        });
      }
      this.addFloatingText(h.x, h.y - 30, '🏹 OK YAĞMURU!', '#4ade80');
    } else if (h.stats.type === 'FIRE_MAGE') {
      const targetX = h.x + dir.x * 200, targetY = h.y + dir.y * 200;
      this.effects.push({ x: targetX, y: targetY, radius: 135, color: '#f97316', life: 0.45 });
      for (const e of this.enemies) {
        if (Math.hypot(e.x - targetX, e.y - targetY) <= 135 + e.radius) {
          e.hp -= h.stats.damage * 2.2;
          this.addFloatingText(e.x, e.y, `☄️ ${Math.round(h.stats.damage * 2.2)}!`, '#fb923c');
        }
      }
      this.addFloatingText(targetX, targetY - 40, '☄️ KIYAMET METEORU!', '#fb923c');
    } else if (h.stats.type === 'LIGHTNING_MAGE') {
      const sorted = [...this.enemies].sort((a, b) => Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y)).slice(0, 6);
      sorted.forEach(e => {
        e.hp -= h.stats.damage * 1.8; e.stunTimer = 2.0;
        this.effects.push({ x: e.x, y: e.y, radius: 45, color: '#c084fc', life: 0.3 });
      });
      this.addFloatingText(h.x, h.y - 30, '⚡ ZİNCİRLEME YILDIRIM!', '#c084fc');
    }
  }

  triggerUltimate() {
    if (this.ultiCooldown > 0 || !this.playerHero || this.paused) return;
    this.ultiCooldown = 11.0;
    for (const h of this.heroes) {
      for (let i = 0; i < 8; i++) {
        const ang = (i * Math.PI * 2) / 8;
        this.spawnProjectile(h, { x: Math.cos(ang), y: Math.sin(ang) }, true);
      }
    }
    this.addFloatingText(0, -60, '🔥 TAM TAKIM ULTİ ATEŞİ!', '#fde047');
  }

  spawnProjectile(hero, dir, isUlti) {
    const s = hero.stats;
    this.projectiles.push({
      x: hero.x, y: hero.y,
      vx: dir.x * s.projSpeed, vy: dir.y * s.projSpeed,
      distTraveled: 0,
      maxRange: isUlti ? hero.getEffectiveRange() * 1.3 : hero.getEffectiveRange(),
      damage: isUlti ? s.damage * 1.4 : s.damage,
      aoeRadius: isUlti ? Math.max(45, s.aoeRadius * 1.25) : s.aoeRadius,
      stunDuration: s.stunDuration, knockback: s.knockback, color: s.color, heroType: s.type
    });
  }

  spawnEnemy() {
    const angle = Math.random() * Math.PI * 2;
    const spawnDist = (this.worldSize * 0.5) + 35;
    const x = Math.cos(angle) * spawnDist, y = Math.sin(angle) * spawnDist;

    // Katlanarak artan zorluk çarpanı!
    const scale = Math.pow(1.26, this.wave - 1);

    // Her 5 dalgada bir BOSS (Kuşatma Golemi)
    if (this.wave % 5 === 0 && !this.bossSpawnedThisWave) {
      this.bossSpawnedThisWave = true;
      const boss = new Enemy(x, y, 'BOSS', scale);
      this.enemies.push(boss);
      this.addFloatingText(0, -120, '⚠️ DİKKAT: KUŞATMA GOLEMİ (BOSS) GELDİ!', '#eab308');
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

    if (this.skillCooldown > 0) {
      this.skillCooldown = Math.max(0, this.skillCooldown - dt);
      document.getElementById('btnSkill').classList.toggle('cooldown', this.skillCooldown > 0);
      document.getElementById('skillTimer').textContent = this.skillCooldown > 0 ? this.skillCooldown.toFixed(1) + 's' : 'ÖZEL [Q]';
    }
    if (this.ultiCooldown > 0) {
      this.ultiCooldown = Math.max(0, this.ultiCooldown - dt);
      document.getElementById('btnUlti').classList.toggle('cooldown', this.ultiCooldown > 0);
      document.getElementById('ultiTimer').textContent = this.ultiCooldown > 0 ? this.ultiCooldown.toFixed(1) + 's' : 'HAZIR [R]';
    }

    if (this.waveEnemiesRemaining > 0) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnEnemy();
        this.waveEnemiesRemaining--;
        // Canavarlar çok daha seri doğar
        this.spawnTimer = Math.max(0.22, 0.95 - this.wave * 0.06);
      }
    } else if (this.enemies.length === 0) {
      // Dalga bitirme ödülü (+3 Altın)
      playerSave.gold += 3;
      this.runGoldEarned += 3;
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
      e.update(dt);

      if (e.hp <= 0) {
        if (this.focusTarget === e) this.focusTarget = null;
        this.enemies.splice(i, 1);
        this.kills++;
        playerSave.totalKills++;
        if (e.goldValue > 0) {
          playerSave.gold += e.goldValue;
          this.runGoldEarned += e.goldValue;
          this.addFloatingText(e.x, e.y, `+${e.goldValue} 🪙`, '#fde047');
        }
        SaveManager.saveLocal(playerSave);
        this.updateHUD();
        continue;
      }

      if (Math.hypot(e.x, e.y) <= this.safeZoneRadius) {
        const armorLvl = (playerSave.upgrades.BASE && playerSave.upgrades.BASE.armor) || 0;
        const armorMult = Math.max(0.5, 1 - armorLvl * 0.04);
        const formMult = this.formation === 'DEFENSE' ? 0.7 : (this.formation === 'ATTACK' ? 1.25 : 1.0);
        const finalDmg = Math.max(1, Math.round(e.damage * formMult * armorMult));

        this.baseHp = Math.max(0, this.baseHp - finalDmg);
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
      dmg = Math.round(dmg * 1.4); isCrit = true;
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
    this.addFloatingText(e.x, e.y - 14, isCrit ? `💥${dmg}` : `${Math.round(dmg)}`, isCrit ? '#fde047' : '#f8fafc');
  }

  addFloatingText(x, y, text, color) {
    this.floatingTexts.push({ x, y, text, color, life: 0.75 });
  }

  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    ctx.save();
    ctx.translate(this.centerX, this.centerY);
    ctx.scale(this.viewScale, this.viewScale);

    const half = this.worldSize / 2;
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.3)';
    ctx.lineWidth = 1.5;
    for (let i = -400; i <= 400; i += 80) {
      ctx.beginPath(); ctx.moveTo(i, -half); ctx.lineTo(i, half); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-half, i); ctx.lineTo(half, i); ctx.stroke();
    }

    if (this.playerHero) {
      ctx.beginPath();
      ctx.arc(this.playerHero.x, this.playerHero.y, this.playerHero.getEffectiveRange(), 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.18)';
      ctx.lineWidth = 2; ctx.setLineDash([8, 8]); ctx.stroke(); ctx.setLineDash([]);
    }

    ctx.beginPath();
    ctx.arc(0, 0, this.safeZoneRadius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = this.formation === 'DEFENSE' ? '#38bdf8' : (this.formation === 'ATTACK' ? '#f97316' : '#64748b');
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
      ctx.strokeStyle = h.isPlayer ? '#fde047' : '#0f172a'; ctx.stroke();

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
    document.getElementById('killText').textContent = `💀 ${this.kills}`;
  }

  openUpgradeModal() {
    this.paused = true;
    SaveManager.save(playerSave);
    const screen = document.getElementById('upgradeScreen');
    const container = document.getElementById('upgradeCards');
    container.innerHTML = '';

    // Tur içi geçici bonuslar da dengelendi (%12-%15 civarı)
    const upgrades = [
      { title: 'Savaş Öfkesi (Bu Tur)', icon: '👑', desc: 'Lider karakterinin hasarı bu oyunluk %15 artar.', apply: () => this.playerHero.stats.damage = Math.round(this.playerHero.stats.damage * 1.15) },
      { title: 'Hızlı Nişan (Bu Tur)', icon: '⚡', desc: 'Tüm takımın saldırı hızı bu oyunluk %10 artar.', apply: () => this.heroes.forEach(h => h.stats.cooldown *= 0.9) },
      { title: 'Acil Onarım (Bu Tur)', icon: '🛡️', desc: 'Mevziye 35 Can onarımı yapılır.', apply: () => { this.baseHp = Math.min(this.maxBaseHp, this.baseHp + 35); } }
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
      Bu Seferde Toplanan Altın: <b>+${this.runGoldEarned} 🪙</b> (Toplam Hazine: <b>${playerSave.gold} 🪙</b>)<br><br>
      <i>Şimdi Kışla'ya dönüp kazandığın altınlarla karakterlerini kalıcı olarak güçlendirebilirsin!</i>
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
    document.getElementById('btnSkill').onclick = () => this.triggerActiveSkill();
    document.getElementById('btnUlti').onclick = () => this.triggerUltimate();

    window.addEventListener('keydown', (e) => {
      if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') this.rotateCircle(-1);
      if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') this.rotateCircle(1);
      if (e.key === 'q' || e.key === 'Q') this.triggerActiveSkill();
      if (e.key === 'r' || e.key === 'R' || e.code === 'Space') this.triggerUltimate();
      if (e.key === '1') this.setFormation('DEFENSE');
      if (e.key === '2') this.setFormation('BALANCED');
      if (e.key === '3') this.setFormation('ATTACK');
    });
  }
}

/**
 * ============================================================================
 * 4. KIŞLA (KARAKTER BAZLI MAĞAZA) VE ARAYÜZ YÖNETİMİ
 * ============================================================================
 */
const engine = new GameEngine(document.getElementById('gameCanvas'));
let activeShopTab = 'SWORDSMAN';

function renderMetaUI() {
  document.getElementById('nickInput').value = playerSave.nickname;
  document.getElementById('uiGold').textContent = playerSave.gold;
  document.getElementById('uiBestWave').textContent = playerSave.bestWave;
  document.getElementById('uiTotalKills').textContent = playerSave.totalKills;

  const resumeBtn = document.getElementById('btnResumeRun');
  if (playerSave.activeRun && playerSave.activeRun.wave > 1) {
    const r = playerSave.activeRun;
    resumeBtn.classList.remove('hidden');
    resumeBtn.textContent = `▶️ Kaldığın Savaşa Devam Et (${HERO_CONFIGS[r.selectedClass].name} - Dalga ${r.wave})`;
    resumeBtn.onclick = () => {
      document.getElementById('selectScreen').classList.add('hidden');
      document.getElementById('hud').classList.remove('hidden');
      document.getElementById('controls').classList.remove('hidden');
      engine.startWithHero(r.selectedClass, r);
    };
  } else {
    resumeBtn.classList.add('hidden');
  }

  // Mağaza Sekmelerini Çiz (Kılıç Ustası, Okçu, Ateş, Şimşek, Mevzi)
  const tabsEl = document.getElementById('shopTabs');
  tabsEl.innerHTML = '';
  Object.keys(SHOP_TREE).forEach(tabKey => {
    const btn = document.createElement('button');
    btn.className = 'tab-btn' + (activeShopTab === tabKey ? ' active' : '');
    btn.textContent = SHOP_TREE[tabKey].label;
    btn.onclick = () => { activeShopTab = tabKey; renderMetaUI(); };
    tabsEl.appendChild(btn);
  });

  // Seçili Sekmenin Geliştirme Kartlarını Çiz
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
        ${isMax ? 'MAKSİMUM SEVİYE' : `Geliştir (🪙 ${cost} Altın)`}
      </button>
    `;
    div.querySelector('button').onclick = async () => {
      if (!isMax && playerSave.gold >= cost) {
        playerSave.gold -= cost;
        playerSave.upgrades[activeShopTab][item.key] = lvl + 1;
        renderMetaUI();
        renderHeroSelectCards();
        await SaveManager.save(playerSave);
      }
    };
    shopGrid.appendChild(div);
  });
}

function renderHeroSelectCards() {
  const cardsRoot = document.getElementById('heroCards');
  cardsRoot.innerHTML = '';
  Object.values(HERO_CONFIGS).forEach(cfg => {
    const upg = playerSave.upgrades[cfg.type];
    const totalLvl = upg.dmg + upg.spd + upg.spec;
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div class="card-icon" style="background:${cfg.color}22; border:2px solid ${cfg.color}">${cfg.icon}</div>
      <h3>${cfg.name} <span style="color:#fde047; font-size:0.75rem;">[Kışla Sv.${totalLvl}]</span></h3>
      <span class="role">${cfg.role}</span>
      <p>${cfg.desc}</p>
      <div class="skill-tag"><b>Özel Yetenek:</b> ${cfg.skillName}</div>
    `;
    card.onclick = () => {
      document.getElementById('selectScreen').classList.add('hidden');
      document.getElementById('hud').classList.remove('hidden');
      document.getElementById('controls').classList.remove('hidden');
      engine.startWithHero(cfg.type, null);
    };
    cardsRoot.appendChild(card);
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
  renderMetaUI();
  renderHeroSelectCards();
  playerSave = await SaveManager.syncFromCloud(playerSave);
  renderMetaUI();
  renderHeroSelectCards();
  await SaveManager.fetchLeaderboard();
})();
