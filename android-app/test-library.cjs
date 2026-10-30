const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const records=new Map();
const context=vm.createContext({store:{deviceId:'device',profile:{email:'me@example.com'}},Date});
for(const name of ['render','powerpoint','library'])vm.runInContext(fs.readFileSync(__dirname+'/www/js/'+name+'.js','utf8'),context);
context.libraryWrite=async(record,onlyNew)=>{if(!onlyNew||!records.has(record.id))records.set(record.id,record);};
context.cacheLibraryImage=()=>{};
const conversation={id:'chat',projectId:'project',updatedAt:1,messages:[
  {role:'user',attachments:[{name:'Cours.pdf',kind:'text',data:'texte extrait',previewId:'original'}]},
  {role:'assistant',content:'```pptx\n'+JSON.stringify({filename:'Énergie.pptx',slides:[{title:'Énergie',bullets:[]}]})+'\n```',images:[{id:'image',chatId:'remote',messageId:'message'}]}
]};
(async()=>{
  await context.indexConversationFiles(conversation);
  assert.equal(records.size,3);
  const rows=[...records.values()];
  assert.equal(rows.find(r=>r.direction==='sent').previewId,'original');
  const deck=rows.find(r=>r.kind==='presentation');assert.equal(deck.name,'Énergie.pptx');
  assert.equal(context.libraryMatches(deck,'energie','project','presentation','generated'),true);
  assert.equal(context.libraryMatches(deck,'energie','another','*','*'),false);
  deck.projectId='another';
  await context.indexConversationFiles(conversation);
  assert.equal(records.get(deck.id).projectId,'another','Le classement manuel est conservé pendant la réindexation');
  assert.equal(records.size,3,'Aucun doublon pendant la réindexation');
  const large={data:'data:image/png;base64,'+'A'.repeat(2000000)};
  await context.indexConversationFiles({...conversation,id:'large-image',messages:[{role:'assistant',content:'',images:[]}]},[large]);
  assert.equal([...records.values()].find(r=>r.conversationId==='large-image').image.data,large.data,'Les grandes images exclues du localStorage restent dans la bibliothèque IndexedDB');
  console.log('OK : documents envoyés, PPTX et images générés, recherche et classement par projet sans doublons.');
})().catch(error=>{console.error(error);process.exitCode=1;});
