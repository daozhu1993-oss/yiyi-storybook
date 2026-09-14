import {isFreeBook} from './book-access.js';

export const readingSession = {user:null, membership:null, ready:false, progress:{}, loading:Promise.resolve()};
let resolveReady;
export const accountReady = new Promise(resolve => {resolveReady=resolve;});
// the shelf must never wait forever for the account script (a blocked script, an offline CDN):
// after a few seconds the reader continues as a guest, and a later sign-in still updates the state
setTimeout(() => {if (!readingSession.ready) {readingSession.ready = true; resolveReady();}}, 4000);
const finishedReminders = new Set();
export const readingEvents = new EventTarget();
const emit = (name, detail) => readingEvents.dispatchEvent(new CustomEvent(name,{detail}));
export function setReadingUser(user) {
  if (readingSession.user?.id !== user?.id) {setSavedProgress({});setReadingMembership(null);emit('reading-account-changed');}
  readingSession.user = user ? {id:user.id} : null;
  readingSession.ready = true;
  resolveReady();
}
export function setReadingMembership(value) {
  readingSession.membership=value;
  emit('membership-changed',value);
}
export function canReadBook(id) {
  const member=readingSession.membership;
  return isFreeBook(id) || !!(readingSession.user && member?.active && (member.plan==='lifetime' || Date.parse(member.expiresAt)>Date.now()));
}
export function setSavedProgress(progress) {
  readingSession.progress = progress;
  emit('saved-progress',progress);
}
export async function waitForReadingProgress() {
  await accountReady;
  await readingSession.loading;
}
export function reportReadingProgress(detail) {
  if (!canReadBook(detail.bookId) || !Number.isInteger(detail.page) || detail.page<0 || detail.page>10) return;
  emit('reading-progress',detail);
}
export function showSignInReminder(reason='progress') {
  // the sign-in dialog carries the benefits itself; only its opening line follows the moment
  const dialog = document.getElementById('account-dialog');
  if (!dialog || readingSession.user || dialog.open) return;
  const intro = document.getElementById('account-intro');
  if (intro) intro.textContent = reason==='finished'
    ? 'What a lovely finish! Sign in to save this story to your reading journey. The first three books are free.'
    : 'For parents and grown-ups. The first three books are free. Sign in to save progress, add readers, collect pins, and enjoy quizzes.';
  emit('pause-reading');
  dialog.showModal();
}
export async function requestReadingFeature(feature) {
  await accountReady;
  if (!readingSession.user) {showSignInReminder(feature);return false;}
  await readingSession.loading;
  if(readingSession.syncReady===false){emit('retry-sync');emit('sync-error');return false;}
  if(!['page-navigation','game-action','pin-action'].includes(feature))emit('feature',feature);
  return true;
}
export async function remindAfterFinish(bookId) {
  await accountReady;
  if (readingSession.user || finishedReminders.has(bookId)) return;
  finishedReminders.add(bookId);
  showSignInReminder('finished');
}

export function safeReadingReturn(value) {
  if (value === '/' || /^\/stories\/(otto-shy-moon|nia-runaway-kite|fin-glowing-sea)\/$/.test(value)) return value;
  return '/';
}
