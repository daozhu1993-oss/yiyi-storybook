// Account-scoped backing for the latest game's existing Profiles and Souvenirs.
// Legacy device keys are deliberately left untouched; guests use memory only.
export const readingStoreEvents = new EventTarget();
let values={},account=null;
export const isReadingKey=key=>/^storylight-(?:profiles|(?:progress|souvenirs):[a-zA-Z0-9-]{1,64})$/.test(key);
export function replaceReadingStore(userId,data={}) {
  account=userId || null;
  values=Object.fromEntries(Object.entries(data).filter(([key,value])=>isReadingKey(key)&&typeof value==='string'));
}
export function readingSnapshot(){return {...values};}
export const readingStore={
  getItem(key){return values[key] ?? null;},
  setItem(key,value){
    if(!isReadingKey(key))return;
    values[key]=String(value);
    if(account)readingStoreEvents.dispatchEvent(new CustomEvent('change',{detail:{account,patch:{[key]:String(value)},removed:[]}}));
  },
  removeItem(key){
    delete values[key];
    if(account && isReadingKey(key))readingStoreEvents.dispatchEvent(new CustomEvent('change',{detail:{account,patch:{},removed:[key]}}));
  },
};
