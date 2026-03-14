import { showWelcomeScreen } from './welcome';

const loadBar = document.getElementById('loadBarFill') as HTMLElement;
let loadProgress = 0;
let gameStarter: (() => void) | null = null;

function updateLoadBar(): void {
  loadProgress = Math.min(loadProgress + 15 + Math.random() * 25, 100);
  if (loadBar) loadBar.style.width = loadProgress + '%';
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
