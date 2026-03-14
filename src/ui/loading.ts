const loadBar = document.getElementById('loadBarFill') as HTMLElement;
let loadProgress = 0;

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
    const hero = document.getElementById('hero');
    if (hero) hero.style.opacity = '1';
    setTimeout(() => { if (ls) ls.remove(); }, 800);
  }, 400);
}

export function startLoading(): void {
  updateLoadBar();
}
