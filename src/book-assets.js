// Shared by the game and account bundle; pricing does not download the asset catalog.
const protectedAssets=new Map();
export function setBookAssets(assets,expiresAt) {
  for(const [key,url] of Object.entries(assets))protectedAssets.set(key,{url,expiresAt});
}
export function clearBookAssets(){protectedAssets.clear();}
export function protectedAssetUrl(key) {
  const asset=protectedAssets.get(key);
  return asset && asset.expiresAt>Date.now() ? asset.url : null;
}
