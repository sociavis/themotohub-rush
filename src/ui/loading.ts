import { showWelcomeScreen } from './welcome';

const loadBar = document.getElementById('loadBarFill') as HTMLElement;
const loadText = document.getElementById('loadText');
let loadProgress = 0;
let gameStarter: (() => void) | null = null;

// Moto-flavoured stages so the wait reads as pre-race ritual
const STAGES: [number, string][] = [
  [0, 'Dropping the gate'],
  [30, 'Warming the engine'],
  [55, 'Prepping the track'],
  [80, 'Lining up'],
  [97, 'Riders ready'],
];

function updateLoadBar(): void {
  loadProgress = Math.min(loadProgress + 15 + Math.random() * 25, 100);
  if (loadBar) loadBar.style.width = loadProgress + '%';
  if (loadText) {
    for (let i = STAGES.length - 1; i >= 0; i--) {
      if (loadProgress >= STAGES[i][0]) {
        if (loadText.textContent !== STAGES[i][1]) loadText.textContent = STAGES[i][1];
        break;
      }
    }
  }
  if (loadProgress < 100) {
    setTimeout(updateLoadBar, 120 + Math.random() * 200);
  } else {
    finishLoading();
  }
}

function finishLoading(): void {
  setTimeout(() => {
    const ls = document.getElementById('loadingScreen');
    if (ls) ls.classList.add('hidden');
    // Show welcome screen instead of hero directly
    showWelcomeScreen(() => {
      const hero = document.getElementById('hero');
      if (hero) hero.style.opacity = '1';
      if (gameStarter) gameStarter();
    });
    setTimeout(() => { if (ls) ls.remove(); }, 800);
  }, 400);
}

export function startLoading(onGameStart: () => void): void {
  gameStarter = onGameStart;
  updateLoadBar();
}
