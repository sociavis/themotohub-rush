import { T, rgba } from '../game/themes';

// First-run rider setup: pick the number that goes on the plates. Only shown
// when we have nothing to go on — a signed-in TheMotoHub rider with a race
// number on their profile never sees this, their real number is used.

export function showNumberSetup(onDone: (num: number) => void): void {
  const t = T();
  const wrap = document.createElement('div');
  wrap.className = 'number-setup';
  wrap.innerHTML = `
    <div class="ns-card" style="border-color:${rgba(t.primary, 0.35)}">
      <div class="ns-title" style="color:${rgba(t.primary, 1)}">Pick your number</div>
      <div class="ns-sub">Goes on your plates — 0 to 999</div>
      <input class="ns-input" id="nsInput" type="number" min="0" max="999" value="7"
        style="border-color:${rgba(t.primary, 0.35)};color:${rgba(t.primary, 1)}">
      <button class="ns-go" id="nsGo" style="border-color:${rgba(t.primary, 0.6)};color:${rgba(t.primary, 1)}">Let's ride</button>
    </div>`;
  document.body.appendChild(wrap);
  requestAnimationFrame(() => wrap.classList.add('visible'));

  const input = wrap.querySelector('#nsInput') as HTMLInputElement;
  const finish = (): void => {
    const n = Math.max(0, Math.min(999, parseInt(input.value) || 0));
    wrap.classList.remove('visible');
    setTimeout(() => wrap.remove(), 300);
    onDone(n);
  };
  wrap.querySelector('#nsGo')!.addEventListener('click', finish);
  input.addEventListener('keydown', (e) => { if ((e as KeyboardEvent).key === 'Enter') finish(); });
  setTimeout(() => input.focus(), 250);
}
