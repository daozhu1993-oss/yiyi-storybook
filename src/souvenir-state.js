// Parent-owned synchronized JSON is still untrusted at the rendering boundary.
const record = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const safeKey = key => /^[a-zA-Z0-9_-]{1,100}$/.test(key) && !['__proto__','constructor','prototype'].includes(key);
const count = (value, max = 1000) => Number.isSafeInteger(value) && value >= 0 ? Math.min(value, max) : 0;
const entries = value => Object.entries(record(value)).filter(([key]) => safeKey(key)).slice(0, 1000);
const stringList = value => Array.isArray(value) ? [...new Set(value.filter(item => typeof item === 'string' && item.length <= 256))].slice(0, 1000) : [];

export function normalizeSouvenirs(value) {
  const source = record(value);
  return {
    points: count(source.points, 1000000000),
    pins: Object.fromEntries(entries(source.pins).map(([key, list]) => [key, stringList(list)])),
    heard: Object.fromEntries(entries(source.heard).map(([key, list]) => [key, stringList(list)])),
    stars: Object.fromEntries(entries(source.stars).map(([key, list]) => [key,
      Array.isArray(list) ? [...new Set(list.filter(page => Number.isInteger(page) && page >= 0 && page < 1000))] : []])),
    quiz: Object.fromEntries(entries(source.quiz).map(([key, quiz]) => {
      const q = record(quiz), total = count(q.total);
      return [key, {best: Math.min(count(q.best), total), total}];
    })),
    finished: Object.fromEntries(entries(source.finished).filter(([, done]) => done === true)),
    badges: Object.fromEntries(entries(source.badges).filter(([, at]) => Number.isSafeInteger(at) && at > 0)),
  };
}
