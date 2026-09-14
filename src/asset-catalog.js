// Cache only scopes requested by this reader. The master inventory stays on the server.
export function createAssetCatalog({endpoint,revision,fetcher=globalThis.fetch,baseUrl='http://localhost/',onLoad=()=>{}}={}) {
  const urls=new Map(),sizes=new Map(),paths=new Map(),requests=new Map();
  const absolute=url=>new URL(url,baseUrl).href;
  function load({scope,book,language='en'}) {
    if(!endpoint)return Promise.resolve(); // Source development serves original local files.
    const key=`${scope}:${book||''}:${language}`;
    if(requests.has(key))return requests.get(key);
    const request=(async()=>{
      const url=new URL(endpoint,baseUrl);
      url.search=new URLSearchParams({scope,lang:language,v:revision,...(book?{book}:{})}).toString();
      const response=await fetcher(url.href,{signal:AbortSignal.timeout(15000),credentials:'omit'});
      if(!response.ok)throw Error(response.status===409?'The app has been updated. Please reload.':'Could not load the book files. Please try again.');
      const data=await response.json();
      if(data?.revision!==revision||!data.assets||typeof data.assets!=='object'||Array.isArray(data.assets)||!data.bytes)
        throw Error('Invalid asset response. Please reload.');
      const entries=Object.entries(data.assets);
      // Validate the complete response before installing any of it.
      for(const [file,value] of entries) {
        if(typeof value!=='string'||(!value.startsWith('https://')&&!value.startsWith('/media/'))||
          !Number.isFinite(data.bytes[file])||data.bytes[file]<0)throw Error('Invalid asset response. Please reload.');
        absolute(value);
      }
      for(const [file,value] of entries){urls.set(file,value);sizes.set(file,data.bytes[file]);paths.set(absolute(value),file);}
      onLoad();
    })();
    requests.set(key,request);
    request.catch(()=>{if(requests.get(key)===request)requests.delete(key);});
    return request;
  }
  return {load,url:file=>urls.get(file),size:file=>sizes.get(file)||0,pathFor:url=>paths.get(url)};
}
