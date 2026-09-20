(function(global){
 'use strict';
 const cache=new WeakMap();
 function sanitize(html){const source=new DOMParser().parseFromString(html||'','text/html');source.querySelectorAll('iframe').forEach(frame=>{const link=source.createElement('a');link.href=frame.getAttribute('src')||'';link.textContent='视频来源：'+link.href;frame.replaceWith(link);});return global.DOMPurify?DOMPurify.sanitize(source.body.innerHTML):'';}
 function plain(html){const div=document.createElement('div');div.innerHTML=global.DOMPurify?DOMPurify.sanitize(html||''):'';return div.textContent||'';}
 function text(entry){const signature=[entry.title,entry.content,entry.analysis,entry.citation,entry.typeId,JSON.stringify(entry.keywords),JSON.stringify(entry.metadata),JSON.stringify(entry.comments)].join('\u0000');let record=cache.get(entry);if(record?.signature===signature)return record.value;
  const value=[entry.title,plain(entry.content),plain(entry.analysis),(entry.keywords||[]).join(' '),entry.citation,entry.typeId,Object.values(entry.metadata||{}).join(' '),Object.values(entry.comments||{}).map(c=>c.text||'').join(' ')].join(' ').toLowerCase();cache.set(entry,{signature,value});return value;
 }
 global.ResearchSearch={text,plain,sanitize};
})(window);
