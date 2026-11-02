// Isolated-world, read-only invalidation witness. Page DOM never grants work.
export function observeRefreshActivity(){
 const key=Symbol.for('pcms.refresher.activity.1');
 if(!globalThis[key]){let count=0;const id=crypto.randomUUID();for(const type of ['beforeinput','keydown','paste','drop','pointerdown'])document.addEventListener(type,event=>{if(event.isTrusted)count++;},true);Object.defineProperty(globalThis,key,{value:()=>({id,count}),configurable:false,writable:false});}
 return globalThis[key]();
}
