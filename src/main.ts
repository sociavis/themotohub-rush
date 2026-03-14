import * as THREE from 'three';
import { lerp, dst, T } from './game/themes';
import { R, scene, camera, cam, camTargets, gridMat, gridBaseOpacity, ptL, ptL2, grid, warpGrid } from './game/renderer';
import { I, mob, setupInputListeners, updateMouse3D, getCursorRing, arrowLeft, arrowRight, arrowUp } from './game/input';
import { isSoundOn, sndClick, sndShockwave, sndSectionChange, sndAchievement, sndCheckpoint, sndLanding, sndJump, sndWheelie, sndWheelieEnd, sndSkid, startEngine, updateEngine, stopEngine } from './game/audio';
import { parts, Pt, MAXP, syncParticles, shocks, mkShock } from './game/particles';
import { mxBike, bikeGroup, resetBike, frame, fWheelGroup, rWheelGroup } from './game/bike';
import {
  mxTrackIdx, mxSpline, mxSplineLen, mxCPMeshes, s4,
  buildTrack, setVis, getTrackHeight, getBerm, nextTrack, setTrackIdx,
  dustTrail, tireTrail, mxRoostParts, mxAmbientParts,
  updateDustTrail, updateTireTrail, updateRoostParticles, updateAmbientParticles,
} from './game/track-builder';
import { MX_TRACKS, TRACK_W, MX_CHECKPOINTS } from './game/tracks';
import { achState, checkAch, showWRToast, loadAchState, mergeServerAchievements, getAchSaveData } from './game/achievements';
import { tickFPS, fps, updateHUD } from './game/hud';
import { globalStats, fetchGlobalStats, pushSessionStats, reportVisit, fmtMXTime, initStatsListeners, STATS_API, _mxRacesPushedLive, incrementMxRacesPushedLive } from './game/stats';
import { applyTheme } from './ui/theme-ui';
import { initContact } from './ui/contact';
import { startLoading } from './ui/loading';
import { initSoundToggle } from './game/sound-toggle';
import type { MXTimer } from './game/types';
import { isLoggedIn, updateBestTime, getServerAchievements, getServerUpgrades, saveProgressToServer } from './game/auth';
import { submitLapTime, fetchLeaderboard, fetchWorldRecord, getWRForTrack } from './game/leaderboard';
import { initShop, applyUpgrades, checkAchievementFunds, getSuspensionBonus, getTireGrip, mergeServerUpgrades, getUpgradeSaveData } from './game/shop';
import { initLeaderboardUI } from './ui/leaderboard-ui';
import { initProfileUI } from './ui/profile-ui';
import { showMainMenu, hideMainMenu } from './ui/main-menu';
import { showTrackSelect, hideTrackSelect } from './ui/track-select';
import { showPostRace, hidePostRace } from './ui/post-race';
import { showFullShop, showFullProfile, showFullAchievements, hideFullScreen } from './ui/full-screens';

// ── Game State ──
type GameScreen = 'menu' | 'track-select' | 'racing' | 'post-race' | 'shop' | 'profile' | 'achievements';
let currentScreen: GameScreen = 'menu';
let mxGameActive = false;
let mxAccel = false;

const mxTimer: MXTimer = {
  running: false, start: 0, lapStart: 0, lapTime: 0,
  bestLapTimes: {}, curTrack: 0, lap: 0, laps: 3,
  lastCP: -1, cpsHit: new Set(), clean: true, totalRaces: 0,
  airTime: 0, maxAir: 0,
};

function resetMX(): void {
  resetBike();
  applyUpgrades();
  mxTimer.running = false; mxTimer.lap = 0; mxTimer.lastCP = -1;
  mxTimer.cpsHit.clear(); mxTimer.clean = true; mxTimer.airTime = 0;
  dustTrail.length = 0; tireTrail.length = 0;
  mxRoostParts.length = 0; mxAmbientParts.length = 0;
  const sp = mxSpline!.getPointAt(0);
  mxBike.pos.set(sp.x, 0, sp.z);
  bikeGroup.position.copy(mxBike.pos);
}

// ── HUD Visibility ──
function setHUDVisible(visible: boolean): void {
  const els = [
    'bottomActions', 'achTray', 'wheelieBtn', 'wmLogo',
  ];
  const hudPanels = document.querySelectorAll('.hud-panel, .hud-corner, .bottom-bar');
  for (const id of els) {
    const e = document.getElementById(id);
    if (e) e.style.display = visible ? '' : 'none';
  }
  hudPanels.forEach(e => (e as HTMLElement).style.display = visible ? '' : 'none');
}

// ── Game Flow ──
function goToMainMenu(): void {
  currentScreen = 'menu';
  mxGameActive = false;
  mxAccel = false;
  mxTimer.running = false;
  if (isSoundOn()) stopEngine();
  setHUDVisible(false);
  showMainMenu((action) => {
    hideMainMenu();
    if (action === 'race') goToTrackSelect();
    else if (action === 'shop') goToShop();
    else if (action === 'profile') goToProfile();
    else if (action === 'achievements') goToAchievements();
  });
}

function goToTrackSelect(): void {
  currentScreen = 'track-select';
  setHUDVisible(false);
  showTrackSelect(mxTimer.bestLapTimes, (trackIdx) => {
    hideTrackSelect();
    startRace(trackIdx);
  }, () => {
    hideTrackSelect();
    goToMainMenu();
  });
}

function startRace(trackIdx: number): void {
  currentScreen = 'racing';
  setTrackIdx(trackIdx);
  sectionEnter();
  setHUDVisible(true);
  // Auto-start countdown
  setTimeout(() => startRaceCountdown(), 500);
}

function goToPostRace(trackIdx: number, lapTime: number, isNewBest: boolean): void {
  currentScreen = 'post-race';
  setHUDVisible(false);
  if (isSoundOn()) stopEngine();
  showPostRace(trackIdx, mxTimer.bestLapTimes, lapTime, isNewBest, mxTimer.laps, (action) => {
    hidePostRace();
    if (action === 'retry') startRace(trackIdx);
    else if (action === 'track-select') goToTrackSelect();
    else if (action === 'menu') goToMainMenu();
  });
}

function goToShop(): void {
  currentScreen = 'shop';
  showFullShop(() => {
    hideFullScreen('fullShop');
    goToMainMenu();
  });
}

function goToProfile(): void {
  currentScreen = 'profile';
  showFullProfile(() => {
    hideFullScreen('fullProfile');
    goToMainMenu();
  });
}

function goToAchievements(): void {
  currentScreen = 'achievements';
  showFullAchievements(() => {
    hideFullScreen('fullAchievements');
    goToMainMenu();
  });
}

// ── Section Logic ──
function sectionEnter(): void {
  mxGameActive = true;
  buildTrack();
  resetMX();
  setVis();
  grid.visible = true;
  if (isSoundOn()) startEngine();
  // Fetch leaderboard for current track
  const trackName = MX_TRACKS[mxTrackIdx].name;
  fetchLeaderboard(trackName);
  fetchWorldRecord(trackName);
}

let mxCountdown = 0;
let mxCountdownActive = false;

function startRaceCountdown(): void {
  if (mxCountdownActive || mxTimer.running) return;
  mxCountdownActive = true;
  mxCountdown = 3;
  const cdEl = document.getElementById('raceCountdown')!;
  cdEl.style.display = 'flex';
  cdEl.textContent = '3';
  cdEl.style.opacity = '1';
  sndClick();

  const tick = () => {
    mxCountdown--;
    if (mxCountdown > 0) {
      cdEl.textContent = String(mxCountdown);
      sndClick();
      setTimeout(tick, 1000);
    } else {
      cdEl.textContent = 'GO!';
      sndShockwave();
      // Start race
      mxTimer.running = true;
      mxTimer.start = performance.now() / 1000;
      mxTimer.lapStart = mxTimer.start;
      mxTimer.lapTime = 0; mxTimer.lap = 0;
      mxTimer.cpsHit.clear(); mxTimer.lastCP = -1;
      mxTimer.clean = true; mxTimer.airTime = 0;
      mxCountdownActive = false;
      setTimeout(() => {
        cdEl.style.opacity = '0';
        setTimeout(() => { cdEl.style.display = 'none'; }, 400);
      }, 600);
    }
  };
  setTimeout(tick, 1000);
}

function sectionClick(): void {
  achState.clicksPerSec[0]++;
  if (currentScreen !== 'racing') return;
  sndClick();
  if (!mxTimer.running && !mxCountdownActive && mxBike.speed < 0.5) {
    startRaceCountdown();
  }
  if (mxTimer.running) mxAccel = true;
}

function sectionRelease(): void {
  mxAccel = false;
}

// ── Hints ──
const HINTS = [mob ? '[ Tap and hold to race — Slide to steer — Wheelie button to pop ]' : '[ Click/Arrow Up to race — Cursor or Arrow Keys to steer — Space for wheelie ]'];
const hintEl = document.getElementById('hintLine')!;

function cycleHint(): void {
  hintEl.classList.remove('visible');
  setTimeout(() => {
    hintEl.textContent = HINTS[0];
    hintEl.classList.add('visible');
    setTimeout(() => {
      hintEl.classList.remove('visible');
      setTimeout(cycleHint, 4000);
    }, 2500);
  }, 800);
}

// ── MX Update ──
function updateMX(t: number): void {
  if (!mxGameActive || !mxSpline) return;
  const dt = Math.min(0.033, 1 / 60);
  let curPt = mxSpline.getPointAt(mxBike.t);
  let curTan = mxSpline.getTangentAt(mxBike.t).normalize();
  let curNorm = new THREE.Vector3(-curTan.z, 0, curTan.x);

  // Steering (mouse, touch, or arrow keys)
  let latTarget = 0;
  if (arrowLeft || arrowRight) {
    const arrowDir = (arrowRight ? 1 : 0) - (arrowLeft ? 1 : 0);
    latTarget = Math.max(-0.85, Math.min(0.85, mxBike.lat + arrowDir * mxBike.turnSpeed * dt * 1.2));
  } else if (mob) {
    const touchOff = (I.tx - innerWidth / 2) / (innerWidth / 2);
    latTarget = Math.max(-0.85, Math.min(0.85, mxBike.lat + touchOff * mxBike.turnSpeed * dt * 1.5));
  } else {
    const toBikeX = I.mx - mxBike.pos.x;
    const toBikeZ = I.mz - mxBike.pos.z;
    latTarget = Math.max(-0.85, Math.min(0.85, (toBikeX * curNorm.x + toBikeZ * curNorm.z) * 0.18));
  }
  // Smooth, stable steering — no feedback oscillation
  const prevLat = mxBike.lat;
  mxBike.lat = lerp(mxBike.lat, latTarget, mxBike.turnSpeed * dt * 0.8);
  mxBike.lat = Math.max(-0.85, Math.min(0.85, mxBike.lat));
  // Drift factor tracks actual rate of lateral change (for lean/effects only)
  mxBike.driftFactor = lerp(mxBike.driftFactor, (mxBike.lat - prevLat) / Math.max(dt, 0.001), 0.15);

  // Berm assist
  const bermForce = getBerm(mxBike.t);
  if (bermForce !== 0) {
    mxBike.lat = lerp(mxBike.lat, mxBike.lat + bermForce, 0.12);
    mxBike.speed *= 1.008;
    if (mxBike.speed > 6) achState.mxBermHits = (achState.mxBermHits || 0) + 1;
  }
  // Lean into turns — based on lateral position and speed
  const speedLeanFactor = Math.min(mxBike.speed / mxBike.maxSpeed, 1);
  const leanTarget = mxBike.lat * 0.6 * speedLeanFactor + mxBike.driftFactor * 0.008;
  mxBike.lean = lerp(mxBike.lean, leanTarget, 0.12);

  // Terrain friction based on environment type
  const trk = MX_TRACKS[mxTrackIdx];
  let terrainFriction = 1.0;
  if (trk.envType === 'ice') terrainFriction = 0.85;
  else if (trk.envType === 'jungle') terrainFriction = 0.93;
  else if (trk.envType === 'volcanic') terrainFriction = 0.95;

  // Cornering speed loss (gentle — realistic MX bikes hold speed through turns)
  const corneringLoss = 1 - Math.abs(mxBike.driftFactor) * 0.012 * getTireGrip();

  // Speed (arrow up also accelerates)
  if ((mxAccel || arrowUp) && mxTimer.running) {
    const targetSpeed = mxBike.maxSpeed;
    const ratio = mxBike.speed / targetSpeed;
    const launchBoost = mxBike.speed < 4 ? 3.5 : mxBike.speed < 8 ? 1.6 : 1;
    const accelF = (1 - ratio * ratio) * mxBike.accel * dt * 0.22 * launchBoost * terrainFriction;
    mxBike.speed = Math.min(mxBike.speed + accelF, targetSpeed);
    mxBike.speed *= corneringLoss;
  } else if (mxTimer.running) {
    // Progressive braking — coast speed depends on how long not accelerating
    const coastTarget = mxBike.maxSpeed * 0.25 * terrainFriction;
    mxBike.speed = lerp(mxBike.speed, coastTarget, 0.018);
    mxBike.speed *= corneringLoss;
  } else {
    mxBike.speed = lerp(mxBike.speed, 0, mxBike.brake * dt * 0.06);
  }

  // Wheelie mechanics — front tire UP, back tire DOWN
  if (I.space && mxTimer.running && !mxBike.airborne && mxBike.speed > 3) {
    if (!mxBike.wheelie) {
      mxBike.wheelie = true;
      mxBike.wheelieBalance = 0;
      mxBike.wheelieTime = 0;
      if (isSoundOn()) sndWheelie();
    }
    mxBike.wheelieTime += dt;
    // Balance drifts — more forgiving, player must keep cursor centered
    const balanceDrift = (Math.random() - 0.5) * 1.0 * dt;
    const steerCorrection = -mxBike.lat * 0.3 * dt;
    mxBike.wheelieBalance += balanceDrift + steerCorrection;
    mxBike.wheelieBalance = Math.max(-1, Math.min(1, mxBike.wheelieBalance));
    // Speed bonus while wheeling
    mxBike.speed = Math.min(mxBike.speed * (1 + 0.003 * dt * 60), mxBike.maxSpeed * 1.15);
    // Turning penalty
    mxBike.lat *= 0.97;
    // Bail if balance is too far off
    if (Math.abs(mxBike.wheelieBalance) > 0.95) {
      mxBike.wheelie = false;
      mxBike.speed *= 0.75;
      mxBike.wheelieBalance = 0;
      if (isSoundOn()) sndWheelieEnd();
    }
    // Track achievement
    if (mxBike.wheelieTime > (achState.mxMaxAir || 0)) achState.mxMaxAir = mxBike.wheelieTime;
  } else if (mxBike.wheelie) {
    mxBike.wheelie = false;
    mxBike.wheelieBalance = 0;
    if (isSoundOn()) sndWheelieEnd();
  }

  // Off-track penalty
  if (Math.abs(mxBike.lat) > 0.9) { mxBike.speed *= 0.96; mxTimer.clean = false; }

  // Move along spline
  const splineLen = mxSplineLen;
  if (splineLen > 0) {
    const prevT = mxBike.t;
    mxBike.t += mxBike.speed * dt / splineLen;
    if (mxBike.t >= 1 && mxTimer.running) {
      mxBike.t -= 1;
      if (mxTimer.cpsHit.size >= MX_CHECKPOINTS) {
        const now = performance.now() / 1000;
        const lapTime = now - mxTimer.lapStart;
        mxTimer.lapTime = lapTime; mxTimer.lapStart = now;
        const tn = MX_TRACKS[mxTrackIdx].name;
        const isNewBest = !mxTimer.bestLapTimes[tn] || lapTime < mxTimer.bestLapTimes[tn];
        if (isNewBest) mxTimer.bestLapTimes[tn] = lapTime;
        if (!achState.mxBestTime || lapTime < achState.mxBestTime) achState.mxBestTime = lapTime;

        if (isNewBest) {
          const isGlobalWR = !globalStats['wr_' + tn] || globalStats['wr_' + tn] === 0 || lapTime < globalStats['wr_' + tn];
          const wrPush: Record<string, number> = {
            ['wr_' + tn]: Math.round(lapTime * 100) / 100,
            mxRaces: 0, mxBestTime: Math.round(lapTime * 100) / 100,
            pulses: 0, trail: 0, wins: 0, freqs: 0, distance: 0, time: 0, achievements: 0, topSpeed: 0,
          };
          fetch(STATS_API + '?action=push', { method: 'POST', body: JSON.stringify(wrPush) })
            .then(() => fetchGlobalStats()).catch(() => {});
          showWRToast(tn, lapTime, isGlobalWR, fmtMXTime);
          // Update user best time in auth system
          updateBestTime(tn, lapTime);
        }

        // Submit lap time to server leaderboard if logged in
        if (isLoggedIn()) {
          submitLapTime(tn, lapTime, mxTimer.clean, mxTimer.maxAir, mxTimer.laps);
        }

        mxTimer.lap++; mxTimer.cpsHit.clear(); sndSectionChange();
        for (let i = 0; i < 15 && parts.length < MAXP; i++) {
          const a = Math.random() * Math.PI * 2; const sp = Math.random() * 0.4 + 0.1;
          parts.push(new Pt(mxBike.pos.x, 1, mxBike.pos.z, Math.cos(a) * sp, Math.random() * 0.5, Math.sin(a) * sp, T().secondary, 2 + Math.random() * 2, 0.15 + Math.random() * 0.2));
        }

        if (mxTimer.lap >= mxTimer.laps) {
          mxTimer.running = false; mxAccel = false;
          mxTimer.totalRaces++; achState.mxRacesCompleted++;
          incrementMxRacesPushedLive();
          fetch(STATS_API + '?action=push', { method: 'POST', body: JSON.stringify({ mxRaces: 1, pulses: 0, trail: 0, wins: 0, freqs: 0, distance: 0, time: 0, achievements: 0, topSpeed: 0, mxBestTime: 0 }) })
            .then(() => fetchGlobalStats()).catch(() => {});
          achState.mxLaps += mxTimer.laps;
          if (mxTimer.clean) achState.mxCleanLaps++;
          let allDone = true;
          for (const tr of MX_TRACKS) if (!mxTimer.bestLapTimes[tr.name]) allDone = false;
          if (allDone) achState.mxTracksCompleted = MX_TRACKS.length;

          for (let i = 0; i < 50 && parts.length < MAXP; i++) {
            const a = Math.random() * Math.PI * 2; const sp = Math.random() * 0.8 + 0.2;
            const colors = [T().primary, T().secondary, T().accent];
            const c = colors[Math.floor(Math.random() * colors.length)];
            parts.push(new Pt(mxBike.pos.x, 1.5 + Math.random(), mxBike.pos.z, Math.cos(a) * sp, Math.random() * 1.0 + 0.2, Math.sin(a) * sp, c, 3 + Math.random() * 4, 0.15 + Math.random() * 0.35));
          }
          sndAchievement();
          // Show post-race screen after celebration particles
          const finishedTrackIdx = mxTrackIdx;
          const finishedLapTime = lapTime;
          const finishedIsNewBest = isNewBest;
          setTimeout(() => {
            mxGameActive = false;
            goToPostRace(finishedTrackIdx, finishedLapTime, finishedIsNewBest);
          }, 2500);
        }
      } else {
        mxBike.t = prevT;
      }
    }
  }

  // Checkpoint detection
  for (const cp of mxCPMeshes) {
    const cpT = cp.userData.cpT; const cpIdx = cp.userData.cpIdx;
    if (!mxTimer.cpsHit.has(cpIdx)) {
      const diff = Math.abs(mxBike.t - cpT);
      if (diff < 0.04 || diff > 0.96) { mxTimer.cpsHit.add(cpIdx); sndCheckpoint(); }
    }
  }

  // Hills / airborne
  const trackH = getTrackHeight(mxBike.t);
  if (!mxBike.airborne) {
    const nextH = getTrackHeight(Math.min(mxBike.t + 0.008, 0.999));
    const slope = (trackH - nextH) / 0.008; // slope steepness
    if (trackH > 0.3 && nextH < trackH - 0.08 && mxBike.speed > 4) {
      mxBike.airborne = true;
      // Slope-based jump velocity — steeper slopes = bigger air
      const slopeFactor = Math.min(slope * 0.15, 1.5);
      mxBike.jumpVel = mxBike.speed * (0.18 + slopeFactor * 0.08);
      mxBike.hOff = trackH; sndJump();
    } else {
      mxBike.hOff = trackH;
    }
  } else {
    mxBike.jumpVel -= 10 * dt; mxBike.hOff += mxBike.jumpVel * dt;
    mxTimer.airTime += dt;
    if (mxTimer.airTime > achState.mxMaxAir) achState.mxMaxAir = mxTimer.airTime;
    if (mxBike.hOff <= trackH) {
      mxBike.hOff = trackH; mxBike.airborne = false;
      // Landing impact — smooth landings give speed boost, hard landings penalize
      // Suspension upgrade reduces penalties and improves boosts
      const suspBonus = getSuspensionBonus();
      const impactVel = Math.abs(mxBike.jumpVel);
      if (impactVel < 2) {
        mxBike.speed = Math.min(mxBike.speed * (1.08 + (suspBonus - 1) * 0.1), mxBike.maxSpeed * 1.12);
      } else if (impactVel > 4) {
        mxBike.speed *= (0.92 + (suspBonus - 1) * 0.2); // suspension absorbs hard landings
      } else {
        mxBike.speed = Math.min(mxBike.speed * (1.03 + (suspBonus - 1) * 0.05), mxBike.maxSpeed * 1.08);
      }
      mxBike.jumpVel = 0; sndLanding(); mxTimer.airTime = 0;
      // End wheelie on landing
      if (mxBike.wheelie) { mxBike.wheelie = false; mxBike.wheelieBalance = 0; }
      const landingParts = impactVel > 3 ? 12 : 8;
      for (let i = 0; i < landingParts && parts.length < MAXP; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 0.2 + impactVel * 0.08;
        parts.push(new Pt(mxBike.pos.x, 0.1, mxBike.pos.z, Math.cos(a) * sp, Math.random() * 0.2 + impactVel * 0.04, Math.sin(a) * sp, T().primary, 1.2 + Math.random(), 0.1 + impactVel * 0.02));
      }
    }
  }

  // Position bike
  curPt = mxSpline.getPointAt(mxBike.t);
  curTan = mxSpline.getTangentAt(mxBike.t).normalize();
  curNorm.set(-curTan.z, 0, curTan.x);

  const suspFreq = 8 + mxBike.speed * 0.4;
  mxBike.suspBob = Math.sin(t * suspFreq) * 0.025 * (mxBike.speed / mxBike.maxSpeed) + Math.sin(t * suspFreq * 2.3) * 0.008;
  // Position bike — keep above track surface (0.35 base clearance prevents sinking on hills)
  const groundY = mxBike.airborne ? mxBike.hOff : Math.max(mxBike.hOff, trackH);
  mxBike.pos.set(
    curPt.x + curNorm.x * mxBike.lat * TRACK_W * 0.8,
    groundY + 0.35 + mxBike.suspBob,
    curPt.z + curNorm.z * mxBike.lat * TRACK_W * 0.8,
  );
  mxBike.angle = Math.atan2(curTan.x, curTan.z);
  bikeGroup.position.copy(mxBike.pos);
  bikeGroup.rotation.y = mxBike.angle;
  bikeGroup.rotation.z = mxBike.lean * 0.7;
  // Tilt: negative = front up. Wheelie: strong front-up; Airborne: slight nose-up; Accel: slight nose-up (torque feel)
  const tiltTarget = mxBike.wheelie ? -0.65 : mxBike.airborne ? -0.2 : (mxAccel ? -0.06 : 0.02);
  bikeGroup.rotation.x = lerp(bikeGroup.rotation.x || 0, tiltTarget, mxBike.wheelie ? 0.25 : 0.1);

  // Wheel spin
  fWheelGroup.rotation.x += mxBike.speed * dt * 4;
  rWheelGroup.rotation.x += mxBike.speed * dt * 4;

  // Wheelie particles
  if (mxBike.wheelie && mxBike.speed > 4 && parts.length < MAXP) {
    // Sparks from rear wheel
    const sparkChance = 0.4 + mxBike.speed * 0.03;
    if (Math.random() < sparkChance) {
      const a = Math.random() * Math.PI * 2;
      parts.push(new Pt(
        mxBike.pos.x - curTan.x * 0.4, 0.05, mxBike.pos.z - curTan.z * 0.4,
        Math.cos(a) * 0.15, Math.random() * 0.3, Math.sin(a) * 0.15,
        T().secondary, 0.6 + Math.random() * 0.4, 0.06 + Math.random() * 0.04,
      ));
    }
  }

  // Skid sound + tire smoke at high speeds with heavy cornering
  if (!mxBike.airborne && mxBike.speed > 10 && Math.abs(mxBike.driftFactor) > 0.4 && isSoundOn() && Math.random() < 0.05) {
    sndSkid();
  }
  if (!mxBike.airborne && mxBike.speed > 8 && Math.abs(mxBike.driftFactor) > 0.3 && parts.length < MAXP) {
    if (Math.random() < 0.5) {
      parts.push(new Pt(
        mxBike.pos.x - curTan.x * 0.3, 0.1, mxBike.pos.z - curTan.z * 0.3,
        (Math.random() - 0.5) * 0.1, Math.random() * 0.08, (Math.random() - 0.5) * 0.1,
        [180, 180, 180], 1.5 + Math.random(), 0.15 + Math.random() * 0.1,
      ));
    }
  }

  // Visual updates
  const bikeGrounded = !mxBike.airborne && mxBike.hOff - trackH < 0.15;
  updateDustTrail(mxBike.pos, curTan, trackH, mxBike.speed, bikeGrounded);
  updateTireTrail(mxBike.pos, curTan, mxBike.speed, mxBike.airborne);
  updateRoostParticles(dt, mxBike.speed, bikeGrounded, mxBike.pos, curTan, trackH);
  updateAmbientParticles(dt, t, mxBike.pos);

  (frame.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.5 + (mxAccel ? 0.2 : 0);
  warpGrid(t, mxBike.pos.x, mxBike.pos.z, 0.6 + mxBike.speed * 0.05);

  if (isSoundOn()) updateEngine(mxBike.speed, mxBike.maxSpeed, mxAccel);
}

// ── Initialize ──
function startGame(): void {
  // Show main menu instead of directly entering race
  setHUDVisible(false);
  goToMainMenu();

  const t0 = performance.now();
  const cr = getCursorRing();

  function animate(): void {
    requestAnimationFrame(animate);
    const t = (performance.now() - t0) / 1000;

    I.x = lerp(I.x, I.tx, 0.12);
    I.y = lerp(I.y, I.ty, 0.12);
    I.crx = lerp(I.crx, I.tx, 0.18);
    I.cry = lerp(I.cry, I.ty, 0.18);
    if (!mob) { cr.style.left = I.crx + 'px'; cr.style.top = I.cry + 'px'; }
    I.vel = dst(I.x, I.y, I.px, I.py);
    I.px = I.x; I.py = I.y;
    if (I.down) I.holdTime += 0.016;

    updateMouse3D(camera);
    gridMat.opacity = gridBaseOpacity;

    // Camera
    const ct = camTargets[0];
    const mx = I.rx - 0.5;
    let cTargetX = ct.px + mx * 4, cTargetY = ct.py, cTargetZ = ct.pz + (I.ry - 0.5) * 3;
    let cLookX = ct.lx, cLookY = ct.ly, cLookZ = ct.lz;
    if (mxGameActive && mxSpline) {
      const mxTan = mxSpline.getTangentAt(mxBike.t).normalize();
      cTargetX = mxBike.pos.x * 0.75; cTargetY = 18 + mxBike.hOff * 0.5; cTargetZ = mxBike.pos.z * 0.75 + 12;
      cLookX = mxBike.pos.x * 0.75 + mxTan.x * 3; cLookZ = mxBike.pos.z * 0.75 + mxTan.z * 3;
    }
    cam.px = lerp(cam.px, cTargetX, 0.09);
    cam.py = lerp(cam.py, cTargetY, 0.09);
    cam.pz = lerp(cam.pz, cTargetZ, 0.09);
    cam.lx = lerp(cam.lx, cLookX, 0.10);
    cam.ly = lerp(cam.ly, cLookY, 0.10);
    cam.lz = lerp(cam.lz, cLookZ, 0.10);
    camera.position.set(cam.px, cam.py, cam.pz);
    camera.lookAt(cam.lx, cam.ly, cam.lz);

    ptL.position.x = lerp(ptL.position.x, I.mx * 0.4, 0.04);
    ptL.position.z = lerp(ptL.position.z, I.mz * 0.4, 0.04);
    ptL.intensity = 3 + (I.down ? I.holdTime : 0);
    ptL2.intensity = 1.5;

    updateMX(t);
    updateHUD(mxBike, mxTimer, mxTrackIdx, mxAccel);
    tickFPS(t);
    achState.elapsed = t;
    if (I.vel > achState.maxVel) achState.maxVel = I.vel;
    achState.totalDist += I.vel;
    checkAch();
    checkAchievementFunds();

    R.render(scene, camera);
  }
  animate();
}

function init(): void {
  initContact();
  initSoundToggle();
  initStatsListeners(mxTimer);
  loadAchState();
  initShop();

  // Merge server-side progress if logged in
  if (isLoggedIn()) {
    mergeServerAchievements(getServerAchievements());
    mergeServerUpgrades(getServerUpgrades());
  }

  // Sync progress to server periodically
  if (isLoggedIn()) {
    setInterval(() => {
      saveProgressToServer(getAchSaveData(), getUpgradeSaveData());
    }, 30000);
  }

  initLeaderboardUI();
  initProfileUI();
  reportVisit();
  fetchGlobalStats();
  setInterval(() => fetchGlobalStats(), 15000);

  window.addEventListener('beforeunload', () => pushSessionStats(mxTimer));
  window.addEventListener('pagehide', () => pushSessionStats(mxTimer));

  setupInputListeners(applyTheme, () => {}, sectionClick, sectionRelease);
  applyTheme(0);

  // Loading screen → welcome screen → game start
  startLoading(startGame);
}

init();
