"use strict";

const libraryOwner = () => store.profile?.email || 'device:' + store.deviceId;
function libraryKind(name, image = false) {
  return image || /\.(png|jpe?g|webp|gif|heic|svg)$/i.test(name) ? 'image' : /\.pptx$/i.test(name) ? 'presentation' : /\.(pdf|docx?|odt|rtf)$/i.test(name) ? 'document' : 'other';
}
function libraryMatches(record, query, project, kind, direction) {
  const clean = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  return (!query || clean(record.name).includes(clean(query))) && (project === '*' || (record.projectId || '') === project) && (kind === '*' || record.kind === kind) && (direction === '*' || record.direction === direction);
}
async function libraryRecords() {
  const db = await openPreviewDatabase();
  return new Promise((resolve,reject)=>{
    const request=db.transaction('library').objectStore('library').getAll();
    request.onsuccess=()=>resolve(request.result.filter(row=>row.owner===libraryOwner()));
    request.onerror=()=>reject(request.error);
  });
}
async function libraryWrite(record, onlyNew = false) {
  const db=await openPreviewDatabase();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(['library','files'],'readwrite'), entries=tx.objectStore('library');
    const put=()=>{
      entries.put(record);
      if(record.previewId) { const request=tx.objectStore('files').get(record.previewId); request.onsuccess=()=>{ if(request.result) tx.objectStore('files').put({...request.result,saved:true}); }; }
    };
    if(onlyNew) { const request=entries.get(record.id); request.onsuccess=()=>{if(!request.result)put();}; } else put();
    tx.oncomplete=resolve; tx.onerror=()=>reject(tx.error); tx.onabort=()=>reject(tx.error);
  });
}
async function libraryRecord(id) {
  const db=await openPreviewDatabase();
  return new Promise((resolve,reject)=>{const request=db.transaction('library').objectStore('library').get(id);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
}
const libraryImageJobs=new Set();
function cacheLibraryImage(record) {
  if(libraryImageJobs.has(record.id))return;
  libraryImageJobs.add(record.id);
  cacheLibraryImage.queue=(cacheLibraryImage.queue||Promise.resolve()).catch(()=>{}).then(async()=>{
    const current=await libraryRecord(record.id);if(!current || current.previewId)return;
    const src=await resolveGeneratedImage(current.image),response=await fetch(src);if(!response.ok)return;
    const blob=await response.blob();if(blob.size>50*1024*1024)return;
    const ext=blob.type==='image/jpeg'?'jpg':blob.type==='image/webp'?'webp':'png';
    const name=current.name.replace(/\.png$/i,'.'+ext);
    const previewId=await rememberPreview(new File([blob],name,{type:blob.type}));
    const latest=await libraryRecord(record.id);
    if(previewId && latest)await libraryWrite({...latest,name,previewId});
  }).catch(console.warn).finally(()=>libraryImageJobs.delete(record.id));
}
async function indexConversationFiles(conversation) {
  const owner=libraryOwner();
  for (const [index,message] of conversation.messages.entries()) {
    const common={owner,conversationId:conversation.id,projectId:conversation.projectId||'',created:conversation.updatedAt||Date.now()};
    for(const [i,file] of (message.attachments||[]).entries()) {
      await libraryWrite({...common,id:owner+':sent:'+conversation.id+':'+index+':'+i,name:file.name||'Fichier',direction:'sent',kind:libraryKind(file.name,file.kind==='image'),previewId:file.previewId||null,file},true);
    }
    if(message.role!=='assistant') continue;
    const fences=[...String(message.content||'').matchAll(/```([\w#+.-]+)\s*\n([\s\S]*?)```/g)];
    for(const [i,match] of fences.entries()) {
      const lang=match[1],code=match[2];
      const name=fileNameFromCode(code,lang)||guessFileName(code,lang);
      if(name) await libraryWrite({...common,id:owner+':generated:'+conversation.id+':'+index+':'+i,name,direction:'generated',kind:libraryKind(name),code,lang},true);
    }
    for(const [i,image] of (message.images||[]).entries()) {
      const record={...common,id:owner+':image:'+conversation.id+':'+index+':'+i,name:'Image '+(index+1)+'-'+(i+1)+'.png',direction:'generated',kind:'image',image};
      await libraryWrite(record,true);cacheLibraryImage(record);
    }
  }
}

async function libraryBlob(record) {
  if(record.previewId) { const original=await storedPreview(record.previewId); if(original) return {name:original.name,blob:original.blob}; }
  if(record.code!==undefined) return {name:record.name,blob:new Blob([await generatedFileBytes(record.code,record.name)],{type:FILE_MIME[record.name.split('.').pop()]||'text/plain'})};
  if(record.image) {
    const src=await resolveGeneratedImage(record.image);
    const response=await fetch(src); if(!response.ok) throw new Error('Image indisponible.');
    return {name:record.name,blob:await response.blob()};
  }
  if(record.file && /^data:/.test(record.file.data||'')) return {name:record.name,blob:await (await fetch(record.file.data)).blob()};
  if(record.file?.kind==='text') return {name:record.name+' — texte extrait.txt',blob:new Blob([record.file.data||''],{type:'text/plain'})};
  throw new Error('L’original n’est plus disponible. Joins-le à nouveau.');
}

async function resumeSavedResponse(conversation) {
  if(busy) return;
  const item=conversation || store.conversations.find(c=>c.pendingResponse && (c.chatId || c.pendingResponse.recentChatIds) && (!c.pendingResponse.owner || c.pendingResponse.owner===store.profile?.email));
  if(!item?.pendingResponse) return;
  currentId=item.id;
  renderModels(); renderMessages(); renderHistory();
  await runAssistant(item,item.pendingResponse.text,[],true);
}

async function openLibrary() {
  document.getElementById('file-library')?.remove();
  const dialog=document.createElement('dialog');dialog.id='file-library';dialog.className='file-library';
  dialog.innerHTML='<header><div><h2>Bibliothèque</h2><p>Fichiers et images conservés sur ce téléphone.</p></div><button type="button" data-close aria-label="Fermer">×</button></header><section data-jobs></section><div class="library-filters"><input type="search" placeholder="Rechercher un fichier" aria-label="Rechercher un fichier"><select data-project aria-label="Filtrer par projet"><option value="*">Tous les projets</option><option value="">Sans projet</option></select><select data-kind aria-label="Type de fichier"><option value="*">Tous les types</option><option value="image">Images</option><option value="document">Documents</option><option value="presentation">PowerPoint</option><option value="other">Autres fichiers</option></select><select data-direction aria-label="Origine"><option value="*">Envoyés et générés</option><option value="sent">Envoyés</option><option value="generated">Générés</option></select></div><p data-status role="status">Chargement…</p><div class="library-grid"></div><footer><button type="button" data-notifications></button><small>Notifications locales pendant l’exécution en arrière-plan. Pas de notification distante quand l’app est fermée.</small></footer>';
  document.body.append(dialog);dialog.showModal();
  dialog.querySelector('[data-close]').onclick=()=>{dialog.close();dialog.remove();};
  dialog.addEventListener('close',()=>dialog.remove(),{once:true});
  const notifications=dialog.querySelector('[data-notifications]');
  notifications.textContent=store.completionNotifications?'Désactiver les notifications':'Activer les notifications';
  notifications.disabled=window.Capacitor?.getPlatform?.()!=='ios';
  notifications.onclick=async()=>{
    try { const result=await window.Capacitor.Plugins.ChatStream.configureNotifications({enabled:!store.completionNotifications});store.completionNotifications=result.enabled===true;saveStore();notifications.textContent=store.completionNotifications?'Désactiver les notifications':'Activer les notifications';if(!result.enabled)showToast('Notifications désactivées. Vérifie les réglages iOS si tu souhaites les autoriser.'); }
    catch(error){showToast(error.message,true);}
  };
  const jobs=dialog.querySelector('[data-jobs]');
  for(const conversation of store.conversations.filter(c=>c.pendingResponse && (!c.pendingResponse.owner || c.pendingResponse.owner===store.profile?.email))) {
    const row=document.createElement('div');row.className='library-job';
    const label=document.createElement('strong');label.textContent='Réponse en attente · '+conversation.title;
    const resume=document.createElement('button');resume.textContent='Reprendre';resume.disabled=busy||!(conversation.chatId||conversation.pendingResponse.recentChatIds);
    resume.onclick=()=>{dialog.close();resumeSavedResponse(conversation);};
    const cancel=document.createElement('button');cancel.textContent=conversation.chatId?'Annuler':'Retirer le suivi';cancel.disabled=busy;
    cancel.onclick=async()=>{try{if(conversation.chatId){const response=await apiFetch('/chats/'+encodeURIComponent(conversation.chatId)+'/stream/cancel',{method:'POST'});if(!response.ok)throw new Error('Annulation non confirmée par le serveur.');}delete conversation.pendingResponse;saveStore();row.remove();}catch(error){dialog.querySelector('[data-status]').textContent=error.message;}};
    row.append(label,resume,cancel);jobs.append(row);
  }
  try {
    let projects=typeof accountProjects==='undefined'?[]:accountProjects;
    try {const response=await apiFetch('/projects');if(response.ok)projects=settingsItems(await response.json(),'projects');}catch{}
    const projectSelect=dialog.querySelector('[data-project]');
    for(const project of projects) {const option=document.createElement('option');option.value=project.id;option.textContent=project.name;projectSelect.append(option);}
    for(const conversation of store.conversations)await indexConversationFiles(conversation);
    const records=await libraryRecords();
    const search=dialog.querySelector('input'),kind=dialog.querySelector('[data-kind]'),direction=dialog.querySelector('[data-direction]'),grid=dialog.querySelector('.library-grid');
    const render=()=>{
      grid.replaceChildren();
      const list=records.filter(r=>libraryMatches(r,search.value,projectSelect.value,kind.value,direction.value)).sort((a,b)=>b.created-a.created);
      dialog.querySelector('[data-status]').textContent=list.length+' fichier(s)';
      for(const record of list) {
        const card=document.createElement('article');card.className='library-card';
        const open=document.createElement('button');open.className='library-open';open.innerHTML=fileIconSvg(record.name,record.kind==='image'?'image':'file');
        const name=document.createElement('strong');name.textContent=record.name;open.append(name);open.title='Aperçu';
        open.onclick=async()=>{open.disabled=true;try{const file=await libraryBlob(record);dialog.close();await previewBlob(file.name,file.blob);}catch(e){dialog.querySelector('[data-status]').textContent=e.message;}finally{open.disabled=false;}};
        const meta=document.createElement('small');meta.textContent=(record.direction==='sent'?'Envoyé':'Généré')+' · '+new Date(record.created).toLocaleDateString('fr-FR');
        const project=document.createElement('select');project.setAttribute('aria-label','Classer '+record.name+' dans un projet');
        const none=document.createElement('option');none.value='';none.textContent='Sans projet';project.append(none);
        for(const item of projects){const option=document.createElement('option');option.value=item.id;option.textContent=item.name;project.append(option);}project.value=record.projectId||'';
        project.onchange=async()=>{record.projectId=project.value;try{await libraryWrite(record);render();}catch(e){showToast(e.message,true);}};
        const save=document.createElement('button');save.textContent='Enregistrer';save.onclick=async()=>{save.disabled=true;try{const file=await libraryBlob(record);await saveFile(file.name,new Uint8Array(await file.blob.arrayBuffer()));showToast('Fichier enregistré.');}catch(e){showToast(e.message,true);}finally{save.disabled=false;}};
        card.append(open,meta,project,save);grid.append(card);
      }
    };
    for(const field of [search,projectSelect,kind,direction])field.addEventListener('input',render);
    render();
  } catch(error){dialog.querySelector('[data-status]').textContent='Bibliothèque indisponible : '+error.message;}
}
