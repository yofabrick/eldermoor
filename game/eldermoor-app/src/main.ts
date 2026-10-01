import './style.css';
import { Game } from './game/Game';
import { hasSave } from './core/Save';

const appEl = document.querySelector('#app');
if (!(appEl instanceof HTMLDivElement)) {
  throw new Error('Missing #app');
}
const app = appEl;
// Hide vite default if any
const cont = document.getElementById('btn-continue') as HTMLButtonElement | null;
if (cont) cont.style.opacity = hasSave() ? '1' : '0.45';

const game = new Game(app);

declare global {
  interface Window {
    __eldermoor?: { probe: () => ReturnType<Game['probe']> };
  }
}

// Observation hook for the browser end-to-end run only. Gameplay input stays the real keys.
if (new URLSearchParams(location.search).has('e2e')) {
  window.__eldermoor = { probe: () => game.probe() };
}
