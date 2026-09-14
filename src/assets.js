import config from './runtime-config.js';
import {protectedAssetUrl} from './book-assets.js';
import {createAssetCatalog} from './asset-catalog.js';

/* Every requested asset is registered with its size from the loaded scope. A
   PerformanceObserver marks each one done as its download finishes. Anything fetched
   without assetUrl (scripts, styles, the CDN, fonts) is counted by its own size when it lands.
   The loading screen shows the two sums. */
const registry = new Map();      // absolute url -> { file, bytes }
const done = new Map();          // absolute url -> bytes counted
let extra = 0, extraFiles = 0;   // unregistered resources, by their own size
const absolute = (url) => { try { return new URL(url, typeof location !== 'undefined' ? location.href : 'http://localhost/').href; } catch (error) { return url; } };
const catalog=createAssetCatalog({endpoint:config.assetEndpoint,revision:config.assetRevision,
  baseUrl:typeof location!=='undefined'?location.href:'http://localhost/',
  onLoad:()=>{for(const rec of registry.values())if(!rec.bytes)rec.bytes=catalog.size(rec.file);},
});
const sizeOf=file=>catalog.size(file);
export const loadPublicAssets=options=>catalog.load(options);
if (typeof PerformanceObserver !== 'undefined') {
  const seen = new Set();
  const take = (e) => {
    if (seen.has(e.name)) return;
    seen.add(e.name);
    let rec = registry.get(e.name);
    const own = e.encodedBodySize || e.transferSize || 0;
    if (!rec) { const file = catalog.pathFor(e.name); if (file) { rec = { file, bytes: sizeOf(file) }; registry.set(e.name, rec); } }
    if (rec) done.set(e.name, rec.bytes || own); else { extra += own; extraFiles++; }
  };
  try { new PerformanceObserver((list) => list.getEntries().forEach(take)).observe({ type: 'resource', buffered: true }); } catch (error) { /* no observer: the counter stays at what it knows */ }
}
export function assetUrl(input) {
  if (!input || /^(data:|blob:|https?:)/.test(input)) return input;
  const file = input.replace(/^\.?\//, '');
  const url = protectedAssetUrl(file) || catalog.url(file) || input;
  const key = absolute(url);
  if (!registry.has(key)) registry.set(key, { file, bytes: sizeOf(file) });
  return url;
}
/** Bytes asked for so far and bytes that have arrived, for the loading screen. */
export function downloadProgress() {
  let expected = extra, loaded = extra, files = extraFiles, arrived = extraFiles;
  for (const [url, rec] of registry) {
    const bytes = rec.bytes || done.get(url) || 0;
    expected += bytes; files++;
    if (done.has(url)) { loaded += done.get(url) || bytes; arrived++; }
  }
  return { loaded, expected, files, arrived };
}
