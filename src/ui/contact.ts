import { T, rgba } from '../game/themes';

let _lastBtnTap = 0;
function btnGuard(): boolean { const now = Date.now(); if (now - _lastBtnTap < 350) return false; _lastBtnTap = now; return true; }

const contactBtn = document.getElementById('contactBtn')!;
const contactOverlay = document.getElementById('contactOverlay')!;
const contactClose = document.getElementById('contactClose')!;
const contactForm = document.getElementById('contactForm') as HTMLFormElement;
const svcList = document.getElementById('svcList')!;
const svcInput = document.getElementById('svcInput') as HTMLInputElement;
const selectedSvcs = new Set<string>();
let formOpenTime = 0;

function openContact(): void {
  const t = T();
  contactOverlay.classList.add('open');
  const m = document.getElementById('contactModal')!;
  m.style.borderColor = rgba(t.primary, 0.3);
  m.style.color = rgba(t.primary, 0.8);
  m.style.background = rgba(t.bg, 0.95);
  m.querySelectorAll('input,textarea').forEach(e => {
    (e as HTMLElement).style.color = rgba(t.secondary, 1);
    (e as HTMLElement).style.borderColor = rgba(t.primary, 0.15);
  });
  (m.querySelector('.cm-submit') as HTMLElement).style.borderColor = rgba(t.primary, 0.4);
  (m.querySelector('.cm-submit') as HTMLElement).style.color = rgba(t.primary, 1);
  svcList.querySelectorAll('.cm-svc').forEach(s => {
    (s as HTMLElement).style.borderColor = rgba(t.primary, 0.15);
    (s as HTMLElement).style.color = rgba(t.primary, 0.7);
  });
  formOpenTime = Date.now();
}

function closeContact(): void {
  contactOverlay.classList.remove('open');
}

export function initContact(): void {
  contactBtn.addEventListener('click', (e) => { e.stopPropagation(); if (btnGuard()) openContact(); });
  contactBtn.addEventListener('touchstart', (e) => { e.stopPropagation(); if (btnGuard()) openContact(); }, { passive: true });
  contactClose.addEventListener('click', (e) => { e.stopPropagation(); closeContact(); });
  contactOverlay.addEventListener('click', (e) => { if (e.target === contactOverlay) closeContact(); });

  svcList.querySelectorAll('.cm-svc').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const svc = (el as HTMLElement).dataset.svc!;
      if (selectedSvcs.has(svc)) {
        selectedSvcs.delete(svc);
        el.classList.remove('selected');
        el.querySelector('.svc-check')!.textContent = '○';
      } else {
        selectedSvcs.add(svc);
        el.classList.add('selected');
        el.querySelector('.svc-check')!.textContent = '●';
      }
      const t = T();
      (el as HTMLElement).style.borderColor = el.classList.contains('selected') ? rgba(t.primary, 0.4) : rgba(t.primary, 0.15);
      svcInput.value = [...selectedSvcs].join(', ');
    });
  });

  contactForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (Date.now() - formOpenTime < 2000) {
      document.getElementById('cmStatus')!.textContent = '[ Verification failed ]';
      return;
    }
    document.getElementById('cmStatus')!.textContent = '[ Transmitting... ]';
    fetch('https://formsubmit.co/ajax/scott@sociavisual.com', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(Object.fromEntries(new FormData(contactForm))),
    }).then(r => {
      if (r.ok) {
        document.getElementById('cmStatus')!.textContent = '[ Transmitted successfully ]';
        contactForm.reset();
        selectedSvcs.clear();
        svcList.querySelectorAll('.cm-svc').forEach(s => {
          s.classList.remove('selected');
          s.querySelector('.svc-check')!.textContent = '○';
        });
        svcInput.value = '';
        setTimeout(closeContact, 2000);
      } else {
        document.getElementById('cmStatus')!.textContent = '[ Transmission failed — try again ]';
      }
    }).catch(() => {
      document.getElementById('cmStatus')!.textContent = '[ Network error — try again ]';
    });
  });
}
