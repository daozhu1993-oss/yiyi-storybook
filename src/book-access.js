export const FREE_BOOK_IDS=Object.freeze(['otto-shy-moon','nia-runaway-kite','fin-glowing-sea']);
export const isFreeBook = id => FREE_BOOK_IDS.includes(id) || (typeof id === 'string' && (id.startsWith('yiyi-') || id.startsWith('yaya-')));
export function isPublicAsset(file) {
  if(file.startsWith('public/'))return true;
  const match=/^books\/([^/]+)\/(.+)$/.exec(file);
  if(!match)return false;
  if(isFreeBook(match[1]))return true;
  // The full shelf remains visible; paid stories, narration and scene art stay out
  // of the public deployment until protected membership delivery is activated.
  return /^(?:art\/(?:cover|logo)(?:-shelf|-strip)?(?:\.[a-z]{2})?\.(?:jpg|png|webp)|art\/[^/]+-reference\.jpg|pins\/[^/]+\.(?:png|webp))$/.test(match[2]);
}
export function assertPublicLibrary(books) {
  for(const id of FREE_BOOK_IDS)if(!books.some(book=>book.id===id))throw new Error(`Free book missing: ${id}`);
  if(new Set(books.map(b=>b.id)).size!==books.length)throw new Error('Duplicate book slug');
}
