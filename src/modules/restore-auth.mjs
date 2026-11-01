// Fixed packaged perchance-auth-1 bootstrap. Serialized into its private
// USER_SCRIPT world by the trusted host, never supplied by archive code.
export function restoreAuthBootstrap(request){
 const result=(ok,code=null,extra={})=>({ok,code,operationId:request?.operationId,nonce:request?.nonce,authHash:request?.authHash,...extra});
 if(window.top!==window||location.origin!=='https://perchance.org'||location.href!==request?.url)return result(false,'RESTORE_BOOTSTRAP_CONTEXT');
 const a=request.auth,plain=v=>v&&typeof v==='object'&&!Array.isArray(v),own=(v,k)=>Object.prototype.hasOwnProperty.call(v,k);
 if(!plain(a)||a.adapter!=='perchance-auth-1'||a.schema!==1||a.origin!==location.origin||typeof a.userPresent!=='boolean'||typeof a.guardPresent!=='boolean'||(a.guardPresent?typeof a.sessionTokenLastChangeTime!=='string':a.sessionTokenLastChangeTime!==null))return result(false,'RESTORE_AUTH_SCHEMA');
 if(a.userPresent?(!plain(a.user)||Object.keys(a.user).some(k=>!['loggedIn','email','sessionToken'].includes(k))||typeof a.user.loggedIn!=='boolean'||['email','sessionToken'].some(k=>own(a.user,k)&&typeof a.user[k]!=='string')||a.user.loggedIn&&(!a.guardPresent||!a.user.email||!a.user.sessionToken)):a.user!==null)return result(false,'RESTORE_AUTH_SCHEMA');
 const marker='pcms.restore.auth.'+request.nonce;
 try{
  const raw=localStorage.getItem(marker);
  if(raw!==null){const prior=JSON.parse(raw);if(prior.operationId!==request.operationId||prior.nonce!==request.nonce||prior.authHash!==request.authHash)return result(false,'RESTORE_BOOTSTRAP_CONFLICT');globalThis.__PCMS_RESTORE_AUTH_1=prior;return result(true,null,{already:true,appliedAt:prior.appliedAt});}
  const stored=localStorage.getItem('app-storage'),base=stored===null?{}:JSON.parse(stored);
  if(!plain(base)||own(base,'user')&&(!plain(base.user)||base.user.loggedIn===true))return result(false,'RESTORE_AUTH_CONFLICT');
  // Merge only fixed auth slots into this destination's fresh/default store.
  // Opaque AI/workspace fields never come from the archive.
  if(a.userPresent)base.user=JSON.parse(JSON.stringify(a.user));else delete base.user;
  localStorage.setItem('app-storage',JSON.stringify(base));
  if(a.guardPresent)localStorage.setItem('sessionTokenLastChangeTime',a.sessionTokenLastChangeTime);else localStorage.removeItem('sessionTokenLastChangeTime');
  const receipt={operationId:request.operationId,nonce:request.nonce,authHash:request.authHash,appliedAt:Date.now()};
  localStorage.setItem(marker,JSON.stringify(receipt));globalThis.__PCMS_RESTORE_AUTH_1=receipt;
  // The URL contains only a one-use random operation token, never a secret.
  // Remove it before ordinary site scripts initialize.
  history.replaceState(history.state,'','/');
  return result(true,null,{appliedAt:receipt.appliedAt});
 }catch{return result(false,'RESTORE_AUTH_STORAGE_UNAVAILABLE');}
}
