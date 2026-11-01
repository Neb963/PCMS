// Controlled native editor contract. Served by B and executed by T. Not packaged.
window.__editorReady=true;window.userOwnsThisGenerator=true;window.__saveInFlight=false;
window.editorCollabInitialSyncIsPending=false;window.__collabRoomFailed=false;window.collabEditKeyIsIncorrect=false;
window.generatorLastSaveTime=INITIAL_VERSION.time;window.generatorSaveCount=INITIAL_VERSION.saveCount;window.generatorSaveCountKnown=true;
window.nativeControl={};window.nativeHistory=[];window.nativeAttempts=0;
window.menuBar={saveState:'saved',setSaveState(value){this.saveState=value;}};
window.saveCheckpointManager={current:()=>({time:generatorLastSaveTime,saveCount:generatorSaveCount,saveCountKnown:true}),isDivergenceBlocked:()=>window.nativeControl.divergence===true};
window.aiAgentWorkspaceSnapshot=async()=>nativeControl.workspace??null;
function nativeDoc(text){return {text,clean:true,history:[],getValue(){return this.text},isClean(){return this.clean},iterLinkedDocs(fn){for(const d of this.linked??[])fn(d)},lastLine(){return this.text.split('\n').length-1},getLine(line){return this.text.split('\n')[line]},replaceRange(value,from,to,origin){this.history.push(this.text);this.text=value;this.clean=false;nativeHistory.push({kind:'replace',origin});}};}
function nativeEditor(text){const doc=nativeDoc(text);let readOnly=false;return {getDoc:()=>doc,getValue:()=>doc.text,isClean:()=>doc.clean,markClean(){doc.clean=true;},setOption(name,value){if(name!=='readOnly')throw Error('OPTION');readOnly=value;},getOption:()=>readOnly};}
window.app={data:{generator:INITIAL_GENERATOR},store:{data:{user:JSON.parse(localStorage.getItem('app-storage')).user}}};
window.modelTextEditor=nativeEditor(app.data.generator.modelText);window.outputTemplateEditor=nativeEditor(app.data.generator.outputTemplate);
const nativeBytes={};for(const [path,data]of Object.entries(INITIAL_FILES))nativeBytes[path]=Uint8Array.from(atob(data),c=>c.charCodeAt(0));
const working=JSON.parse(JSON.stringify(app.data.generator.srcManifest));let srcDirty=false;
window.srcState={_internals:{working,validatePath:path=>path.length>500||path.split('/').some(p=>!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(p))?'unsupported native path':null},
 list:()=>Object.keys(working),readFile:async path=>nativeBytes[path],isDirty:async()=>srcDirty,hasPending:()=>!!nativeControl.pending,conflictPaths:()=>nativeControl.conflicts??[],ready:async()=>{},
 writeFile:async(path,bytes)=>{const err=srcState._internals.validatePath(path);if(err)throw Error(err);nativeBytes[path]=new Uint8Array(bytes);working[path]={pending:true,size:bytes.length};srcDirty=true;nativeHistory.push({kind:'write',path});},
 deleteFile:async path=>{delete working[path];delete nativeBytes[path];srcDirty=true;nativeHistory.push({kind:'delete',path});},
 prepareForSave:async()=>{if(nativeControl.uploadFail)throw Error('fixture upload failure');for(const [path,e]of Object.entries(working))if(e.pending){const b=nativeBytes[path];let raw='';for(const n of b)raw+=String.fromCharCode(n);const response=await fetch('/fixture/upload',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path,base64:btoa(raw)})});const uploaded=await response.json();e.key=uploaded.key;e.size=b.length;delete e.pending;}return Object.fromEntries(Object.entries(working).map(([path,e])=>[path,{key:e.key,size:e.size}]));},
 afterSaveSuccess:async manifest=>{srcDirty=false;app.data.generator.srcManifest=manifest;}};
app.saveGenerator=async()=>{
 nativeAttempts++;if(__saveInFlight)return false;__saveInFlight=true;
 try{
  if(nativeControl.beforeSubmit)await nativeControl.beforeSubmit();
  if(menuBar.saveState!=='unsaved')return false;
  const srcManifest=await srcState.prepareForSave(),body={email:app.store.data.user.email,sessionToken:app.store.data.user.sessionToken,generator:{...app.data.generator,modelText:modelTextEditor.getValue(),outputTemplate:outputTemplateEditor.getValue()},srcManifest,lastKnownSaveTime:generatorLastSaveTime,lastKnownSaveCount:generatorSaveCount};delete body.generator.srcManifest;
  if(nativeControl.force)body.forceSaveDespiteStaleness=true;
  if(nativeControl.nested){body.generator.srcManifest=body.srcManifest;delete body.srcManifest;}
  let result=await fetch('/api/save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}).then(r=>r.json());
  if(result.status==='stale'&&confirm('A newer save exists. Force overwrite?')){body.forceSaveDespiteStaleness=true;result=await fetch('/api/save',{method:'POST',body:JSON.stringify(body)}).then(r=>r.json());}
  if(nativeControl.retry)await fetch('/api/save',{method:'POST',body:JSON.stringify(body)});
  if(result.status==='saved'){generatorLastSaveTime=result.time;generatorSaveCount=result.saveCount;lastSavedGeneratorSourceRevision=result.sourceRevision;await srcState.afterSaveSuccess(srcManifest,result.time,result.saveCount);modelTextEditor.markClean();outputTemplateEditor.markClean();menuBar.setSaveState('saved');}else menuBar.setSaveState('unsaved');return result;
 }catch{menuBar.setSaveState('error');return false;}finally{__saveInFlight=false;}
};
const modelField=document.getElementById('fixture-source-model');if(modelField){modelField.value=modelTextEditor.getValue();modelField.addEventListener('input',()=>{const d=modelTextEditor.getDoc();d.text=modelField.value;d.clean=false;menuBar.setSaveState('unsaved');});}
