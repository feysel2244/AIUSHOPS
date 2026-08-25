let audioContext: AudioContext | null = null;
let audioUnlocked = false;
let audioElement: HTMLAudioElement | null = null;

function getAudioContext() {
  if (typeof window === "undefined") return null;
  if (!audioContext) {
    const Ctx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    audioContext = new Ctx();
  }
  return audioContext;
}

function getAudioElement() {
  if (typeof window === "undefined") return null;
  if (!audioElement) {
    audioElement = new Audio(`${import.meta.env.BASE_URL}notification.wav`);
    audioElement.preload = "auto";
  }
  return audioElement;
}

/** Unlock audio after a real user gesture. Browsers require this before background notification sounds can play. */
export async function unlockNotificationSound() {
  const ctx = getAudioContext();
  const audio = getAudioElement();
  try {
    if (ctx?.state === "suspended") await ctx.resume();
    if (audio) {
      audio.muted = true;
      await audio.play();
      audio.pause();
      audio.currentTime = 0;
      audio.muted = false;
    }
    audioUnlocked = !ctx || ctx.state === "running";
  } catch {
    audioUnlocked = !!ctx && ctx.state === "running";
  }
  return audioUnlocked;
}

/** Play the bundled sound, with a Web Audio fallback so deployment path/audio-file issues cannot silence notifications. */
export function playNotificationSound() {
  if (typeof window === "undefined") return;
  if (localStorage.getItem("aiu_notification_sound") === "off") return;
  const ctx = getAudioContext();
  if (!audioUnlocked && ctx?.state !== "running") return;

  const audio = getAudioElement();
  if (audio && audioUnlocked) {
    try {
      audio.currentTime = 0;
      audio.volume = 0.65;
      void audio.play().catch(() => playFallbackChime(ctx));
      return;
    } catch {
      // fall through to Web Audio
    }
  }
  playFallbackChime(ctx);
}

function playFallbackChime(ctx: AudioContext | null) {
  if (!ctx || ctx.state !== "running") return;
  try {
    const now = ctx.currentTime;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.18, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.setValueAtTime(1175, now + 0.10);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.24);
  } catch {
    // Never let notification audio break the app.
  }
}

export function isNotificationSoundEnabled() {
  return localStorage.getItem("aiu_notification_sound") !== "off";
}

export function setNotificationSoundEnabled(enabled: boolean) {
  localStorage.setItem("aiu_notification_sound", enabled ? "on" : "off");
}

export function showBrowserNotification(title: string, body: string, linkTo: string | undefined) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  try {
    new Notification(title, { body, icon: `${import.meta.env.BASE_URL}favicon.svg` });
  } catch {
    // Optional enhancement.
  }
}
