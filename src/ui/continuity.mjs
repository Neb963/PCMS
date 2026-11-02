export function rememberPage(document,window) {
 const e=document.activeElement,row=e?.closest('li'),anchor=row?.querySelector('a[href]');
 return {scroll:window.scrollY,focus:e&&e!==document.body?{id:e.id||null,href:e.getAttribute('href'),tag:e.tagName,text:e.tagName==='BUTTON'||e.tagName==='SUMMARY'?e.textContent:null,row:anchor?.getAttribute('href')??null}:null};
}
export function restorePage(saved,document,window) {
 if(!saved)return;
 const f=saved.focus;
 if(f){const row=f.row?[...document.querySelectorAll('li')].find(r=>r.querySelector('a[href]')?.getAttribute('href')===f.row):null,scope=row??document;
  const e=(f.id?document.getElementById(f.id):f.href?[...scope.querySelectorAll('a[href]')].find(a=>a.getAttribute('href')===f.href):f.text?[...scope.querySelectorAll('button,summary')].find(e=>e.tagName===f.tag&&e.textContent===f.text):null)??row?.querySelector('a[href]');
  if(e&&!e.disabled&&!e.hidden)e.focus({preventScroll:true});
 }
 if(Number.isFinite(saved.scroll))window.scrollTo(0,saved.scroll);
}
