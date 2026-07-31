import * as THREE from 'three';
import { lerp, dst, T } from './game/themes';
import { R, scene, camera, cam } from './game/renderer';
import { I, mob, TC, setupInputListeners, updateMouse3D, getCursorRing, arrowLeft, arrowRight, arrowUp, arrowDown } from './game/input';
import { initAudio, isSoundOn, sndClick, sndShockwave, sndSectionChange, sndAchievement, sndCheckpoint, sndLanding, sndJump, sndWheelie, sndWheelieEnd, sndSkid, startEngine, updateEngine, stopEngine } from './game/audio';
import { parts, Pt, MAXP, syncParticles, shocks, mkShock } from './game/particles';
import { mxBike, bikeGroup, resetBike, updateSuspension, spinWheels, initHeroBike, updateRiderPose } from './game/bike';
import { setRiderNumber } from './game/bike-glb';
import {
  mxTrackIdx, mxSpline, mxSplineLen, mxCPMeshes, s4,
  buildTrack, setVis, getTrackHeight, getBerm, getBermRise, nextTrack, setTrackIdx,
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
import { isLoggedIn, getUser, updateBestTime, getServerAchievements, getServerUpgrades, saveProgressToServer, getToken } from './game/auth';
import { submitLapTime, fetchLeaderboard, fetchWorldRecord, getWRForTrack } from './game/leaderboard';
import { initShop, applyUpgrades, checkAchievementFunds, getSuspensionBonus, getTireGrip, mergeServerUpgrades, getUpgradeSaveData, onBikeColorChange } from './game/shop';
import { initLeaderboardUI } from './ui/leaderboard-ui';
import { initProfileUI } from './ui/profile-ui';
import { showMainMenu, hideMainMenu } from './ui/main-menu';
import { showTrackSelect, hideTrackSelect } from './ui/track-select';
import { showPostRace, hidePostRace } from './ui/post-race';
import { showFullShop, showFullProfile, showFullAchievements, hideFullScreen } from './ui/full-screens';

// ── Embed mode (TheMotoHub / iframe hosting) ──
import { IS_EMBED, postToHost, initHostBridge, installBackButton, lockLandscapeInApp } from './game/host-bridge';
import { storeGet, storeSet, storeRemove } from './game/safe-storage';
import { url as gameUrl } from './game/base-url';
import { showNumberSetup } from './ui/number-setup';
export { IS_EMBED };
if (IS_EMBED) document.body.classList.add('embed');
initHostBridge();
installBackButton();
lockLandscapeInApp();

// ── Game State ──
type GameScreen = 'menu' | 'track-select' | 'racing' | 'post-race' | 'shop' | 'profile' | 'achievements';
let currentScreen: GameScreen = 'menu';

// ── Landscape gate: the game requires landscape on touch devices ──
// TheMotoHub's iOS shell now permits landscape (Info.plist), so this gate
// is satisfiable in-app as well as in a mobile browser.
const rotateOverlay = document.getElementById('rotateOverlay')!;
const isTouchDevice = matchMedia('(pointer: coarse)').matches;
let rotateHintShown = false;
function updateRotateGuard(): void {
  const shouldShow = isTouchDevice && innerHeight > innerWidth;
  if (shouldShow !== rotateHintShown) {
    rotateHintShown = shouldShow;
    rotateOverlay.classList.toggle('show', shouldShow);
  }
}
window.addEventListener('resize', updateRotateGuard);
window.addEventListener('orientationchange', updateRotateGuard);
setInterval(updateRotateGuard, 800);
let mxGameActive = false;
let mxAccel = false;

// Rider figure removed for now — a dedicated rider model import is planned.

// ── Suspension spring state ──
let fComp = 0, fVel = 0, rComp = 0, rVel = 0;
let camShake = 0;

function springStep(c: number, v: number, target: number, dt: number): [number, number] {
  const a = (target - c) * 80 - v * 11;
  v += a * dt;
  c += v * dt;
  if (c < 0) { c = 0; v = Math.max(v, 0); }
  if (c > 1) { c = 1; v = Math.min(v, 0); }
  return [c, v];
}

const mxTimer: MXTimer = {
  running: false, start: 0, lapStart: 0, lapTime: 0,
  bestLapTimes: {}, curTrack: 0, lap: 0, laps: 3,
  lastCP: -1, cpsHit: new Set(), clean: true, totalRaces: 0,
  airTime: 0, maxAir: 0,
};

function resetMX(): void {
  resetBike();
  mxKappaS = 0;
  mxShiftTimer = 0;
  applyUpgrades();
  mxTimer.running = false; mxTimer.lap = 0; mxTimer.lastCP = -1;
  mxTimer.cpsHit.clear(); mxTimer.clean = true; mxTimer.airTime = 0;
  dustTrail.length = 0; tireTrail.length = 0;
  mxRoostParts.length = 0; mxAmbientParts.length = 0;
  const sp = mxSpline!.getPointAt(0);
  mxBike.pos.set(sp.x, getTrackHeight(0) + 0.35, sp.z);
  bikeGroup.position.copy(mxBike.pos);
  const tan0 = mxSpline!.getTangentAt(0);
  bikeGroup.rotation.set(0, Math.atan2(tan0.x, tan0.z), 0);
}

// ── HUD Visibility ──
function setHUDVisible(visible: boolean): void {
  const els = [
    'bottomActions', 'achTray', 'wmLogo',
  ];
  const hudPanels = document.querySelectorAll('.hud-panel, .hud-corner, .bottom-bar');
  for (const id of els) {
    const e = document.getElementById(id);
    if (e) e.style.display = visible ? '' : 'none';
  }
  hudPanels.forEach(e => (e as HTMLElement).style.display = visible ? '' : 'none');
  if (mob) document.body.classList.toggle('mob-racing', visible);
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
  fComp = 0; fVel = 0; rComp = 0; rVel = 0; camShake = 0;
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
      if (I.down || arrowUp) mxAccel = true; // holding through the gate drop
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
  if (isSoundOn()) initAudio();   // first tap brings the audio context up
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
const HINTS = [mob ? '[ Left stick: steer + lean — lean back on the gas to wheelie — GAS / BRAKE right ]' : '[ W/UP gas — S/DOWN brake — A/D steer — SPACE wheelie ]'];
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

// Frame profiler (?prof=1) — logs CPU cost per section every 5 frames
const PROF = new URLSearchParams(location.search).has('prof');
let __profN = 0, __profMX = 0, __profHUD = 0, __profRender = 0, __profFrame = 0;

// ── MX Update ──
const GRAV = 16;              // gravity while airborne (m/s²) — snappy MX arcs
let mxGroundSlope = 0;        // dh/ds at the bike (positive = climbing)
let mxShiftTimer = 0;         // gear-change clutch drop
let mxKappaS = 0;             // low-passed track curvature

// Terrain slope (rise per meter of travel) at spline position tP
function groundSlopeAt(tP: number): number {
  if (mxSplineLen <= 0) return 0;
  const d = 0.0015;
  return (getTrackHeight(tP + d) - getTrackHeight(tP - d)) / (2 * d * mxSplineLen);
}

function updateMX(t: number): void {
  if (!mxGameActive || !mxSpline) return;
  const dt = Math.min(0.033, 1 / 60);
  let curPt = mxSpline.getPointAt(mxBike.t);
  let curTan = mxSpline.getTangentAt(mxBike.t).normalize();
  let curNorm = new THREE.Vector3(-curTan.z, 0, curTan.x);
  mxGroundSlope = groundSlopeAt(mxBike.t);

  // Unified inputs: desktop = mouse/keys, mobile = dedicated touch controls
  const accelOn = mob ? TC.throttle : arrowUp;
  const brakeOn = mob ? TC.brake : arrowDown;

  // ═══ RIDING DYNAMICS ═══
  // Steering carries momentum and spends a shared grip budget. The track's
  // curvature consumes grip first (cornering load) — overcook a flat corner
  // and the front washes wide; berms bank the turn and multiply grip, so
  // railing the berm is the fast line, like real supercross.

  // -- steering input (-1..1) --
  let steerIn = 0;
  if (mob) {
    steerIn = TC.active ? TC.steer : 0;
  } else {
    steerIn = (arrowRight ? 1 : 0) - (arrowLeft ? 1 : 0);
  }

  // -- signed track curvature at the bike (left turn > 0), low-passed:
  // raw spline curvature has spikes at knots that read as phantom washouts --
  const wrapT = (v: number) => ((v % 1) + 1) % 1;
  const dTc = 0.008;
  const tanBack = mxSpline.getTangentAt(wrapT(mxBike.t - dTc)).normalize();
  const tanFwd = mxSpline.getTangentAt(wrapT(mxBike.t + dTc)).normalize();
  const crossY = tanBack.z * tanFwd.x - tanBack.x * tanFwd.z;
  const dotTan = tanBack.x * tanFwd.x + tanBack.z * tanFwd.z;
  const kappaRaw = Math.atan2(crossY, dotTan) / Math.max(2 * dTc * mxSplineLen, 0.01);
  mxKappaS = lerp(mxKappaS, kappaRaw, 0.12);
  const kappa = mxKappaS;
  const washDir = Math.sign(kappa) || 0;   // outward = lat+ on left turns

  // -- terrain + tires --
  const trk = MX_TRACKS[mxTrackIdx];
  let terrainFriction = 1.0;
  if (trk.envType === 'ice') terrainFriction = 0.85;
  else if (trk.envType === 'jungle') terrainFriction = 0.93;
  else if (trk.envType === 'volcanic') terrainFriction = 0.95;

  const bermForce = getBerm(mxBike.t);
  const onBerm = bermForce !== 0;
  const inAir = mxBike.airborne;

  // -- grip budget (world m/s² of lateral capability) --
  let gripMax = 17.5 * terrainFriction * getTireGrip();
  if (onBerm) gripMax *= 2.3;
  const spinning = accelOn && !inAir && mxBike.speed > 0.5 && mxBike.speed < 5.5 && mxTimer.running;
  if (spinning) gripMax *= 0.75;

  // curvature of the bike's own line: inside lines arc tighter (more grip
  // needed), outside lines arc gentler (carry speed, longer path)
  const latWorldNow = mxBike.lat * TRACK_W * 0.8;
  const kappaEff = kappa / Math.max(0.35, 1 + kappa * latWorldNow);
  const cornerLoad = mxBike.speed * mxBike.speed * Math.abs(kappaEff);
  const gripLeft = Math.max(0, gripMax - cornerLoad);

  // -- lateral momentum steering (lat-units: world lateral / 2.4) --
  const LAT_SCALE = TRACK_W * 0.8;
  const steerAuthority = inAir ? 0.12 : Math.min(1, gripLeft / 8 + 0.25);
  mxBike.latVel += steerIn * mxBike.turnSpeed * 1.9 * steerAuthority * dt;
  // tires resist lateral sliding when planted; barely at all in the air
  const latDamp = inAir ? 0.6 : 5.5 * (0.6 + 0.4 * terrainFriction);
  mxBike.latVel -= mxBike.latVel * Math.min(1, latDamp * dt);

  // -- washout: cornering demand beyond grip pushes the bike wide --
  const overload = Math.max(0, cornerLoad - gripMax);
  if (overload > 0 && !inAir) {
    const wash = Math.min(overload / 14, 1.4);
    mxBike.latVel += washDir * (overload / LAT_SCALE) * 0.55 * dt;
    mxBike.speed *= 1 - 0.3 * wash * dt;               // scrubbing speed
    mxBike.slide = Math.min(1, mxBike.slide + wash * dt * 4);
    mxTimer.clean = false;
  } else {
    mxBike.slide = Math.max(0, mxBike.slide - dt * 3);
  }

  // wheelspin fishtail off the line
  if (spinning) mxBike.latVel += Math.sin(t * 24) * 0.5 * dt;

  // berm pull: the bank cradles the bike toward its pocket
  if (onBerm && !inAir) {
    mxBike.lat = lerp(mxBike.lat, mxBike.lat + bermForce, 0.10);
    if (mxBike.speed > 6) achState.mxBermHits = (achState.mxBermHits || 0) + 1;
  }

  mxBike.lat += mxBike.latVel * dt;
  if (mxBike.lat > 0.95) { mxBike.lat = 0.95; mxBike.latVel = Math.min(0, mxBike.latVel); }
  if (mxBike.lat < -0.95) { mxBike.lat = -0.95; mxBike.latVel = Math.max(0, mxBike.latVel); }
  mxBike.driftFactor = lerp(mxBike.driftFactor, mxBike.latVel * 2.2, 0.2);

  // -- lean into the corner, weight the outside on washes --
  const speedLeanFactor = Math.min(mxBike.speed / mxBike.maxSpeed, 1);
  const corneringLean = -washDir * Math.min(1, cornerLoad / Math.max(gripMax, 1)) * 0.85 * speedLeanFactor;
  const leanTarget = corneringLean + steerIn * 0.3 * speedLeanFactor + mxBike.latVel * 0.12;
  mxBike.lean = lerp(mxBike.lean, Math.max(-1, Math.min(1, leanTarget)), 0.10);

  // banking roll from the real surface slope under the bike
  const du = 0.15;
  const riseL = getBermRise(mxBike.t, mxBike.lat * 0.8 + du);
  const riseR = getBermRise(mxBike.t, mxBike.lat * 0.8 - du);
  const bankSlope = (riseL - riseR) / (2 * du * TRACK_W);
  mxBike.bank = lerp(mxBike.bank, -Math.atan(bankSlope) * 0.9, 0.12);

  // ═══ DRIVETRAIN — 3-speed box, rpm drives torque + engine audio ═══
  const braking = brakeOn && mxTimer.running && !mxBike.airborne;
  const gearTops = [0.42, 0.76, 1.02];
  let gear = 0;
  const spdRatio = mxBike.speed / mxBike.maxSpeed;
  while (gear < 2 && spdRatio > gearTops[gear]) gear++;
  if (gear !== mxBike.gear) { mxShiftTimer = 0.14; mxBike.gear = gear; }
  mxShiftTimer = Math.max(0, mxShiftTimer - dt);
  const gearLo = gear === 0 ? 0 : gearTops[gear - 1];
  const rpmRaw = (spdRatio - gearLo) / (gearTops[gear] - gearLo);
  const rpmTarget = mxShiftTimer > 0 ? 0.35
    : Math.max(0.12, Math.min(1, rpmRaw * (accelOn ? 1 : 0.55) + (spinning ? 0.45 : 0)));
  mxBike.rpm = lerp(mxBike.rpm, rpmTarget, 0.25);

  if (braking) {
    mxBike.speed = Math.max(0, mxBike.speed - mxBike.brake * terrainFriction * dt * 1.4);
  } else if (accelOn && mxTimer.running) {
    const targetSpeed = mxBike.maxSpeed;
    const ratio = mxBike.speed / targetSpeed;
    const launchBoost = mxBike.speed < 4 ? 3.2 : mxBike.speed < 8 ? 1.6 : 1;
    const slopeLoad = 1 - Math.max(-0.5, Math.min(0.5, mxGroundSlope)) * 0.55;
    // torque follows revs: soft at the bottom of each gear, pulls hard on top;
    // clutch drops during shifts; wheelspin wastes drive off the line
    const torque = (mxShiftTimer > 0 ? 0.35 : 0.7 + 0.5 * mxBike.rpm) * (spinning ? 0.7 : 1);
    const accelF = (1 - ratio * ratio) * mxBike.accel * dt * 0.22 * launchBoost * terrainFriction * slopeLoad * torque;
    mxBike.speed = Math.min(mxBike.speed + accelF, targetSpeed);
  } else if (mxTimer.running) {
    const coastTarget = mxBike.maxSpeed * 0.25 * terrainFriction;
    mxBike.speed = lerp(mxBike.speed, coastTarget, 0.018);
  } else {
    mxBike.speed = lerp(mxBike.speed, 0, mxBike.brake * dt * 0.06);
  }
  // cornering scrub while leaned over (mild; a banked berm carries the load)
  mxBike.speed *= 1 - Math.abs(mxBike.lean) * (onBerm ? 0.012 : 0.03) * dt;

  // Wheelie mechanics — a BALANCE GAME, not a held switch.
  // Entry: lean back hard on the gas with revs up (torque lofts the front).
  // Once up, the balance point drifts: throttle and lean-back rotate you
  // further back, speed and rough ground shake you, and you manage it by
  // modulating the stick (or steering on desktop). Drift too far back →
  // loop-out bail; let the nose drop → it just sets down.
  const wheelieIn = mob
    ? (mxBike.wheelie ? TC.leanY > 0.05 && accelOn : TC.leanY > 0.55 && accelOn && mxBike.rpm > 0.5)
    : I.space;
  if (wheelieIn && mxTimer.running && !mxBike.airborne && mxBike.speed > 3) {
    if (!mxBike.wheelie) {
      mxBike.wheelie = true;
      mxBike.wheelieBalance = -0.25;    // starts nose-heavy — feed it back
      mxBike.wheelieTime = 0;
      if (isSoundOn()) sndWheelie();
    }
    mxBike.wheelieTime += dt;
    // balance forces: torque rotates back, natural droop pulls forward,
    // lean input is the control, rough ground (chassis chatter) shakes it
    const torquePull = accelOn ? (0.35 + mxBike.rpm * 0.5) : -0.6;
    const droop = -0.45;
    const leanCtl = mob ? (TC.leanY - 0.45) * 1.6 : 0;
    const roughness = Math.min(1.2, Math.abs(mxBike.pitchVel) * 0.5);
    const shake = (Math.random() - 0.5) * (0.5 + roughness * 1.6 + (mxBike.speed / mxBike.maxSpeed) * 0.5);
    mxBike.wheelieBalance += (torquePull + droop + leanCtl + shake) * dt
      - mxBike.lat * 0.3 * dt;
    mxBike.wheelieBalance = Math.max(-1, Math.min(1, mxBike.wheelieBalance));
    // riding the sweet spot pays; hanging too far back is on the edge
    mxBike.speed = Math.min(mxBike.speed * (1 + 0.003 * dt * 60), mxBike.maxSpeed * 1.15);
    mxBike.lat *= 0.97;
    if (mxBike.wheelieBalance > 0.95) {
      // loop-out: hard bail, big speed loss
      mxBike.wheelie = false;
      mxBike.speed *= 0.6;
      mxBike.wheelieBalance = 0;
      mxBike.pitchVel += 3.5;
      if (isSoundOn()) sndWheelieEnd();
    } else if (mxBike.wheelieBalance < -0.9) {
      // nose dropped — clean set-down, no penalty
      mxBike.wheelie = false;
      mxBike.wheelieBalance = 0;
      if (isSoundOn()) sndWheelieEnd();
    }
    if (mxBike.wheelieTime > (achState.mxMaxAir || 0)) achState.mxMaxAir = mxBike.wheelieTime;
  } else if (mxBike.wheelie) {
    mxBike.wheelie = false;
    mxBike.wheelieBalance = 0;
    if (isSoundOn()) sndWheelieEnd();
  }

  // Off-track penalty (the berm bank itself is rideable track)
  if (Math.abs(mxBike.lat) > 0.9 && !onBerm) { mxBike.speed *= 0.96; mxTimer.clean = false; }

  // Move along spline — compensated for the bike's offset line so world
  // speed is true at the BIKE, not the centerline. Without this the bike is
  // effectively tethered to the track centre: outside lines got dragged
  // faster, inside lines held back. Now inside lines are genuinely shorter
  // (real racing lines) and corner speed feels honest.
  const splineLen = mxSplineLen;
  if (splineLen > 0) {
    const prevT = mxBike.t;
    const latWorld = mxBike.lat * TRACK_W * 0.8;
    const arcFactor = Math.max(0.6, Math.min(1.5, 1 + kappa * latWorld));
    mxBike.t += mxBike.speed * dt / (splineLen * arcFactor);
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
          postToHost({
            type: 'race-complete',
            track: MX_TRACKS[mxTrackIdx].name,
            lapTime: Math.round(lapTime * 100) / 100,
            bestLap: Math.round((mxTimer.bestLapTimes[MX_TRACKS[mxTrackIdx].name] || lapTime) * 100) / 100,
            newBest: isNewBest,
          });
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

  // ── Terrain following / airborne (unified ballistic model) ──
  // Grounded: hOff glues to the track and vy tracks the terrain's vertical
  // rate. The bike leaves the ground exactly when its ballistic path clears
  // the terrain next frame — crests launch naturally (bigger speed = bigger
  // air), ledges drop away, whoops skim at speed and ride at low speed.
  const uBike = mxBike.lat * 0.8;    // bike's cross-track position in mesh units
  const trackH = getTrackHeight(mxBike.t) + getBermRise(mxBike.t, uBike);
  mxGroundSlope = groundSlopeAt(mxBike.t);
  if (!mxBike.airborne) {
    const vyNow = (trackH - mxBike.hOff) / dt;
    mxBike.vy = vyNow;
    mxBike.hOff = trackH;
    const tNext = mxBike.t + (mxBike.speed * dt) / Math.max(mxSplineLen, 1);
    const terrainNext = getTrackHeight(tNext) + getBermRise(tNext, uBike);
    const ballisticNext = trackH + (mxBike.vy - GRAV * dt) * dt;
    if (ballisticNext > terrainNext + 0.015 && mxBike.speed > 4 && mxTimer.running) {
      mxBike.airborne = true;
      mxBike.jumpVel = Math.max(mxBike.vy, -2) * 1.05; // slight pop off the lip
      mxTimer.airTime = 0;
      if (mxBike.jumpVel > 1.8) sndJump();
    }
  } else {
    mxBike.jumpVel -= GRAV * dt;
    mxBike.hOff += mxBike.jumpVel * dt;
    mxTimer.airTime += dt;
    if (mxTimer.airTime > achState.mxMaxAir) achState.mxMaxAir = mxTimer.airTime;
    if (mxBike.hOff <= trackH) {
      mxBike.hOff = trackH; mxBike.airborne = false;
      // ── Landing quality ──
      // Impact = how hard we hit relative to the terrain falling away under
      // us (downslope landings are soft), pitch mismatch adds punishment.
      const terrainVy = mxGroundSlope * mxBike.speed;
      const relImpact = Math.max(0, terrainVy - mxBike.jumpVel);
      const slopePitch = -Math.atan(mxGroundSlope);
      const pitchMismatch = Math.abs(mxBike.pitch - slopePitch);
      const suspBonus = getSuspensionBonus();
      if (relImpact > 2.5) {
        // Hard hit — penalty scales with impact + bad body position
        const pen = Math.min(0.22, relImpact * 0.018 + pitchMismatch * 0.1) * (2 - suspBonus);
        mxBike.speed *= (1 - Math.max(0.02, pen));
      } else if (pitchMismatch < 0.3) {
        // Clean, slope-matched landing — carry momentum, small reward
        mxBike.speed = Math.min(mxBike.speed * (1.04 + (suspBonus - 1) * 0.06), mxBike.maxSpeed * 1.1);
      }
      mxBike.vy = terrainVy;
      const impactVel = relImpact;
      mxBike.jumpVel = 0;
      mxBike.pitchVel += impactVel * 0.5;   // nose dips into the compression
      if (impactVel > 1.2) sndLanding();
      mxTimer.airTime = 0;
      // Suspension slams + camera kick scale with real impact
      fVel += impactVel * 1.5; rVel += impactVel * 1.9;
      if (impactVel > 1.2) camShake = Math.min(0.05 + impactVel * 0.028, 0.32);
      if (mxBike.wheelie) { mxBike.wheelie = false; mxBike.wheelieBalance = 0; }
      if (impactVel > 1.5) {
        const landingParts = impactVel > 4 ? 14 : 8;
        for (let i = 0; i < landingParts && parts.length < MAXP; i++) {
          const a = Math.random() * Math.PI * 2;
          const sp = 0.2 + impactVel * 0.07;
          parts.push(new Pt(mxBike.pos.x, 0.1, mxBike.pos.z, Math.cos(a) * sp, Math.random() * 0.2 + impactVel * 0.04, Math.sin(a) * sp, T().primary, 1.2 + Math.random(), 0.1 + impactVel * 0.02));
        }
      }
    }
  }

  // Position bike
  curPt = mxSpline.getPointAt(mxBike.t);
  curTan = mxSpline.getTangentAt(mxBike.t).normalize();
  curNorm.set(-curTan.z, 0, curTan.x);

  const speedRatio = mxBike.speed / mxBike.maxSpeed;
  const suspFreq = 8 + mxBike.speed * 0.4;
  mxBike.suspBob = Math.sin(t * suspFreq) * 0.02 * speedRatio + Math.sin(t * suspFreq * 2.3) * 0.006;
  // Position bike — keep above track surface (0.35 base clearance prevents sinking on hills)
  const groundY = mxBike.airborne ? mxBike.hOff : Math.max(mxBike.hOff, trackH);
  mxBike.pos.set(
    curPt.x + curNorm.x * mxBike.lat * TRACK_W * 0.8,
    groundY + 0.35 + mxBike.suspBob,
    curPt.z + curNorm.z * mxBike.lat * TRACK_W * 0.8,
  );
  // Yaw follows the bike's actual velocity direction (spline tangent plus
  // the lateral drift component) through a shortest-arc smoother
  const latWorldVel = mxBike.latVel * TRACK_W * 0.8;
  const velX = curTan.x * mxBike.speed + curNorm.x * latWorldVel;
  const velZ = curTan.z * mxBike.speed + curNorm.z * latWorldVel;
  const yawTarget = mxBike.speed > 1.5
    ? Math.atan2(velX, velZ)
    : Math.atan2(curTan.x, curTan.z);
  let yawErr = yawTarget - mxBike.angle;
  while (yawErr > Math.PI) yawErr -= Math.PI * 2;
  while (yawErr < -Math.PI) yawErr += Math.PI * 2;
  mxBike.angle += yawErr * Math.min(1, dt * 10);
  bikeGroup.position.copy(mxBike.pos);
  bikeGroup.rotation.y = mxBike.angle;
  bikeGroup.rotation.z = mxBike.lean * 0.7 + mxBike.bank;

  // ── Chassis pitch: front/rear wheel terrain sampling + spring-damper ──
  // The chassis is a sprung mass between two wheels: whoops chatter it,
  // tabletop faces rotate it up the ramp, landings compress and rebound.
  let pitchTarget: number;
  let stiff: number, damp: number;
  if (mxBike.wheelie) {
    pitchTarget = -0.38 - Math.max(0, mxBike.wheelieBalance + 0.6) * 0.45;
    stiff = 60; damp = 10;
  } else if (mxBike.airborne) {
    // follow the flight arc; throttle lifts the nose, brake dips it
    pitchTarget = -Math.atan2(mxBike.jumpVel, Math.max(mxBike.speed, 4)) * 0.9;
    if (accelOn) pitchTarget -= 0.22;
    if (brakeOn) pitchTarget += 0.3;
    if (mob) pitchTarget -= TC.leanY * 0.42;   // pull back = nose up, push = nose down
    stiff = 16; damp = 6;
  } else {
    // grounded: chassis spans front/rear wheel contact heights
    const wbT = 0.6 / Math.max(mxSplineLen, 1);
    const hF = getTrackHeight(mxBike.t + wbT);
    const hR = getTrackHeight(mxBike.t - wbT);
    pitchTarget = -Math.atan2(hF - hR, 1.2)
      + (accelOn ? -0.05 : 0.015)
      + (braking ? 0.11 : 0)
      + (mob ? -TC.leanY * 0.12 : 0);   // body lean shifts the chassis
    stiff = 110; damp = 12;
  }
  mxBike.pitchVel += (pitchTarget - mxBike.pitch) * stiff * dt - mxBike.pitchVel * damp * dt;
  mxBike.pitch += mxBike.pitchVel * dt;
  bikeGroup.rotation.x = mxBike.pitch;

  // ── Suspension travel (spring-damper on both ends) ──
  const bump = Math.abs(Math.sin(t * suspFreq)) * 0.12 * speedRatio;
  const grounded = !mxBike.airborne;
  const fTarget = !grounded ? 0
    : mxBike.wheelie ? 0.05
    : Math.min(1, 0.22 + (mxAccel ? 0 : 0.18 * speedRatio) + bump + (brakeOn ? 0.42 : 0));
  const rTarget = !grounded ? 0
    : Math.min(1, 0.22 + (mxAccel ? 0.4 * speedRatio : 0) + (mxBike.wheelie ? 0.35 : 0) + bump);
  [fComp, fVel] = springStep(fComp, fVel, fTarget, dt);
  [rComp, rVel] = springStep(rComp, rVel, rTarget, dt);
  updateSuspension(fComp, rComp);
  // chassis settles into the stroke
  bikeGroup.position.y -= (fComp * 0.11 + rComp * 0.17) * 0.3;

  // Rider pose follows the riding state
  updateRiderPose({
    crouch: mxBike.airborne ? 1 : Math.min(0.85, (mxBike.speed / mxBike.maxSpeed) * 1.1),
    back: mxBike.wheelie ? 1 : (mob ? Math.max(0, TC.leanY) * 0.45 : 0),
    legOut: grounded && mxBike.speed > 4 && Math.abs(mxBike.lean) > 0.14 ? (mxBike.lean > 0 ? -1 : 1) : 0,
    tuck: mxBike.airborne ? 0.6 : 0,
    lean: mxBike.lean,
  }, dt);

  // Wheel spin
  spinWheels(mxBike.speed * dt * 4);

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

  // Skid sound + tire smoke — driven by real front-wash (slide) and hard drift
  if (!mxBike.airborne && (mxBike.slide > 0.25 || (mxBike.speed > 10 && Math.abs(mxBike.driftFactor) > 0.4)) && isSoundOn() && Math.random() < 0.05 + mxBike.slide * 0.2) {
    sndSkid();
  }
  if (!mxBike.airborne && (mxBike.slide > 0.2 || (mxBike.speed > 8 && Math.abs(mxBike.driftFactor) > 0.3)) && parts.length < MAXP) {
    if (Math.random() < 0.4 + mxBike.slide * 0.6) {
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
  updateTireTrail(mxBike.pos, curTan, mxBike.speed, mxBike.airborne,
    0.4 + mxBike.slide * 0.6 + (brakeOn ? 0.3 : 0) + Math.abs(mxBike.lean) * 0.2, dt);
  updateRoostParticles(dt, mxBike.speed, bikeGrounded, mxBike.pos, curTan, trackH);
  updateAmbientParticles(dt, t, mxBike.pos);

  if (isSoundOn()) updateEngine(0.15 + mxBike.rpm * 0.85, 1, accelOn);
}

// ── Initialize ──
let gameStarted = false;

function startGame(): void {
  if (gameStarted) return;   // watchdog and the normal path can race
  gameStarted = true;
  // Merge server-side progress now that auth is complete (checkSession ran in welcome screen)
  if (isLoggedIn()) {
    mergeServerAchievements(getServerAchievements());
    mergeServerUpgrades(getServerUpgrades());
  }

  // Periodic server sync + save on page close
  if (isLoggedIn()) {
    setInterval(() => {
      saveProgressToServer(getAchSaveData(), getUpgradeSaveData());
    }, 30000);

    const saveOnExit = () => {
      const data = JSON.stringify({
        achievements: getAchSaveData(),
        upgrades: getUpgradeSaveData(),
      });
      const token = getToken();
      if (token) {
        navigator.sendBeacon(gameUrl('api/user/save-progress-beacon'),
          new Blob([JSON.stringify({ token, ...JSON.parse(data) })], { type: 'application/json' }));
      }
    };
    window.addEventListener('beforeunload', saveOnExit);
    window.addEventListener('pagehide', saveOnExit);
  }

  postToHost({ type: 'started' });

  // Number plates, now that auth has resolved: the host profile's race number
  // is the source of truth for signed-in riders (it's their real TheMotoHub
  // identity). A garage override only applies to guests, or riders whose
  // profile carries no number — and if we have nothing at all, ask once.
  const profileNum = getUser()?.racerNumber || 0;
  const savedNum = storeGet('mx_rider_num');
  if (profileNum > 0) {
    setRiderNumber(profileNum);
    storeSet('mx_rider_num', String(profileNum));
  } else if (savedNum !== null) {
    setRiderNumber(parseInt(savedNum));
  } else {
    showNumberSetup((n) => {
      setRiderNumber(n);
      storeSet('mx_rider_num', String(n));
      goToMainMenu();
    });
  }

  // Build the first venue as a live backdrop for the menu orbit camera
  setTrackIdx(0);
  buildTrack();
  initHeroBike();
  resetMX();
  setVis();

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

    // ── Camera ──
    let cTargetX: number, cTargetY: number, cTargetZ: number;
    let cLookX: number, cLookY: number, cLookZ: number;
    let fovTarget = 62;
    if (mxGameActive && mxSpline) {
      // Chase cam — behind and above the bike, looking down the track
      const mxTan = mxSpline.getTangentAt(mxBike.t).normalize();
      const camBack = 4.9, camUp = 2.15;
      cTargetX = mxBike.pos.x - mxTan.x * camBack - mxBike.lean * mxTan.z * 0.9;
      cTargetY = mxBike.pos.y + camUp;
      cTargetZ = mxBike.pos.z - mxTan.z * camBack + mxBike.lean * mxTan.x * 0.9;
      cLookX = mxBike.pos.x + mxTan.x * 4.5;
      cLookY = mxBike.pos.y + 0.8;
      cLookZ = mxBike.pos.z + mxTan.z * 4.5;
      fovTarget = 62 + (mxBike.speed / mxBike.maxSpeed) * 13 + (mxBike.airborne ? 3 : 0);
    } else {
      // Menu — slow aerial orbit over the venue
      const oa = t * 0.05;
      cTargetX = Math.sin(oa) * 26; cTargetY = 11; cTargetZ = Math.cos(oa) * 26;
      cLookX = 0; cLookY = 0.5; cLookZ = 0;
    }
    cam.px = lerp(cam.px, cTargetX, 0.10);
    cam.py = lerp(cam.py, cTargetY, 0.10);
    cam.pz = lerp(cam.pz, cTargetZ, 0.10);
    cam.lx = lerp(cam.lx, cLookX, 0.14);
    cam.ly = lerp(cam.ly, cLookY, 0.14);
    cam.lz = lerp(cam.lz, cLookZ, 0.14);
    camShake = Math.max(0, camShake - camShake * 7 * 0.016);
    const shX = (Math.random() - 0.5) * camShake, shY = (Math.random() - 0.5) * camShake;
    camera.position.set(cam.px + shX, cam.py + shY, cam.pz + shX);
    camera.lookAt(cam.lx, cam.ly, cam.lz);
    if (Math.abs(camera.fov - fovTarget) > 0.05) {
      camera.fov = lerp(camera.fov, fovTarget, 0.07);
      camera.updateProjectionMatrix();
    }

    const __t1 = performance.now();
    updateMX(t);
    const __t2 = performance.now();
    updateHUD(mxBike, mxTimer, mxTrackIdx, mxAccel);
    const __t3 = performance.now();
    tickFPS(t);
    achState.elapsed = t;
    if (I.vel > achState.maxVel) achState.maxVel = I.vel;
    achState.totalDist += I.vel;
    checkAch();
    checkAchievementFunds();

    const __t4 = performance.now();
    R.render(scene, camera);
    const __t5 = performance.now();
    __profN++;
    __profMX += __t2 - __t1; __profHUD += __t3 - __t2; __profRender += __t5 - __t4; __profFrame += __t5 - __t1;
    if (PROF && __profN >= 5) {
      console.log(`[prof] avg over ${__profN}: frame ${(__profFrame/__profN).toFixed(1)}ms | updateMX ${(__profMX/__profN).toFixed(1)}ms | hud ${(__profHUD/__profN).toFixed(1)}ms | render ${(__profRender/__profN).toFixed(1)}ms | drawcalls ${R.info.render.calls} tris ${(R.info.render.triangles/1000).toFixed(0)}k`);
      __profN = 0; __profMX = 0; __profHUD = 0; __profRender = 0; __profFrame = 0;
    }
  }
  animate();
}

function init(): void {
  initContact();
  initSoundToggle();
  initStatsListeners(mxTimer);
  loadAchState();
  initShop();
  setRiderNumber(7);   // provisional; resolved against the profile once auth completes

  initLeaderboardUI();
  initProfileUI();
  reportVisit();
  fetchGlobalStats();
  setInterval(() => fetchGlobalStats(), 15000);

  window.addEventListener('beforeunload', () => pushSessionStats(mxTimer));
  window.addEventListener('pagehide', () => pushSessionStats(mxTimer));

  setupInputListeners(applyTheme, () => {}, sectionClick, sectionRelease);
  applyTheme(0);
  postToHost({ type: 'ready' });

  // Loading screen → welcome screen → game start
  startLoading(startGame);

  // Embedded diagnostics: if the frame looks blank, report what the page
  // actually believes about itself (canvas size, GL, visibility, phase).
  setTimeout(() => {
    const c = document.getElementById('c3d') as HTMLCanvasElement | null;
    const hero = document.getElementById('hero');
    let gl = 'none';
    try { gl = R.getContext() ? 'ok' : 'null'; } catch (e) { gl = 'throw:' + (e as Error).message; }
    postToHost({
      type: 'diag',
      detail: {
        started: gameStarted,
        canvas: c ? `${c.width}x${c.height}` : 'missing',
        client: c ? `${c.clientWidth}x${c.clientHeight}` : 'n/a',
        win: `${innerWidth}x${innerHeight}`,
        heroOpacity: hero ? getComputedStyle(hero).opacity : 'n/a',
        loading: !!document.getElementById('loadingScreen'),
        welcome: document.getElementById('welcomeScreen')?.className || 'n/a',
        gl,
        frames: __profN,
      },
    });
  }, 7000);

  // Last-resort watchdog: whatever goes wrong upstream (stalled auth, a
  // throw in the boot chain, blocked storage in a WebView), the rider ends
  // up in the game rather than staring at a black screen. startGame() is
  // idempotent, so this is a no-op on a healthy boot.
  setTimeout(() => {
    if (!gameStarted) {
      console.warn('[boot] watchdog fired — forcing game start');
      document.getElementById('loadingScreen')?.classList.remove('visible');
      document.getElementById('welcomeScreen')?.classList.remove('visible');
      startGame();
    }
  }, 12000);
}

init();
