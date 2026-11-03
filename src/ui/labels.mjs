// Presentation only. Raw query terms, Core states and effect guards are intact.
export const taskName=kind=>({SOURCE_INSPECT:'Source inspection',SOURCE_SAVE:'Source save',DEPLOY:'Deploy',DEVELOP:'Develop',CREATE:'Create',REFRESH:'Refresh',RENEW:'Route check'})[kind]??String(kind??'Work').replaceAll('_',' ').toLowerCase();
export const workState=job=>job.effect?.boundary==='POSSIBLE'?'Unknown':({HELD:'Needs attention',WAITING:'Waiting',RUNNING:'In progress',READY:'Ready',COMPLETE:'Complete',FAILED:'Failed'})[job.state]??'Unknown';
export function taskLabel(label){const text=String(label??'Work'),match=/^([A-Z][A-Z0-9_]*) · (.*)$/s.exec(text);return match?taskName(match[1])+' · '+match[2]:text;}
export const stateLabel=state=>({HELD:'Needs attention',WAITING:'Waiting',RUNNING:'In progress',READY:'Ready',COMPLETE:'Complete',FAILED:'Failed',PREPARING:'Preparing',ARCHIVED:'Archived',REMOVING:'Removing local data',REACTIVATING:'Reactivating',LOGIN_REQUIRED:'Login required',PUBLIC:'Public',UNLISTED:'Unlisted',UNKNOWN:'Unknown',CREATED:'Created',OWNED:'Owned'})[state]??String(state??'Unknown').replaceAll('_',' ').toLowerCase();
export function searchDetail(detail){
 const names={'pcms-accounts':'Accounts','pcms-discover':'Discover','pcms-creator':'Creator','pcms-deployer':'Deployer','pcms-refresher':'Refresher','pcms-journal':'Journal','pcms-backup':'Backup',ACCOUNT_ROUTE_RECHECK_REQUIRED:'Protected route needs a fresh check',ACCOUNT_LOGIN_REQUIRED:'Complete login',CREATOR_OUTCOME_UNKNOWN:'Creation result is unknown',WAIT_CREATOR:'Waiting for Creator'};
 return String(detail??'').split(' · ').map(part=>Object.hasOwn(names,part)?names[part]:(/^[A-Z][A-Z0-9_]*$/.test(part)?stateLabel(part):part)).join(' · ');
}
