const pickSound = typeof Audio !== "undefined" ? new Audio("/sounds/cardpicksound.mp3") : null;
const dropSound = typeof Audio !== "undefined" ? new Audio("/sounds/carddropsound.mp3") : null;

if (pickSound) {
  pickSound.volume = 0.5;
  pickSound.preload = "auto";
  pickSound.load();
}

if (dropSound) {
  dropSound.volume = 0.5;
  dropSound.preload = "auto";
  dropSound.load();
}

export function playPickSound() {
  if (!pickSound) return;
  pickSound.currentTime = 0;
  pickSound.play().catch(() => {});
}

export function playDropSound() {
  if (!dropSound) return;
  dropSound.currentTime = 0;
  dropSound.play().catch(() => {});
}
