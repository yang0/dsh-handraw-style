window.__ModuleLoader__.load({
  id: 'dsh-plugin-pose-studio',
  factory(require) {
    const { createElement: h, useState, useEffect, useLayoutEffect, useRef } = require('react');
    const panel = 'pose-studio';
    const categories = { pose: '姿势', clothes: '服装', face: '人像', style: '画风' };
    // 画风按 FA–FI 分组、版式按 SC/IG/SB/IP/EC 分组；素材分类的二级导航直接用中文名，不露出编号。
    const groups = { FA:'社论幽默', FB:'经典绘本', FC:'平面艺术', FD:'当代插画', FE:'国风工艺', FF:'黏土纸雕', FG:'动漫赛璐璐', FH:'实验媒介', FI:'写实摄影',
      SC:'社媒卡', IG:'信息图', SB:'漫画分镜', IP:'IP 设计', EC:'电商图' };
    const api = '/api/pose-studio.';
    const thumb = (kind, item, depth, full) => api + 'thumb?' + new URLSearchParams({ kind, id: item.id, depth: depth ? '1' : '0', full: full ? '1' : '0' });
    async function request(path, body, signal) {
      const response = await fetch(api + path, {
        signal,
        ...(body === undefined ? {} : { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) }),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || `DSH 请求失败（${response.status}）`);
      }
      return response;
    }
    function Button(label, click, opts = {}) {
      return h('button', { type:'button', onClick:click, ...opts }, label);
    }
    const css = `
    .ps{height:100%;overflow:auto;background:#f5f2ec;color:#24211c;font:14px/1.5 system-ui,sans-serif;color-scheme:light}
    .ps *{box-sizing:border-box}.ps button,.ps input,.ps textarea,.ps select{font:inherit;color:inherit}
    .ps button,.ps select,.ps input:not([type=checkbox]),.ps textarea{background:#fffdf9;border:1px solid #d9d3c7;border-radius:8px;padding:8px}
    .ps button{cursor:pointer}.ps button:disabled{opacity:.5;cursor:default}.ps button[aria-pressed=true],.ps .primary{background:#214c42;color:white;border-color:#214c42}
    .ps :focus-visible{outline:2px solid #2d8068;outline-offset:2px}.ps a{color:#245749}
    .ps header{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:22px 24px;border-bottom:1px solid #ded8cd}
    .ps h1,.ps h2,.ps p{margin:0}.ps h1{font-size:24px}.ps h2{font-size:17px}.ps small,.ps .muted{color:#6c6458}
    .ps .grid{display:grid;grid-template-columns:minmax(270px,360px) minmax(0,1fr);gap:18px;padding:18px 24px;max-width:1500px;margin:auto}
    .ps .box{padding:16px;background:#fffdf9;border:1px solid #ded8cd;border-radius:14px;min-width:0}
    .ps .line{display:flex;align-items:center;flex-wrap:wrap;gap:8px}.ps .spread{justify-content:space-between}
    .ps .stack{display:grid;align-content:start;gap:12px}.ps .tiles{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
    .ps .tiles button{padding:4px;min-width:0;text-align:left;font-size:11px;overflow:hidden}.ps .tiles img{width:100%;aspect-ratio:1;object-fit:contain;background:#efede6;border-radius:5px;display:block}
    .ps .tiles span{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .ps .slots{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.ps .slot{padding:8px;border:1px solid #e5dfd4;border-radius:8px;min-width:0;overflow-wrap:anywhere}
    .ps .slot img{width:100%;height:78px;object-fit:contain;display:block}.ps .slot button{font-size:12px;padding:4px 6px}
    .ps textarea,.ps .wide{width:100%}.ps textarea{resize:vertical;min-height:108px}.ps label{display:block}.ps .result{max-height:650px;max-width:100%;margin:auto;border-radius:8px}
    .ps .error{color:#962c24}.ps footer{padding:8px 24px 22px}.ps .settings{margin:16px 24px 0}.ps .settings input{max-width:100%}
    @media(max-width:740px){.ps .grid{grid-template-columns:1fr;padding:12px}.ps header,.ps footer{padding:12px}.ps .settings{margin:12px}}
    `;
    // 生成图的大图查看层：点图片放大，可继续放大/缩小/适应，Esc 或点背景关闭。
    // 选择器统一带 .ps 前缀，确保压过主题里后出现的 .ps button / .ps img 规则。
    const viewerCss = `
    .ps .preview{cursor:zoom-in}
    .ps .ps-viewer{position:fixed;inset:0;z-index:30;background:#0b0d12e8;display:flex;flex-direction:column;gap:10px;padding:14px;overflow:auto}
    .ps .ps-viewer-bar{display:flex;gap:8px;align-items:center;justify-content:center;flex-wrap:wrap;flex:none}
    .ps .ps-viewer-bar button{background:#ffffff1a;border:1px solid #ffffff3d;color:#fff;border-radius:8px;padding:6px 12px}
    .ps .ps-viewer-bar button:hover:not(:disabled){background:#ffffff30;border-color:#ffffff66}
    .ps .ps-viewer-bar .scale{color:#d9dce8;font-size:12px;min-width:46px;text-align:center}
    .ps .ps-viewer-stage{flex:1;display:grid;place-items:center;min-height:0}
    .ps .ps-viewer-stage img{max-width:100%;max-height:calc(100vh - 120px);object-fit:contain;border-radius:6px;box-shadow:0 18px 60px #000c;transform-origin:center center;transition:transform .12s ease;cursor:zoom-in}
    .ps .ps-viewer-stage img.zoomed{cursor:zoom-out}
    `;
    const platforms = {
      article:['文章插图 · 4:3',1200,900],
      xhs:['小红书竖版',1080,1440], dy:['抖音竖版',1080,1920], wx:['公众号宽封面',1200,510],
      bili:['B 站横版封面',1280,720], ig:['Instagram 竖版',1080,1350], yt:['YouTube 横版封面',1280,720], square:['通用方图',1080,1080], portrait:['通用竖版',1080,1620],
    };
    const modes = {
      single:['单张出图','portrait',['single']], carousel:['图文套图','xhs',['cover','step','step','compare','step','summary']],
      poster:['封面 / 海报','bili',['cover']], knowledge:['知识卡','xhs',['step','compare','summary']],
      article:['文章配图','wx',['cover','scene','scene']], shop:['电商商品图','square',['product','compare','summary']],
      photo:['摄影组照','portrait',['single','step','scene']], ip:['IP 角色卡','xhs',['cover','step','compare']],
    };
    const roles = {
      single:['主视觉','', '全身', '正面','完整主体居中，自然留出呼吸空间'],
      cover:['封面','SC-001','全身','斜前','主视觉集中在下方，适合轮廓清晰的动作'],
      step:['动作 / 步骤','SC-019','上半身','侧面','突出手部、重心和动作结构'],
      compare:['对比','IG-004','全身','正面','以并列等大构图比较差异，保持视角一致'],
      summary:['总结','SC-020','上半身','斜前','用紧凑信息区配合简洁主视觉'],
      scene:['场景图','', '全身','侧面','环境交代叙事，动作具有方向性'],
      product:['商品主图','EC-001','','','商品占据视觉中心，保留包装及标志'],
    };
    const galleryPageSize = 72;
    const catalogs = { ...categories, color:'主题色', layout:'版式' };
    const isGif = page => page?.image?.startsWith('data:image/gif;');
    const blankPage = (role, title='', body='') => ({ id:crypto.randomUUID(), role,title,body,brief:'',refs:{},image:'',locked:false });
    const fresh = () => ({ id:crypto.randomUUID(),mode:'single',platform:'portrait',outputFormat:'png',frameCount:9,frameDurationMs:200,theme:'',outline:'',visual:{},pages:[blankPage('single')],anchor:'' });
    // 存档可能来自旧版本，读回时补齐缺省字段，避免恢复出无法渲染的项目。
    function normalizeProject(project) {
      if(!project||typeof project!=='object'||!Array.isArray(project.pages)||!project.pages.length)return null;
      return {
        id:project.id||crypto.randomUUID(),
        mode:Object.hasOwn(modes,project.mode)?project.mode:'single',
        platform:Object.hasOwn(platforms,project.platform)?project.platform:'portrait',
        outputFormat:project.outputFormat==='gif'?'gif':'png',
        frameCount:Number.isInteger(project.frameCount)&&project.frameCount>=2&&project.frameCount<=16?project.frameCount:9,
        frameDurationMs:Number.isInteger(project.frameDurationMs)&&project.frameDurationMs>=20&&project.frameDurationMs<=2000&&project.frameDurationMs%10===0?project.frameDurationMs:200,
        ratio:typeof project.ratio==='string'&&project.ratio.trim()?project.ratio:undefined,
        attachments:Array.isArray(project.attachments)?project.attachments:[],manualAttachments:project.manualAttachments===true,
        article:typeof project.article==='string'?project.article:undefined,
        theme:typeof project.theme==='string'?project.theme:'',
        outline:typeof project.outline==='string'?project.outline:'',
        concept:typeof project.concept==='string'?project.concept:undefined,
        plannerModel:typeof project.plannerModel==='string'?project.plannerModel:undefined,
        anchor:typeof project.anchor==='string'?project.anchor:'',
        visual:project.visual&&typeof project.visual==='object'?project.visual:{},
        pages:project.pages.map(page=>({
          id:page?.id||crypto.randomUUID(),
          role:Object.hasOwn(roles,page?.role)?page.role:'single',
          title:typeof page?.title==='string'?page.title:'',
          body:typeof page?.body==='string'?page.body:'',
          brief:typeof page?.brief==='string'?page.brief:'',
          sceneText:typeof page?.sceneText==='string'?page.sceneText:undefined,
          placement:typeof page?.placement==='string'?page.placement:undefined,
          format:Object.hasOwn(platforms,page?.format)?page.format:undefined,
          direction:page?.direction&&typeof page.direction==='object'?page.direction:undefined,
          promptMode:page?.promptMode,layoutVariant:page?.layoutVariant,redraw:page?.redraw,
          typeOn:page?.typeOn,nativeLayout:page?.nativeLayout,
          savedPath:typeof page?.savedPath==='string'?page.savedPath:undefined,
          saveError:typeof page?.saveError==='string'?page.saveError:undefined,
          refs:page?.refs&&typeof page.refs==='object'?page.refs:{},
          image:typeof page?.image==='string'?page.image:'',
          uploads:Array.isArray(page?.uploads)?page.uploads:[],
          upload:typeof page?.upload==='string'?page.upload:undefined,
          depth:page?.depth?true:undefined,
          people:typeof page?.people==='boolean'?page.people:undefined,
          locked:Boolean(page?.locked),
        })),
      };
    }
    const uid = 'dsh-pose-studio-v2';
    const localKey = 'dsh-pose-studio:workspace';
    // 面板切换会卸载并重新挂载组件，整页刷新会清空模块变量。三种存档互为兜底：
    // workspaceSnapshot（本页内最快）、localStorage（同步、跨刷新）、IndexedDB（含成图）。
    let workspaceSnapshot;
    let databasePromise;
    let databaseUsable = true;
    let workspacePending;
    let workspaceTimer;
    const isImage = value => typeof value==='string' && value.startsWith('data:image');
    function lightSnapshot(snapshot) {
      const project=snapshot.project;
      const light=files=>files?.map(file=>file.kind==='image'?{...file,data:''}:file);
      return { ...snapshot, attachments:light(snapshot.attachments), savedAt:snapshot.savedAt??Date.now(), project:project?{
        ...project, attachments:light(project.attachments), anchor:isImage(project.anchor)?'':project.anchor,
        pages:project.pages.map(page=>({ ...page, image:isImage(page.image)?'':page.image, upload:isImage(page.upload)?'':page.upload, uploads:light(page.uploads) })),
      }:project };
    }
    function writeLocal(snapshot) {
      try { localStorage.setItem(localKey, JSON.stringify(lightSnapshot(snapshot))); } catch {}
    }
    function readLocal() {
      try {
        const raw=localStorage.getItem(localKey);
        const value=raw?JSON.parse(raw):null;
        return value?.project?.pages?.length?value:undefined;
      } catch { return undefined; }
    }
    function remember(snapshot) {
      workspaceSnapshot={ ...snapshot, savedAt:Date.now() };
      writeLocal(workspaceSnapshot);
      queueWorkspace(workspaceSnapshot);
    }
    function rememberProject(project) {
      if(!workspaceSnapshot)return;
      remember({ ...workspaceSnapshot, project });
    }
    function queueWorkspace(snapshot) {
      workspacePending=snapshot;
      if(workspaceTimer||!databaseUsable)return;
      workspaceTimer=setTimeout(flushWorkspace,200);
    }
    function flushWorkspace() {
      if(workspaceTimer){clearTimeout(workspaceTimer);workspaceTimer=undefined;}
      const next=workspacePending;
      workspacePending=undefined;
      if(next&&databaseUsable)projectStore('put',next,'workspace').catch(()=>{});
    }
    function openDatabase() {
      return new Promise((resolve,reject)=>{
        const upgrade=db=>{
          if(!db.objectStoreNames.contains('projects'))db.createObjectStore('projects',{keyPath:'id'});
          if(!db.objectStoreNames.contains('workspace'))db.createObjectStore('workspace');
        };
        const open=version=>{
          const req=version===undefined?indexedDB.open(uid):indexedDB.open(uid,version);
          req.onupgradeneeded=()=>upgrade(req.result);
          req.onsuccess=()=>{
            const db=req.result;
            // 旧库可能只有 projects，直接按原版本打开会缺少 workspace：升级一版补齐。
            if(db.objectStoreNames.contains('workspace')||version!==undefined){resolve(db);return;}
            const next=db.version+1;
            db.close();
            open(next);
          };
          req.onerror=()=>reject(req.error);
          req.onblocked=()=>reject(new Error('IndexedDB 被其他窗口占用'));
        };
        open();
      });
    }
    function database() {
      if(!databasePromise){
        databasePromise=openDatabase().then(db=>{
          db.onversionchange=()=>{db.close();databasePromise=undefined;};
          return db;
        }).catch(error=>{databasePromise=undefined;throw error;});
      }
      return databasePromise;
    }
    async function projectStore(action,value,store='projects',retry=true) {
      const db=await database();
      try {
        return await new Promise((resolve,reject)=>{
          const tx=db.transaction(store,action==='getAll'||action==='get'?'readonly':'readwrite');
          const objectStore=tx.objectStore(store);
          const req=store==='workspace'
            ?(action==='put'?objectStore.put(value,'current'):objectStore[action]('current'))
            :(value===undefined?objectStore[action]():objectStore[action](value));
          tx.oncomplete=()=>resolve(req.result);
          tx.onerror=()=>reject(tx.error);
          tx.onabort=()=>reject(tx.error);
        });
      } catch (error) {
        databasePromise=undefined;
        if(!retry)throw error;
        return projectStore(action,value,store,false);
      }
    }
    // 出图请求放在模块作用域：切走面板不再中断，回来后仍能拿到结果。
    const job={controller:null,label:'',error:'',listeners:new Set()};
    function startJob(label,fn) {
      const controller=new AbortController();
      job.controller=controller;job.label=label;job.error='';
      let settled=false;
      const settle=error=>{
        if(settled)return;
        settled=true;
        if(job.controller===controller){
          job.controller=null;
          job.label='';
          job.error=controller.signal.aborted?'':(error?.message||'');
        }
        for(const listener of [...job.listeners]){try{listener();}catch{}}
      };
      Promise.resolve().then(()=>fn(controller.signal)).then(()=>settle(),settle);
    }
    let latestProject=null;
    let saveQueue=Promise.resolve();
    function selectedAssets(project,page) {
      return {
        ...Object.fromEntries(Object.entries(project.visual).filter(([,v])=>v!==undefined)),
        ...Object.fromEntries(Object.entries(page.refs).filter(([,v])=>v!==undefined)),
      };
    }
    function imageData(blob) {
      return new Promise((resolve,reject)=>{
        const reader=new FileReader();
        reader.onload=()=>resolve(reader.result);
        reader.onerror=()=>reject(reader.error);
        reader.readAsDataURL(blob);
      });
    }
    function loadImage(src) {
      return new Promise((resolve,reject)=>{
        const img=new Image();
        img.onload=()=>resolve(img);
        img.onerror=()=>reject(new Error('图片读取失败'));
        img.src=src;
      });
    }
    function presetRatio(platform){
      const [,w,h]=platforms[platform]||platforms.portrait;
      let a=w,b=h;
      while(b)[a,b]=[b,a%b];
      return (w/a)+':'+(h/a);
    }
    function readRatio(value){
      const match=/^(\d{1,3}(?:\.\d{1,2})?)\s*[:：]\s*(\d{1,3}(?:\.\d{1,2})?)$/.exec(value?.trim()||'');
      if(!match)return [];
      const w=Number(match[1]),h=Number(match[2]);
      return w>0&&h>0&&w/h>=.2&&w/h<=5?[w,h]:[];
    }
    function getFrame(project,page) {
      let [,w,h]=platforms[page.format||project.platform]||platforms.portrait;
      const [rw,rh]=readRatio(page.direction?.ratio||project.ratio);
      if(rw&&rh){const scale=1600/Math.max(rw,rh);w=Math.round(rw*scale);h=Math.round(rh*scale);}
      const hasText=page.typeOn??Boolean(page.image&&!page.nativeLayout&&!['single','scene'].includes(page.role));
      const shape=hasText?(w>h?'side':page.layoutShape==='bottom'?'bottom':'stack'):'full';
      return {w,h,hasText,shape};
    }
    async function renderPng(project,page,index) {
      const {w,h,shape,hasText}=getFrame(project,page);
      const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
      const c=canvas.getContext('2d');
      const im=page.image?await loadImage(page.image):null;
      const gutter=Math.round(Math.min(w,h)*.06);
      c.fillStyle='#f7f2e7';c.fillRect(0,0,w,h);
      const box=shape==='side'?[Math.round(w*.47),0,Math.round(w*.53),h]:
        shape==='stack'?[0,Math.round(h*.36),w,Math.round(h*.64)]:shape==='bottom'?[0,0,w,Math.round(h*.61)]:[0,0,w,h];
      if(im){
        const [x,y,bw,bh]=box;
        const scale=Math.min(bw/im.width,bh/im.height);
        const iw=im.width*scale,ih=im.height*scale;
        c.drawImage(im,x+(bw-iw)/2,y+(bh-ih)/2,iw,ih);
      }
      if(hasText){
        const available=(shape==='side'?w*.47:w)-2*gutter;
        const textBottom=shape==='side'?h*.86:shape==='bottom'?h*.94:h*.35;
        let y=shape==='bottom'?h*.62:gutter;
        c.fillStyle=page.accent||'#214c42';
        c.fillRect(gutter,y,Math.round(w*.065),Math.max(3,Math.round(h*.005)));
        y+=gutter*.35;
        function drawText(value,size,weight,limit){
          c.font=weight+' '+size+'px "Microsoft YaHei","PingFang SC",sans-serif';
          c.textBaseline='top';
          let count=0;
          for(const paragraph of String(value||'').split('\n')){
            let line='';
            for(const ch of paragraph){
              if(c.measureText(line+ch).width>available&&line){
                if(count>=limit||y+size>textBottom) return false;
                c.fillText(line,gutter,y); y+=size*1.23; count++; line='';
              }
              line+=ch;
            }
            if(count>=limit||y+size>textBottom) return false;
            c.fillText(line,gutter,y); y+=size*1.23; count++;
          }
          return true;
        }
        c.fillStyle='#253c33';
        if(!drawText(page.title,Math.round(Math.min(w,h)*.058),700,3)) throw new Error('标题超过版面空间，请缩短标题。');
        y+=gutter*.24;
        c.fillStyle='#3a443e';
        if(page.body&&!drawText(page.body,Math.round(Math.min(w,h)*.028),400,8)) throw new Error('正文超过版面空间，请删减或拆页。');
        c.font=Math.round(Math.min(w,h)*.025)+'px sans-serif';
        c.fillText(String(index+1).padStart(2,'0')+' / '+project.pages.length,w-gutter*2,h-gutter*.6);
      }
      return await new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('PNG 导出失败')),'image/png'));
    }
    function download(blob,name) {
      const url=URL.createObjectURL(blob);
      const a=document.createElement('a');a.href=url;a.download=name;a.click();
      setTimeout(()=>URL.revokeObjectURL(url),10000);
    }
    async function zip(files) {
      const encoder=new TextEncoder(), records=[], central=[];
      let offset=0;
      const crcTable=Uint32Array.from({length:256},(_,n)=>{for(let j=0;j<8;j++)n=(n>>>1)^((n&1)?0xedb88320:0);return n;});
      for(const {name,blob} of files){
        const file=encoder.encode(name), data=new Uint8Array(await blob.arrayBuffer());
        let crc=0xffffffff;
        for(const byte of data) crc=crcTable[(crc^byte)&255]^(crc>>>8);
        crc=(crc^0xffffffff)>>>0;
        const local=new Uint8Array(30+file.length),l=new DataView(local.buffer);
        l.setUint32(0,0x04034b50,true);l.setUint16(4,20,true);l.setUint16(6,2048,true);
        l.setUint32(14,crc,true);l.setUint32(18,data.length,true);l.setUint32(22,data.length,true);l.setUint16(26,file.length,true);local.set(file,30);
        const entry=new Uint8Array(46+file.length),e=new DataView(entry.buffer);
        e.setUint32(0,0x02014b50,true);e.setUint16(4,20,true);e.setUint16(6,20,true);e.setUint16(8,2048,true);
        e.setUint32(16,crc,true);e.setUint32(20,data.length,true);e.setUint32(24,data.length,true);e.setUint16(28,file.length,true);e.setUint32(42,offset,true);entry.set(file,46);
        records.push(local,data);central.push(entry);offset+=local.length+data.length;
      }
      const end=new Uint8Array(22),v=new DataView(end.buffer);
      v.setUint32(0,0x06054b50,true);v.setUint16(8,files.length,true);v.setUint16(10,files.length,true);
      v.setUint32(12,central.reduce((n,x)=>n+x.length,0),true);v.setUint32(16,offset,true);
      return new Blob([...records,...central,end],{type:'application/zip'});
    }

    function Studio() {
      // 首次渲染就同步取回最近一次的状态：模块快照优先，其次 localStorage，
      // 因此切换面板回来时不会先闪一下空白工作台。
      const [seed]=useState(()=>{
        const raw=workspaceSnapshot??readLocal();
        if(!raw)return undefined;
        const normalized=normalizeProject(raw.project);
        return normalized?{ ...raw, project:normalized }:undefined;
      });
      const [project,setProject]=useState(()=>seed?.project??fresh());
      const [projects,setProjects]=useState([]);
      const [active,setActive]=useState(()=>seed?.active??0);
      const [lists,setLists]=useState({});
      const [picker,setPicker]=useState(()=>seed?.picker??null);
      const [view,setView]=useState(()=>seed?.view??'create');
      const [galleryKind,setGalleryKind]=useState(()=>seed?.galleryKind??'style');
      const [poseAngles,setPoseAngles]=useState({});
      const [focused,setFocused]=useState(()=>seed?.focused??null);
      const [group,setGroup]=useState(()=>seed?.group??'');
      const [scenario,setScenario]=useState(()=>seed?.scenario??'');
      const [inspector,setInspector]=useState(()=>seed?.inspector??'picture');
      const [attachments,setAttachments]=useState(()=>seed?.attachments??seed?.project?.attachments??[]);
      const [articleDraft,setArticleDraft]=useState(()=>seed?.articleDraft??'');
      const [count,setCount]=useState(()=>seed?.count??0);
      const [themeDraft,setThemeDraft]=useState(()=>seed?.themeDraft??null);
      const [filter,setFilter]=useState(()=>seed?.filter??'');
      const [limit,setLimit]=useState(()=>Math.max(galleryPageSize,seed?.limit??0));
      const [settings,setSettings]=useState(null);
      const [openSettings,setOpenSettings]=useState(false);
      const [key,setKey]=useState('');
      const [revealed,setRevealed]=useState(false);
      const [baseUrl,setBaseUrl]=useState(null);
      const [outputPath,setOutputPath]=useState(null);
      const [directoryListing,setDirectoryListing]=useState(null);
      const [folderName,setFolderName]=useState('');
      const [showHiddenFolders,setShowHiddenFolders]=useState(false);
      function chooseOutputDirectory(operation='open',path,name){
        action('选择保存文件夹',async signal=>{
          const result=await(await request('output-directory-picker',{action:operation,path,name},signal)).json();
          if(signal.aborted)return;
          if(result.kind==='native'){
            if(result.path)setOutputPath(result.path);
          }else{
            setDirectoryListing(result.listing);setFolderName('');
          }
        });
      }
      function closeSettings(){
        setOpenSettings(false);setKey('');setRevealed(false);setBaseUrl(null);setOutputPath(null);setDirectoryListing(null);setFolderName('');
      }
      function toggleKey(){
        if(revealed){setRevealed(false);return;}
        if(key||!settings?.configured){setRevealed(true);return;}
        action('读取已保存密钥',async signal=>{
          const result=await(await request('reveal-key',{},signal)).json();
          if(!signal.aborted){setKey(result.key);setRevealed(true);}
        });
      }
      const [error,setError]=useState('');
      const [busy,setBusy]=useState(()=>job.controller?job.label:'');
      const [preview,setPreview]=useState('');
      const [viewer,setViewer]=useState(null);
      useEffect(()=>{
        if(!viewer)return;
        const onKey=event=>{if(event.key==='Escape')setViewer(null);};
        window.addEventListener('keydown',onKey);
        return()=>window.removeEventListener('keydown',onKey);
      },[viewer]);
      latestProject=project;
      const [hydrated,setHydrated]=useState(Boolean(workspaceSnapshot));
      const surface=useRef(null);
      const scroll=useRef(seed?.scroll??0);
      const needsScroll=useRef(true);
      function applySnapshot(saved){
        const normalized=normalizeProject(saved?.project);
        if(!normalized)return;
        setProject(normalized);
        setActive(Math.min(saved.active??0,Math.max(0,normalized.pages.length-1)));
        setPicker(saved.picker??null);setView(saved.view??'create');setGalleryKind(saved.galleryKind??'style');
        setFocused(saved.focused??null);setGroup(saved.group??'');setCount(saved.count??0);setScenario(saved.scenario??'');setArticleDraft(saved.articleDraft??'');setAttachments(saved.attachments??normalized.attachments??[]);setInspector(saved.inspector??'picture');
        setThemeDraft(saved.themeDraft??null);setFilter(saved.filter??'');setLimit(Math.max(galleryPageSize,saved.limit??0));
        scroll.current=saved.scroll??0;
        needsScroll.current=true;
      }
      useEffect(()=>{
        if(workspaceSnapshot){setHydrated(true);return;}
        let live=true;
        const timer=setTimeout(()=>{if(live)setHydrated(true);},1500);
        (async()=>{
          let saved;
          try { saved=await projectStore('get',undefined,'workspace'); }
          catch { databaseUsable=false; }
          if(!live)return;
          clearTimeout(timer);
          const baseline=workspaceSnapshot?.savedAt??seed?.savedAt??-1;
          if(saved?.project?.pages?.length){
            const images=new Map(saved.project.pages.map(page=>[page.id,page.image]));
            const savedPages=new Map(saved.project.pages.map(page=>[page.id,page]));
            if((saved.savedAt??0)>=baseline){
              // 本机存档含成图；localStorage 版本只有文字，缺图时按页补齐。
              applySnapshot({ ...saved, project:{ ...saved.project, pages:saved.project.pages.map(page=>({ ...page, image:page.image||images.get(page.id)||'' })) } });
            }else{
              const savedFiles=new Map((saved.attachments??[]).map(file=>[file.id,file]));
              const restore=(files,index=savedFiles)=>files?.map(file=>file.kind==='image'&&!file.data?(index.get(file.id)||file):file);
              setAttachments(current=>restore(current)||[]);
              setProject(current=>({ ...current, attachments:restore(current.attachments), pages:current.pages.map(page=>({ ...page, image:page.image||images.get(page.id)||'', upload:page.upload===''?savedPages.get(page.id)?.upload:page.upload, uploads:restore(page.uploads,new Map((savedPages.get(page.id)?.uploads||[]).map(file=>[file.id,file]))) })) }));
            }
          }
          setHydrated(true);
        })();
        return()=>{live=false;clearTimeout(timer);};
      },[]);
      useLayoutEffect(()=>{
        if(!hydrated)return;
        remember({project,active,picker,view,galleryKind,focused,group,count,scenario,articleDraft,attachments,inspector,themeDraft,filter,limit,scroll:scroll.current});
      },[hydrated,project,active,picker,view,galleryKind,focused,group,count,scenario,articleDraft,attachments,inspector,themeDraft,filter,limit]);
      useLayoutEffect(()=>{
        if(!hydrated||!needsScroll.current||!surface.current||(view==='gallery'&&!lists[galleryKind]))return;
        needsScroll.current=false;
        surface.current.scrollTop=scroll.current;
      },[hydrated,view,galleryKind,lists]);
      useEffect(()=>{
        const saveScroll=()=>{
          if(!workspaceSnapshot)return;
          if(workspaceSnapshot.scroll===scroll.current)writeLocal(workspaceSnapshot);
          else remember({ ...workspaceSnapshot, scroll:scroll.current });
        };
        const hide=()=>{if(document.visibilityState==='hidden')saveScroll();};
        window.addEventListener('pagehide',saveScroll);
        document.addEventListener('visibilitychange',hide);
        return()=>{
          window.removeEventListener('pagehide',saveScroll);
          document.removeEventListener('visibilitychange',hide);
          saveScroll();
          flushWorkspace();
        };
      },[]);
      useEffect(()=>{
        const settle=()=>{
          setBusy('');
          if(job.error)setError(job.error);
          if(workspaceSnapshot?.project)setProject(workspaceSnapshot.project);
        };
        job.listeners.add(settle);
        if(job.controller)setBusy(job.label);
        return()=>{job.listeners.delete(settle);};
      },[]);
      const page=project.pages[active]||project.pages[0];
      const refs=selectedAssets(project,page);
      const decorate=(target,i)=>{
        const picks=selectedAssets(project,target);
        return {...target,accent:lists.color?.find(x=>x.id===picks.color)?.hex,layoutShape:picks.layout==='SC-008'?'bottom':undefined};
      };
      const visual=kind=>refs[kind]&&(lists[kind==='style2'?'style':kind]||[]).find(x=>x.id===refs[kind]);
      const update=(patch)=>setProject(p=>({...p,...patch}));
      const patchPage=(id,patch)=>setProject(p=>({...p,pages:p.pages.map(x=>x.id===id?{...x,...patch}:x)}));
      const edit=(patch)=>patchPage(page.id,patch);
      const refreshProjects=()=>projectStore('getAll').then(setProjects);
      useEffect(()=>{
        const controller=new AbortController();
        (async()=>{
          const value=await (await request('settings',undefined,controller.signal)).json();setSettings(value);
        })().catch(e=>{if(!controller.signal.aborted)setError(e.message);});
        for(const kind of Object.keys(catalogs)) request('catalog?kind='+kind,undefined,controller.signal).then(r=>r.json())
          .then(data=>setLists(prev=>({...prev,[kind]:data})))
          .catch(e=>{if(!controller.signal.aborted)setLists(prev=>({...prev,[kind]:[],[kind+'Error']:e.message}));});
        request('tones',undefined,controller.signal).then(r=>r.json()).then(tones=>setLists(prev=>({...prev,tones}))).catch(()=>{});
        refreshProjects().catch(e=>setError(e.message));
        return()=>{controller.abort();};
      },[]);
      useEffect(()=>{
        let stopped=false,url='';
        setPreview('');
        if(page.image && !isGif(page)) renderPng(project,decorate(page,active),active).then(blob=>{
          if(!stopped){url=URL.createObjectURL(blob);setPreview(url);}
        }).catch(e=>{if(!stopped)setError(e.message);});
        return()=>{stopped=true;if(url)URL.revokeObjectURL(url);};
      },[page,project.platform,project.pages.length,project.visual,lists,active]);
      function action(label,fn){
        if(job.controller)return;
        job.error='';setBusy(label);setError('');
        startJob(label,fn);
      }
      function promptInput(target,index){
        const picks=selectedAssets(project,target);
        const {w,h,hasText}=getFrame(project,decorate({...target,image:''},index));
        const refs=Object.fromEntries(['pose','clothes','face','style','style2'].filter(k=>lists[k==='style2'?'style':k]?.some(x=>x.id===picks[k])).map(k=>[k,picks[k]]));
        const ratio=readRatio(target.direction?.ratio||project.ratio);
        const design={...target.direction,ratio:ratio.length?ratio.join(':'):undefined,theme:project.theme,brief:target.sceneText??target.brief,sourceText:project.manualAttachments?(project.attachments||[]).filter(x=>x.kind==='text').map(x=>x.text).join('\n\n'):undefined,copy:target.sceneText===undefined?[target.title,target.body].filter(Boolean).join('\n'):undefined,
          layout:picks.layout,color:picks.color,mode:target.promptMode??(['single','scene'].includes(target.role)?'pure-image':'graphic-text'),
          localText:hasText,variant:target.layoutVariant,redraw:target.redraw,
          explicitStyle:Boolean(target.refs.style||target.refs.style2||project.visual.styleExplicit)};
        return {prompt:project.theme,design,refs,depth:target.depth,size:w>h?'1536x1024':w===h?'1024x1024':'1024x1536',quality:'medium'};
      }
      async function generate(target,index,signal){
        if(target.locked||signal.aborted)return;
        const input={...promptInput(target,index),page:index+1,outputFormat:project.outputFormat||'png',
          ...(project.outputFormat==='gif'?{frameCount:project.frameCount||9,frameDurationMs:project.frameDurationMs||200}:{})};
        if(target.upload)input.refs.upload=target.upload;
        const attachedImages=[...(project.attachments||[]),...(target.uploads||[])].filter(x=>x.kind==='image'&&x.data).map(x=>x.data);
        if(attachedImages.length)input.refs.attachments=attachedImages;
        if(project.anchor&&project.anchor!==target.image&&project.anchor.length<=11_184_850)input.refs.anchor=project.anchor;
        const response=await request('generate',input,signal);
        const savedPath=decodeURIComponent(response.headers.get('X-Pose-Studio-Saved-Path')||'');
        const saveError=decodeURIComponent(response.headers.get('X-Pose-Studio-Save-Error')||'');
        const blob=await response.blob();
        const image=await imageData(blob);
        const base=latestProject??project;
        const next={...base,pages:base.pages.map(x=>x.id===target.id?{...x,image,savedPath,saveError,nativeLayout:!input.design.localText}:x)};
        latestProject=next;
        // 先把成图记进模块快照，切走面板或重新挂载都不会丢这一页。
        rememberProject(next);
        setProject(next);
        // 单张完成即可展示，同时避免旧快照的异步写入覆盖新结果。
        saveQueue=saveQueue.catch(()=>{}).then(()=>projectStore('put',next));
        await saveQueue;
      }
      async function batch(targets,signal){
        const failures=[];
        let cursor=0,completed=0;
        const workers=Array.from({length:Math.min(4,targets.length)},async()=>{
          while(!signal.aborted && cursor<targets.length){
            const [i,x]=targets[cursor++];
            try { await generate(x,i,signal); }
            catch(e){if(!signal.aborted)failures.push('第 '+(i+1)+' 页 '+e.message);}
            completed++;
            if(!signal.aborted)setBusy('正在生成批量任务 · 已完成 '+completed+'/'+targets.length+' 页');
          }
        });
        await Promise.all(workers);
        await refreshProjects();
        if(failures.length)throw new Error(failures.join(' ｜ '));
      }
      function move(direction){
        const next=active+direction;
        if(next<0||next>=project.pages.length)return;
        const pages=[...project.pages];
        [pages[active],pages[next]]=[pages[next],pages[active]];
        update({pages});setActive(next);
      }
      function openPicker(kind,global=false){
        setPicker({kind,global});setGalleryKind(kind==='style2'?'style':kind);
        setFilter('');setGroup('');setLimit(galleryPageSize);setFocused(null);setView('gallery');
      }
      function browseGallery(){
        setPicker(null);setFocused(null);setGroup('');setFilter('');setLimit(galleryPageSize);setView('gallery');
      }
      async function planTheme(signal){
        const textFiles=attachments.filter(x=>x.kind==='text');
        const article=scenario==='article'?(articleDraft.trim()||textFiles.map(x=>x.text).join('\n\n')):undefined;
        const theme=(themeDraft??project.theme).trim()||(article?.split('\n').find(line=>line.trim())||attachments[0]?.name||'').replace(/^#+\s*/, '').slice(0,120);
        const plan=await (await request('plan',{theme,count,scenario,article,attachments:attachments.length?attachments.map(({name,kind,text})=>({name,kind,text})):undefined},signal)).json();
        const mode=Object.hasOwn(modes,plan.mode)?plan.mode:(plan.pages.length===1?'single':'carousel');
        const platform=Object.hasOwn(platforms,plan.platform)?plan.platform:modes[mode][1];
        const next={...project,theme,mode,platform,article,attachments,manualAttachments:false,concept:plan.concept||'已按主题规划画面与参考素材。',anchor:'',
          plannerModel:typeof plan.planner==='string'?plan.planner:undefined,
          visual:{style:plan.style,color:plan.color},
          pages:plan.pages.map(x=>({...blankPage(x.role,x.title,x.body),brief:x.brief,placement:x.placement,format:article?(x.role==='cover'?'wx':'article'):undefined,people:x.people,refs:{layout:x.layout,pose:x.pose,face:x.face,clothes:x.clothes}}))};
        if(signal.aborted)return;
        latestProject=next;
        rememberProject(next);
        setProject(next);setThemeDraft(null);setActive(0);setInspector('picture');setView('create');
        await projectStore('put',next);await refreshProjects();
      }
      function selectAsset(id){
        const {kind,global}=picker;
        if(global)update({visual:{...project.visual,[kind]:id,...(['style','style2'].includes(kind)?{styleExplicit:Boolean(id)}:{})}});
        else edit({refs:{...page.refs,[kind]:id}});
        setPicker(null);setView('create');
      }
      function applyGalleryAsset(id){
        if(picker){selectAsset(id);return;}
        if(page.locked||busy)return;
        if(!project.theme.trim()&&!(themeDraft||'').trim()){setError('请先在创作页填写主题，再应用素材。');return;}
        if(!project.concept&&!page.brief&&!page.image)update({concept:'手动组合素材。',theme:(themeDraft??project.theme).trim()});
        setError('');
        edit({refs:{...page.refs,[galleryKind]:id}});setView('create');
      }
      const labelFor=kind=>kind==='style2'?'场景画风':catalogs[kind];
      const choices=(label,values,value,change)=>h('div',{className:'line',role:'group','aria-label':label},
        Object.entries(values).map(([id,name])=>Button(Array.isArray(name)?name[0]:name,()=>change(id),{key:id,'aria-pressed':String(value)===id})));
      const items=lists[galleryKind]||[];
      const query=filter.trim().toLowerCase();
      const matches=x=>(x.id+' '+x.name+' '+x.group).toLowerCase().includes(query);
      const poseGroups=new Map();
      if(galleryKind==='pose')for(const item of items){
        const id=item.poseGroup||item.id.replace(/_(front|back|side|diag|high|low)$/,'');
        if(!poseGroups.has(id))poseGroups.set(id,[]);
        poseGroups.get(id).push(item);
      }
      const searchable=galleryKind==='pose'?[...poseGroups].filter(([,angles])=>angles.some(matches)).map(([id,angles])=>{
        const preferred=poseAngles[id]||(!picker||picker.kind==='pose'?refs.pose:undefined);
        const selected=angles.find(x=>x.id===preferred)||(query?angles.find(matches):undefined)||angles.find(x=>x.angle==='正面'||x.id.endsWith('_front'))||angles[0];
        return {...selected,cardId:id,angles};
      }):items.filter(matches);
      const available=searchable.filter(x=>!group||x.group===group);
      const groupCounts={};
      for(const item of searchable)if(item.group)groupCounts[item.group]=(groupCounts[item.group]||0)+1;
      const filteredGroups=Object.fromEntries(Object.entries(groupCounts).map(([id,n])=>[id,(groups[id]||id)+' '+n]));
      const galleryView=h('section',{className:'shell stack'},
        h('div',{className:'intro'},h('small',null,'素材图鉴'),h('h2',null,picker?'选择'+labelFor(picker.kind):'浏览素材'),
          h('p',null,picker?(picker.global?'应用到整套方案':'应用到第 '+(active+1)+' 页'):'按图挑选画风、版式、配色、姿势、服装和人像。')),
        !picker&&choices('素材类型',catalogs,galleryKind,k=>{setGalleryKind(k);setFocused(null);setFilter('');setGroup('');setLimit(galleryPageSize);}),
        h('div',{className:'line spread'},h('input',{type:'search',value:filter,placeholder:'搜编号或名称','aria-label':'搜索素材',
          onChange:e=>{setFilter(e.target.value);setGroup('');setLimit(galleryPageSize);setFocused(null);}}),
          h('div',{className:'line'},
            Button('随机推荐',()=>{
              const choices=available.filter(x=>x.id!==focused?.id);
              setFocused((choices.length?choices:available)[Math.floor(Math.random()*(choices.length||available.length))]);
            },{disabled:!available.length||!!busy}),
            picker&&!picker.global&&Button('沿用整套设置',()=>selectAsset(undefined)),
            picker&&Button('不使用',()=>selectAsset(null)))),
        choices('素材分类',{'':'全部 '+searchable.length,...filteredGroups},group,k=>{setGroup(k);setLimit(galleryPageSize);setFocused(null);}),
        lists[galleryKind+'Error']&&h('p',{className:'error'},lists[galleryKind+'Error']),
        !lists[galleryKind]?h('p',null,'正在加载图鉴…'):!available.length&&h('p',null,'没有找到匹配的素材。'),
        h('div',{className:'tiles gallery-grid'+(galleryKind==='pose'?' pose-gallery':'')},available.slice(0,limit).map(x=>h('div',{key:x.cardId||x.id,className:'gallery-item'},Button([
          h('img',{key:'image',loading:'lazy',src:thumb(galleryKind,x),alt:''}),
          h('strong',{key:'name'},x.poseName||x.name),h('small',{key:'id'},x.angle||x.id)
        ],()=>applyGalleryAsset(x.id),{title:x.name,className:x.angles?'pose-main':undefined,'aria-label':x.angles?'选用 '+x.name:undefined,disabled:!!busy||(!picker&&page.locked)}),
          Button('⤢',()=>setFocused(x),{className:'zoom-asset',title:'放大 '+x.name,'aria-label':'放大 '+x.name}),
          x.angles&&h('div',{className:'pose-angles',role:'group','aria-label':(x.poseName||x.name)+' 的角度'},x.angles.map(angle=>
            Button(h('img',{src:thumb('pose',angle),alt:'',loading:'lazy'}),()=>setPoseAngles(prev=>({...prev,[x.cardId]:angle.id})),
              {key:angle.id,title:angle.angle||angle.name,'aria-label':angle.angle||angle.name,'aria-pressed':angle.id===x.id})))))),
        available.length>limit&&Button('再显示 '+galleryPageSize+' 项',()=>setLimit(n=>n+galleryPageSize)),
        focused&&h('div',{className:'box detail stack',role:'region','aria-label':'素材大图预览',ref:element=>{
          if(element&&element.dataset.focused!==focused.id){element.dataset.focused=focused.id;element.focus();}
        },onKeyDown:e=>{if(e.key==='Escape')setFocused(null);},tabIndex:-1},
          h('div',{className:'line spread'},h('h2',null,focused.name),Button('关闭预览',()=>setFocused(null))),
          h('img',{src:thumb(galleryKind,focused,false,true),alt:focused.name}),
          h('small',null,focused.id),focused.prompt&&h('p',null,focused.prompt),
          Button('使用这张图',()=>applyGalleryAsset(focused.id),{className:'primary',disabled:!!busy||(!picker&&page.locked)})));
      const canGenerate=!busy&&!page.locked&&!!project.theme.trim();
      const remaining=project.pages.map((x,i)=>[i,x]).filter(([,x])=>!x.image&&!x.locked);
      const direction=page.direction||{};
      const setDirection=(key,value)=>edit({direction:{...direction,[key]:value}});
      const directionField=(key,label,placeholder)=>h('label',{className:'field'},label,
        h('input',{value:direction[key]||'',maxLength:240,placeholder,onChange:e=>setDirection(key,e.target.value)}));
      const moodOptions=['治愈','童趣','松弛','幽默','诗意','浪漫','活力','微丧','孤寂','紧张','庄严','荒诞','恐怖','神秘','激烈'];
      const creativeDirection=h('div',null,
        h('fieldset',{className:'stack extras',disabled:!!busy||page.locked},
          h('strong',null,'留白'),choices('留白',{auto:'按图型',moderate:'大量留白',high:'仅保留必要场景'},direction.whitespace||'auto',v=>setDirection('whitespace',v)),
          directionField('mood','情绪','例如：治愈、松弛'),
          h('div',{className:'line',role:'group','aria-label':'情绪快捷选项'},moodOptions.map(mood=>{
            const values=(direction.mood||'').split(/[、，,]/).map(x=>x.trim()).filter(Boolean);
            return Button(mood,()=>setDirection('mood',(values.includes(mood)?values.filter(x=>x!==mood):[...values,mood]).join('、')),{key:mood,'aria-pressed':values.includes(mood)});
          })),
          directionField('audience','受众','例如：年轻都市白领'),
          directionField('scenario','业务场景','例如：新品海报、节日封面'),
          h('strong',null,'影调'),choices('影调',{'':'自动',...Object.fromEntries((lists.tones||[]).map(x=>[x.id,x.name_zh]))},direction.tone||'',v=>setDirection('tone',v))));
      const [promptPreview,setPromptPreview]=useState(null);
      const [copiedPrompt,setCopiedPrompt]=useState(null);
      async function copyPrompt(){
        try {
          if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(promptPreview.zh);
          else {
            const text=document.createElement('textarea');
            text.value=promptPreview.zh;text.style.position='fixed';text.style.opacity='0';
            document.body.append(text);
            try {text.select();if(!document.execCommand('copy'))throw new Error();}
            finally{text.remove();}
          }
          setCopiedPrompt(previewKey);
        }catch{setError('复制失败，可以选中提示词后手动复制。');}
      }
      const previewInput=promptInput(page,active);
      if(page.upload)previewInput.refs.upload=true;
      if([...(project.attachments||[]),...(page.uploads||[])].some(x=>x.kind==='image'&&x.data))previewInput.refs.attachments=true;
      if(project.anchor&&project.anchor!==page.image&&project.anchor.length<=11_184_850)previewInput.refs.anchor=true;
      const previewKey=JSON.stringify([previewInput,settings?.model]);
      useEffect(()=>{
        if(!hydrated||view!=='create'||inspector!=='prompt'||!project.theme.trim())return;
        const controller=new AbortController();
        const [input]=JSON.parse(previewKey);
        request('prompt',input,controller.signal).then(response=>response.json()).then(value=>{
          if(!controller.signal.aborted){setPromptPreview({key:previewKey,...value});setCopiedPrompt(null);}
        }).catch(error=>{
          if(!controller.signal.aborted)setPromptPreview({key:previewKey,error:error.message});
        });
        return()=>controller.abort();
      },[hydrated,view,inspector,previewKey,project.theme]);

      const generateOne=()=>settings?.configured?action('正在生成当前页',signal=>generate(page,active,signal)):setOpenSettings(true);
      const exportPage=()=>action('导出本页',async()=>{
        const gif=isGif(page);
        download(gif?await(await fetch(page.image)).blob():await renderPng(project,decorate(page,active),active),
          'page-'+String(active+1).padStart(2,'0')+(gif?'.gif':'.png'));
      });
      const [copiedImage,setCopiedImage]=useState(false);
      const copyImage=()=>{
        if(!page.image)return;
        action('正在复制图片',async()=>{
          if(isGif(page))throw new Error('GIF 动画请使用下载 GIF；剪贴板不支持保留动画。');
          if(!navigator.clipboard?.write||typeof ClipboardItem==='undefined')throw new Error('当前环境不支持复制图片，请改用「下载 PNG」。');
          const blob=await renderPng(project,decorate(page,active),active);
          try {
            await navigator.clipboard.write([new ClipboardItem({'image/png':blob})]);
          } catch (error) {
            throw new Error(/denied|permission|notallowed/i.test(error?.name||error?.message||'')
              ? '浏览器拒绝了剪贴板权限，请允许后重试，或改用「下载 PNG」。'
              : '复制失败，请改用「下载 PNG」。');
          }
          setCopiedImage(true);
          setTimeout(()=>setCopiedImage(false),1800);
        });
      };
      const exportAll=()=>action('导出整套',async()=>{
        const files=[];
        for(const [i,x] of project.pages.entries()){
          const gif=isGif(x);
          files.push({name:String(i+1).padStart(2,'0')+'-'+roles[x.role][0].replaceAll('/','-')+(gif?'.gif':'.png'),
            blob:gif?await(await fetch(x.image)).blob():await renderPng(project,decorate(x,i),i)});
        }
        download(await zip(files),'pose-studio-'+project.platform+'.zip');
      });
      const assetCard=(kind,global=false)=>{
        const cat=kind==='style2'?'style':kind;
        const item=global?(lists[cat]||[]).find(x=>x.id===project.visual[kind]):visual(kind);
        const id=global?project.visual[kind]:refs[kind];
        return Button([
          item?h('img',{key:'image',src:thumb(cat,item,kind==='pose'&&page.depth),alt:''}):h('span',{key:'empty',className:'asset-empty'},'+'),
          h('strong',{key:'label'},labelFor(kind)),h('small',{key:'name'},item?item.name:id?'加载素材…':'选择素材')
        ],()=>openPicker(kind,global),{key:kind,className:'asset-card',disabled:!!busy||(!global&&page.locked)});
      };
      const sharedImages=(project.attachments||[]).filter(file=>file.kind==='image'&&file.data);
      const localImages=(page.uploads||[]).filter(file=>file.data);
      const referenceTile=(file,remove)=>h('div',{key:file.id,className:'asset-card upload-card'},
        h('img',{src:file.data,alt:file.name}),h('small',{title:file.name},file.name),
        remove&&Button('移除',remove,{disabled:!!busy||page.locked,'aria-label':'移除 '+file.name}));
      async function addLocalImages(selected){
        const files=Array.from(selected||[]);
        if(!files.length||busy||page.locked)return;
        action('读取参考图',async signal=>{
          const next=[...localImages];
          let bytes=[...sharedImages,...next].reduce((n,file)=>n+file.size,0);
          const errors=[];
          for(const file of files){
            if(signal.aborted)return;
            if(!['image/png','image/jpeg','image/webp'].includes(file.type)||!file.size||file.size>8*1024*1024){
              errors.push(file.name+'：请选择 8 MB 内的 PNG、JPG 或 WebP');continue;
            }
            if(sharedImages.length+next.length>=8||bytes+file.size>12*1024*1024){
              errors.push(file.name+'：与首页参考图合计最多 8 张、12 MB');continue;
            }
            try{
              const data=await imageData(file);
              next.push({id:crypto.randomUUID(),kind:'image',name:file.name,data,size:file.size});
              bytes+=file.size;
            }catch{errors.push(file.name+'：读取失败');}
          }
          if(signal.aborted)return;
          const base=latestProject??project;
          const updated={...base,pages:base.pages.map(x=>x.id===page.id?{...x,uploads:next}:x)};
          latestProject=updated;rememberProject(updated);setProject(updated);
          if(errors.length)setError(errors.join('；'));
        });
      }
      const uploadCard=h('div',{className:'stack'},
        sharedImages.length>0&&h('div',{className:'stack'},h('strong',null,'首页上传 · 整套共用'),
          h('div',{className:'reference-grid'},sharedImages.map(file=>referenceTile(file)))),
        h('strong',null,'自选参考图 · 仅这张'),
        h('div',{className:'box stack',tabIndex:busy||page.locked?-1:0,'aria-label':'粘贴参考图片',onPaste:e=>{
          const images=Array.from(e.clipboardData.files||[]).filter(file=>file.type.startsWith('image/'));
          if(!images.length||busy||page.locked)return;
          e.preventDefault();addLocalImages(images);
        }},
          h('label',{className:'field'},'选择图片（可多选）',
            h('input',{type:'file',multiple:true,key:page.id,accept:'image/png,image/jpeg,image/webp',disabled:!!busy||page.locked,onChange:e=>{
              const files=Array.from(e.currentTarget.files||[]);e.currentTarget.value='';addLocalImages(files);
            }})),
          h('small',null,'也可点击此区域，然后按 Ctrl+V 粘贴图片。')),
        h('div',{className:'reference-grid'},
          page.upload&&referenceTile({id:'legacy',data:page.upload,name:'原有参考图'},()=>edit({upload:undefined})),
          localImages.map(file=>referenceTile(file,()=>edit({uploads:(page.uploads||[]).filter(x=>x.id!==file.id)})))));
      const renderSettings=()=>h('section',{className:'shell box stack settings-panel'},
        h('div',{className:'line spread'},h('h2',null,'设置'),Button('关闭',closeSettings,{disabled:!!busy})),
        h('small',null,'生成方案使用 DSH 宿主的默认模型，无需在此填写；这里的接口只用于生图和参考图编辑。'),
        h('label',{className:'field'},'Base URL',h('input',{value:baseUrl??settings?.endpoint??'',placeholder:'http://127.0.0.1:38650/v1',onChange:e=>setBaseUrl(e.target.value)})),
        h('small',null,'本机可用 HTTP，远程中转站请用 HTTPS。'),
        h('label',{className:'field'},'GPT Image 模型',h('input',{value:settings?.model||'',onChange:e=>setSettings({...settings,model:e.target.value})})),
        h('label',{className:'field'},'API Key',h('input',{value:key,type:revealed?'text':'password',autoComplete:'off',spellCheck:false,placeholder:settings?.configured?'留空保留现有 Key':'输入 API Key',onChange:e=>setKey(e.target.value)})),
        h('div',{className:'field'},h('strong',null,'生成图片保存目录'),
          h('div',{className:'line'},Button('选择文件夹…',()=>chooseOutputDirectory(),{disabled:!!busy}),
            (outputPath??settings?.outputDirectory)&&Button('关闭自动保存',()=>setOutputPath(''),{disabled:!!busy})),
          h('p',{style:{overflowWrap:'anywhere'}},(outputPath??settings?.outputDirectory)||'尚未选择文件夹'),
          h('small',null,'选择后点击保存设置。PNG / GIF 原图将自动保存到运行 DSH 的电脑。')),
        directoryListing&&h('div',{className:'box stack',role:'region','aria-label':'选择保存文件夹'},
          h('div',{className:'line spread'},h('h2',null,'选择保存文件夹'),Button('取消',()=>setDirectoryListing(null),{disabled:!!busy})),
          h('div',{className:'line'},directoryListing.crumbs.map(crumb=>Button(crumb.name,()=>chooseOutputDirectory('list',crumb.path),{key:crumb.path,disabled:!!busy}))),
          h('div',{style:{maxHeight:260,overflow:'auto'},className:'stack'},
            directoryListing.entries.filter(entry=>showHiddenFolders||!entry.hidden).map(entry=>Button('📁 '+entry.name,()=>chooseOutputDirectory('list',entry.path),{key:entry.path,disabled:!!busy})),
            !directoryListing.entries.some(entry=>showHiddenFolders||!entry.hidden)&&h('small',null,'这个目录中没有可显示的子文件夹。')),
          directoryListing.truncated&&h('small',null,'子文件夹较多，当前列表已截取。'),
          h('label',null,h('input',{type:'checkbox',checked:showHiddenFolders,onChange:e=>setShowHiddenFolders(e.target.checked)}),' 显示隐藏文件夹'),
          h('div',{className:'line'},h('input',{'aria-label':'新文件夹名称',placeholder:'新文件夹名称',value:folderName,onChange:e=>setFolderName(e.target.value),disabled:!!busy}),
            Button('新建文件夹',()=>chooseOutputDirectory('create',directoryListing.path,folderName),{disabled:!!busy||!folderName.trim()})),
          Button('使用此文件夹',()=>{setOutputPath(directoryListing.path);setDirectoryListing(null);},{className:'primary',disabled:!!busy})),
        h('div',{className:'line'},Button(revealed?'隐藏密钥':'查看明文',toggleKey,{disabled:!!busy,'aria-pressed':revealed}),
          Button('保存设置',()=>action('保存设置',async signal=>{const result=await(await request('settings',{key,model:settings.model,baseUrl:baseUrl??undefined,outputDirectory:outputPath??undefined},signal)).json();setSettings(result);closeSettings();}),{className:'primary',disabled:!settings||!!busy||!!directoryListing})));
      const presets={
        '':['自动判断',0,'一句话描述你想做的内容'],single:['单张插画',1,'例如：画一张窗台晒太阳的猫'],
        carousel:['社媒套图',6,'例如：做一套小红书雨天街拍姿势指南'],poster:['封面海报',1,'例如：给咖啡店开业做一张竖版海报'],
        knowledge:['知识卡',3,'例如：给孩子讲月相变化'],article:['文章配图',3,'例如：给一篇城市漫步文章配图'],
        shop:['商品图',3,'例如：为陶瓷杯做主图、场景图与卖点图'],photo:['写真组照',3,'例如：一套复古港风街拍'],
        ip:['角色设计',3,'例如：设计一只开书店的狐狸角色'],
      };
      const attachmentInput=useRef(null);
      const attachmentMenu=useRef(null);
      const [attachmentMenuOpen,setAttachmentMenuOpen]=useState(false);
      useEffect(()=>{
        if(!attachmentMenuOpen)return;
        const close=e=>{if(!attachmentMenu.current?.contains(e.target))setAttachmentMenuOpen(false);};
        document.addEventListener('pointerdown',close);
        return()=>document.removeEventListener('pointerdown',close);
      },[attachmentMenuOpen]);
      async function addAttachments(selected){
        const files=Array.from(selected||[]);
        if(!files.length)return;
        action('读取附件',async signal=>{
          const next=[...attachments];
          let imageBytes=next.filter(x=>x.kind==='image').reduce((n,x)=>n+x.size,0);
          let textLength=next.filter(x=>x.kind==='text').reduce((n,x)=>n+x.text.length,0);
          const skipped=[];
          for(const file of files){
            if(signal.aborted)return;
            const name=file.name.slice(0,180),ext=name.split('.').at(-1).toLowerCase();
            try{
              if(next.length>=8)throw new Error('最多 8 个附件');
              if(['png','jpg','jpeg','webp','gif','bmp','avif'].includes(ext)){
                if(!file.size||file.size>8*1024*1024)throw new Error('单张图片最多 8 MB');
                let data=await imageData(file);
                if(!/^data:image\/(png|jpeg|webp);base64,/.test(data)){
                  const img=await loadImage(data),canvas=document.createElement('canvas');
                  const scale=Math.min(1,2048/Math.max(img.width,img.height));
                  canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));
                  canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
                  data=canvas.toDataURL('image/webp',.9);
                }
                const size=Math.ceil((data.length-data.indexOf(',')-1)*.75);
                if(size>8*1024*1024||imageBytes+size>12*1024*1024)throw new Error('图片合计最多 12 MB');
                next.push({id:crypto.randomUUID(),name,kind:'image',data,size});imageBytes+=size;
              }else if(['txt','md','markdown','srt','vtt','ass','ssa','csv','json','log','lrc','sbv','tsv'].includes(ext)){
                if(file.size>80000)throw new Error('文本文件过大');
                const text=(await file.text()).trim();
                if(!text||textLength+text.length>12000)throw new Error('文本为空或附件正文合计超过 12,000 字');
                next.push({id:crypto.randomUUID(),name,kind:'text',text});textLength+=text.length;
              }else throw new Error('格式暂不支持');
            }catch(error){skipped.push(name+'：'+error.message);}
          }
          if(signal.aborted)return;
          setAttachments(next);
          if(skipped.length)setError(skipped.join('；'));
        });
      }
      const articleMode=scenario==='article';
      const validCount=Number.isInteger(count)&&count>=0&&count<=12&&(!articleMode||count!==1);
      const canPlan=validCount&&(articleMode?(articleDraft.trim().length>0||attachments.some(x=>x.kind==='text')):(!!(themeDraft??project.theme).trim()||attachments.length>0));
      const startView=h('section',{className:'shell stack studio-start'},
        h('div',{className:'intro'},h('small',null,'创作工作台'),h('h2',null,'今天想画什么？'),
          h('p',null,'用一句话开始。先看方案，再决定试出一张还是生成整套。')),
        h('fieldset',{className:'box stack',disabled:!!busy},
          h('div',{className:'scenario-grid','aria-label':'创作场景',role:'group'},Object.entries(presets).map(([id,[label,presetCount]])=>
            Button(label,()=>{setScenario(id);setCount(presetCount);},{key:id,'aria-pressed':scenario===id}))),
          h('div',{className:'composer',onDragOver:e=>{
            if(Array.from(e.dataTransfer.types).includes('Files'))e.preventDefault();
          },onDrop:e=>{
            if(!e.dataTransfer.files.length)return;
            e.preventDefault();if(!busy)addAttachments(e.dataTransfer.files);
          }},
            attachments.length>0&&h('div',{className:'composer-files','aria-label':'已添加的附件'},attachments.map(file=>
              h('div',{key:file.id,className:'composer-file',title:file.name},
                file.kind==='image'&&file.data?h('img',{src:file.data,alt:''}):
                  h('span',{className:'file-glyph','aria-hidden':true},'▤'),
                h('span',{className:'composer-file-name'},file.name),
                Button('×',()=>setAttachments(current=>current.filter(x=>x.id!==file.id)),{'aria-label':'移除 '+file.name,title:'移除 '+file.name})))),
            h('textarea',{value:themeDraft??project.theme,maxLength:1000,'aria-label':'创作主题',placeholder:(presets[scenario]||presets[''])[2],
              onChange:e=>setThemeDraft(e.target.value),onPaste:e=>{
                const files=Array.from(e.clipboardData.files||[]);
                if(files.length){e.preventDefault();if(!busy)addAttachments(files);}
              }}),
            h('div',{className:'composer-toolbar'},
              h('div',{className:'attachment-trigger',ref:attachmentMenu,onKeyDown:e=>{
                if(e.key==='Escape'&&attachmentMenuOpen){setAttachmentMenuOpen(false);e.currentTarget.querySelector('button')?.focus();}
              }},
                Button('+',()=>setAttachmentMenuOpen(open=>!open),{className:'composer-plus','aria-label':'添加附件',title:'添加附件','aria-expanded':attachmentMenuOpen,disabled:attachments.length>=8}),
                attachmentMenuOpen&&h('div',{className:'attachment-popover'},Button('添加图片或文件',()=>{
                  setAttachmentMenuOpen(false);attachmentInput.current?.click();
                },{autoFocus:true})),
                h('input',{ref:attachmentInput,hidden:true,type:'file',multiple:true,
                  accept:'.png,.jpg,.jpeg,.webp,.gif,.bmp,.avif,.txt,.md,.markdown,.srt,.vtt,.ass,.ssa,.csv,.json,.log,.lrc,.sbv,.tsv',
                  onChange:e=>{const files=Array.from(e.currentTarget.files||[]);e.currentTarget.value='';addAttachments(files);}})),
              attachments.length>0&&h('small',{className:'muted'},attachments.length+' / 8'))),
          articleMode&&h('div',{className:'stack'},
            h('label',{className:'field'},'导入文章（.md / .txt）',h('input',{type:'file',accept:'.md,.markdown,.txt',onChange:async e=>{
              const file=e.target.files?.[0];e.target.value='';if(!file)return;
              try{if(file.size>180000)throw new Error('文章文件过大，请导入 30,000 字以内的 UTF-8 文本。');
                const content=await file.text();
                if(content.length>30000)throw new Error('文章最多 30,000 字。');
                setArticleDraft(content);setError('');
              }catch(error){setError(error.message);}
            }})),
            h('label',{className:'field'},'文章正文',h('textarea',{value:articleDraft,maxLength:30000,placeholder:'也可以直接粘贴正文。第一张是封面，其余为正文插图。',onChange:e=>setArticleDraft(e.target.value)}))),
          !(themeDraft??project.theme).trim()&&h('div',{className:'line'},h('small',null,'试试这些主题'),
            ...['雨天街拍姿势指南','复古咖啡店开业海报','给孩子看的月亮科普卡'].map(theme=>Button(theme,()=>setThemeDraft(theme),{key:theme}))),
          h('label',{className:'field'},'手填张数',h('input',{type:'number',min:articleMode?2:1,max:12,step:1,
            value:count||'',placeholder:'留空交给 AI；手动创作默认 1 张',
            onChange:e=>setCount(e.target.value===''?0:Number(e.target.value))})),
          !validCount&&h('small',{role:'alert'},articleMode?'请输入 2–12 张（包含封面）。':'请输入 1–12 张。'),
          h('div',{className:'line spread'},choices('生成张数',articleMode?{'0':'AI 决定','2':'封面 + 1 插图','3':'封面 + 2 插图','6':'封面 + 5 插图'}:{'0':'AI 决定','1':'单张','3':'3 张','6':'6 张','9':'9 张'},count,id=>setCount(Number(id))),
            Button('生成方案',()=>{
              if(project.pages.some(x=>x.image)&&!window.confirm('重新规划会替换当前页序和成图。继续吗？'))return;
              action('AI 正在规划画面',planTheme);
            },{className:'primary',disabled:!canPlan})),
          !articleMode&&Button('跳过规划，手动创作',()=>{
            const theme=(themeDraft??project.theme).trim()||attachments[0]?.name||'';
            if(!theme||!validCount)return;
            if(project.pages.some(x=>x.image)&&!window.confirm('开始新方案会替换当前页序。继续吗？'))return;
            setProject({...fresh(),theme,attachments,manualAttachments:true,mode:scenario||(count>1?'carousel':'single'),platform:modes[scenario]?.[1]||'portrait',concept:'手动组合画风、图型、主题色和人物参考。',pages:Array.from({length:count||1},()=>({...blankPage('single'),people:false}))});
            setThemeDraft(null);setActive(0);setInspector('picture');setView('create');
          },{disabled:!canPlan}),
          h('small',null,'可点选常用张数，也可手填，最多 12 张。')));
      function newProject(){
        if(busy)return;
        const hasWork=Boolean(project.theme.trim()||themeDraft?.trim()||articleDraft.trim()||attachments.length||project.concept);
        if(hasWork&&!window.confirm('新建项目？当前未保存的修改会丢失。'))return;
        setProject(fresh());setThemeDraft(null);setArticleDraft('');setAttachments([]);setScenario('');setCount(0);
        setActive(0);setInspector('picture');setManagePages(false);setPicker(null);setFocused(null);
        setError('');setView('create');
        if(surface.current)surface.current.scrollTop=0;
      }
      const projectView=h('section',{className:'shell stack'},
        h('h2',null,'我的项目'),
        !projects.length&&h('p',{className:'muted'},'保存方案或生成图片后，项目会出现在这里。'),
        h('div',{className:'plan-cards'},projects.map(saved=>Button(h('div',null,
          saved.pages.find(x=>x.image)&&h('img',{src:saved.pages.find(x=>x.image).image,alt:''}),
          h('strong',null,saved.theme||'未命名项目'),h('small',null,saved.pages.length+' 页')),()=>{
            setProject(saved);setAttachments(saved.attachments??[]);setArticleDraft(saved.article??'');setThemeDraft(null);setActive(0);setInspector('picture');setView('create');
          },{key:saved.id,disabled:!!busy}))));
      const [managePages,setManagePages]=useState(false);
      const panels={picture:'画面',references:'素材',direction:'创意',prompt:'提示词',project:'整套'};
      const promptPanel=h('div',{className:'stack'},
        h('p',{className:'muted'},'按当前画风、图型和创意设定编译，可在出图前核对。'),
        !project.theme.trim()?h('p',{className:'muted'},'填写主题后显示提示词。'):
          promptPreview?.key!==previewKey?h('p',{role:'status'},'正在准备提示词…'):
          promptPreview.error?h('p',{className:'error',role:'alert'},promptPreview.error):
          h('div',{className:'stack'},
          h('small',null,'随附参考图 '+(promptPreview.references.map(k=>labelFor(k)||({upload:'上传图',anchor:'整套参考',attachments:'创作附件图片'})[k]||k).join('、')||'无')),
          h('section',{className:'prompt-reading','aria-label':'生图提示词'},
            h('div',{className:'line spread'},h('strong',null,'生图提示词'),
              Button(h('svg',{width:16,height:16,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.8,'aria-hidden':true},
                h('rect',{x:8,y:8,width:12,height:12,rx:2}),h('path',{d:'M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2'})),copyPrompt,
                {title:'复制提示词','aria-label':'复制提示词'}),
              copiedPrompt===previewKey&&h('small',{role:'status'},'已复制')),
            h('div',{className:'prompt-prose'},promptPreview.zh))));
      const workspace=h('section',{className:'shell studio-workspace stack'},
        h('div',{className:'studio-heading line spread'},
          h('div',{className:'stack'},h('small',null,'当前项目'),h('h2',null,project.theme||'未命名创作')),
          h('div',{className:'line'},h('span',{className:'tag'},platforms[project.platform][0]),
            Button('修改主题',()=>setView('start'),{disabled:!!busy}))),
        project.concept&&h('p',{className:'concept'},project.concept),
        h('div',{className:'box output-toolbar',role:'group','aria-label':'生成输出设置'},
          h('div',{className:'line spread'},
            h('div',{className:'stack',style:{gap:2}},
              h('strong',null,'生成格式'),
              h('small',null,'生成前选择静态图片或 GIF 动画')),
            h('div',{className:'line output-format-choices'},
              Button('静态 PNG',()=>update({outputFormat:'png'}),{'aria-pressed':project.outputFormat!=='gif',disabled:!!busy}),
              Button('动画 GIF',()=>update({outputFormat:'gif'}),{'aria-pressed':project.outputFormat==='gif',disabled:!!busy}))),
          project.outputFormat==='gif'&&h('div',{className:'line gif-controls'},
            h('label',null,'帧数 ',h('input',{type:'number',min:2,max:16,step:1,value:project.frameCount??9,disabled:!!busy,'aria-label':'GIF 帧数',onChange:e=>update({frameCount:Number(e.target.value)})})),
            h('label',null,'每帧毫秒 ',h('input',{type:'number',min:20,max:2000,step:10,value:project.frameDurationMs??200,disabled:!!busy,'aria-label':'GIF 每帧时长',onChange:e=>update({frameDurationMs:Number(e.target.value)})})),
            h('small',null,'GIF 使用 gpt-image-2.6 系列模型，仅支持文生图（不支持上传参考图片），原动画直接下载保存。'))),
        h('div',{className:'studio-grid'},
          h('aside',{className:'box stack page-rail','aria-label':'图片列表'},
            h('div',{className:'line spread'},h('strong',null,'图片 · '+project.pages.length),
              Button(managePages?'完成':'整理',()=>setManagePages(!managePages),{'aria-expanded':managePages,disabled:!!busy})),
            h('div',{className:'rail-items'},project.pages.map((x,i)=>Button([
              x.image?h('img',{key:'thumb',src:x.image,alt:''}):h('span',{key:'number',className:'page-number'},String(i+1).padStart(2,'0')),
              h('span',{key:'info'},h('strong',null,x.title||'图片 '+(i+1)),h('small',null,x.locked?'已锁定':x.image?'已生成':'待生成'))
            ],()=>setActive(i),{key:x.id,'aria-pressed':active===i,disabled:!!busy}))),
            managePages&&h('div',{className:'stack'},h('small',null,'以下操作作用于选中的图片。'),h('div',{className:'line'},Button('向前移',()=>move(-1),{disabled:active===0}),Button('向后移',()=>move(1),{disabled:active===project.pages.length-1}),
              Button('添加空白图',()=>{update({pages:[...project.pages,blankPage('single')]});setActive(project.pages.length);},{disabled:project.pages.length>=12}),
              Button('复制这张的设置',()=>{
                const pages=[...project.pages];
                pages.splice(active+1,0,{...page,id:crypto.randomUUID(),image:'',savedPath:undefined,saveError:undefined,nativeLayout:undefined,locked:false});
                update({pages});setActive(active+1);
              },{disabled:project.pages.length>=12}),
              Button('删除这张',()=>{update({pages:project.pages.filter(x=>x.id!==page.id)});setActive(Math.max(0,active-1));},{disabled:project.pages.length===1||page.locked})))),
          h('section',{className:'box stack result-panel'},
            h('small',null,'第 '+(active+1)+' 张'+(page.placement?' · '+page.placement:'')),
            page.image&&page.savedPath&&h('small',{style:{overflowWrap:'anywhere'}},'已保存到 '+page.savedPath),
            page.image&&page.saveError&&h('p',{className:'error',role:'alert'},page.saveError),
            (preview||page.image)?h('img',{className:'preview',src:preview||page.image,alt:'当前页成图',title:'点击放大查看',tabIndex:0,role:'button','aria-label':'放大查看当前页成图',
              onClick:()=>setViewer({src:preview||page.image,scale:1}),
              onKeyDown:e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setViewer({src:preview||page.image,scale:1});}}}):
              h('div',{className:'empty-preview'},h('h2',null,page.title||'当前画面'),h('p',null,page.brief||'生成后在这里查看图片。'),page.body&&h('p',{className:'muted'},page.body)),
            h('div',{className:'line'},Button(page.image?'重做本页':'生成本页',generateOne,{className:'primary',disabled:!canGenerate}),
              project.pages.length>1&&Button('生成剩余 '+remaining.length+' 页',()=>settings?.configured?action('正在生成批量任务',signal=>batch(remaining,signal)):setOpenSettings(true),{disabled:!!busy||!remaining.length}),
              page.image&&Button(isGif(page)?'下载 GIF':'下载 PNG',exportPage,{disabled:!!busy}),
              page.image&&!isGif(page)&&Button(copiedImage?'已复制':'复制图片',copyImage,{disabled:!!busy,title:'把这张成图复制到剪贴板','aria-label':'复制图片到剪贴板'}),
              project.pages.length>1&&Button('导出整套 ZIP',exportAll,{disabled:!!busy||project.pages.some(x=>!x.image)}))),
          h('aside',{className:'box stack inspector','aria-label':'图片设置'},
            h('div',{className:'line inspector-tabs'},Object.entries(panels).map(([id,name])=>Button(name,()=>setInspector(id),{key:id,'aria-pressed':inspector===id}))),
            inspector==='picture'?h('fieldset',{className:'stack',disabled:!!busy},h('label',{className:'field'},'画面描述',h('textarea',{
              className:'scene-description',rows:8,value:page.sceneText??[page.brief,page.title&&'标题：'+page.title,page.body&&'正文：'+page.body].filter(Boolean).join('\n'),
              placeholder:'写你想画的内容，也可以直接写要出现在图上的文字。',maxLength:1800,disabled:page.locked,onChange:e=>edit({sceneText:e.target.value,typeOn:false})})),
            Button(page.locked?'解锁这张':'锁定这张',()=>edit({locked:!page.locked}))):
            inspector==='references'?h('div',{className:'stack'},!refs.layout&&h('fieldset',{disabled:!!busy||page.locked},choices('出图模式',{'pure-image':'纯图','graphic-text':'图文一体'},page.promptMode??(['single','scene'].includes(page.role)?'pure-image':'graphic-text'),promptMode=>edit({promptMode}))),
            refs.layout==='SC-021'&&h('fieldset',{disabled:page.locked||!!busy},h('legend',null,'双拼转译方式'),
              choices('双拼转译方式',{'1':'跨界续绘','2':'撕纸','3':'越界','4':'浮岛','5':'记忆图谱','6':'悬浮落地','7':'正负形'},page.layoutVariant??1,v=>edit({layoutVariant:Number(v)}))),
            (page.upload||sharedImages.length>0||localImages.length>0)&&Button('按画风重绘上传图',()=>edit({redraw:!page.redraw}),{disabled:!!busy||page.locked,'aria-pressed':!!page.redraw}),
h('p',{className:'muted'},'点图片即可在独立画廊更换。'),
            h('div',{className:'reference-grid'},['pose','face','clothes','style','style2','layout','color'].map(kind=>assetCard(kind))),uploadCard,
            h('div',{className:'line'},visual('pose')&&Button(page.depth?'深度图':'白模',()=>edit({depth:!page.depth}),{disabled:!!busy||page.locked,'aria-pressed':!!page.depth}),
              page.image&&Button('用成图统一整套',()=>update({anchor:page.image}),{disabled:!!busy})),
            project.anchor&&h('div',{className:'line'},h('img',{className:'anchor-thumb',src:project.anchor,alt:'整套参考图'}),h('small',null,'整套参考图'),Button('移除',()=>update({anchor:''}),{disabled:!!busy}))):
            inspector==='direction'?creativeDirection:
            inspector==='prompt'?promptPanel:
            h('fieldset',{className:'stack',disabled:!!busy},
              h('small',null,'作用于全套图片。单张图仍可在素材页单独替换。'),
          h('strong',null,'画幅与导出尺寸'),choices('画幅与导出尺寸',platforms,project.platform,id=>update({platform:id,ratio:undefined,pages:project.pages.map(x=>({...x,format:undefined,direction:{...x.direction,ratio:undefined}}))})),
            h('label',{className:'field'},'画幅比例',h('input',{value:project.ratio??presetRatio(project.platform),placeholder:'例如 3:4',onBlur:e=>{if(!e.target.value.trim())update({ratio:undefined});},onChange:e=>update({ratio:e.target.value,pages:project.pages.map(x=>({...x,format:undefined,direction:{...x.direction,ratio:undefined}}))})})),
            h('strong',null,'整套参考'),h('div',{className:'reference-grid'},['style','style2','color','face','clothes'].map(kind=>assetCard(kind,true))),
            Button('保存项目',()=>action('保存项目',async()=>{await projectStore('put',project);await refreshProjects();}))))),
        h('footer',{className:'muted'},'素材来源 ',h('a',{href:'https://github.com/anhao/ai-pose-gallery-zh'},'Anhao / ギア'),' · ',h('a',{href:'https://github.com/yang0/handraw-style'},'yang0 / handraw-style')));
      const hasPlan=Boolean(project.concept||page.brief||page.image);
      return h('main',{className:'ps',ref:surface,onScroll:e=>{if(!needsScroll.current)scroll.current=e.currentTarget.scrollTop;}},h('style',null,css+viewerCss+`
        .ps{background:#f4f1e9}.ps header{position:sticky;top:0;z-index:2;background:#f4f1e9;flex-wrap:wrap}.ps header h1{font-size:19px}.ps .shell{max-width:1200px;margin:0 auto;padding:24px}.ps .intro{padding:24px 0 12px}.ps .intro h2{font-size:clamp(28px,5vw,48px);letter-spacing:-.04em;line-height:1.2;margin:5px 0 10px}.ps .intro small{color:#42614f}.ps .intro p{color:#625d51}.ps button:focus-visible,.ps input:focus-visible,.ps textarea:focus-visible{outline:2px solid #27634e;outline-offset:2px}.ps .tag{background:#e8e3d6;border-radius:20px;padding:5px 12px}.ps .plan-cards,.ps .reference-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(108px,1fr));gap:9px}.ps .plan-cards button,.ps .asset-card{min-width:0;text-align:left;overflow-wrap:anywhere}.ps .plan-cards button img,.ps .asset-card img,.ps .asset-empty{width:100%;height:82px;object-fit:contain;background:#f1ede4;border-radius:5px;display:block;margin-bottom:5px}.ps .asset-empty{display:grid;place-items:center;font-size:25px;color:#586655}.ps .asset-card strong,.ps .asset-card small,.ps .plan-cards small,.ps .plan-cards strong{display:block}.ps .upload-card{border:1px solid #d9d3c7;padding:8px;border-radius:8px}.ps .upload-card input{font-size:10px;width:100%}.ps .anchor-thumb{width:56px;height:56px;object-fit:contain}.ps .work-columns{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr);gap:14px;align-items:start}.ps .empty-preview{display:grid;align-content:center;gap:12px;background:#eee9dd;padding:20px;min-height:230px;border-radius:8px}.ps .preview{width:100%;max-height:630px;object-fit:contain;background:#f2ede1}.ps .gallery-grid{grid-template-columns:repeat(auto-fill,minmax(132px,1fr));gap:11px}.ps .gallery-grid strong{display:block;font-size:13px}.ps .detail{position:fixed;inset:12% max(5%,calc((100vw - 720px)/2));z-index:3;box-shadow:0 0 0 100vmax #2228;overflow:auto}.ps .detail img{max-width:100%;max-height:47vh;object-fit:contain;justify-self:center}.ps .extras{padding-top:12px}.ps fieldset{min-width:0;border:0;margin:0}.ps .box{border:1px solid #ded8cd}.ps .settings-panel{max-width:760px}.ps summary{cursor:pointer}.ps .field{display:grid;gap:5px}@media(max-width:750px){.ps .work-columns{grid-template-columns:1fr}.ps .shell{padding:14px}}
        .ps{background:#f5f6fa;color:#1d2433}.ps header{background:#fcfcff;border-color:#e1e4ee}.ps .box{background:#fff;border-color:#e1e4ee;border-radius:14px}.ps button,.ps input:not([type=checkbox]),.ps textarea{background:#fff;border-color:#dce0ed}.ps button:hover:not(:disabled){border-color:#6653c4}.ps button[aria-pressed=true]{background:#eeebff;color:#35227d;border-color:#b8a8ff}.ps .primary{background:#5440bd;color:#fff;border-color:#5440bd}.ps .studio-start{max-width:840px;padding-top:44px}.ps .scenario-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(112px,1fr));gap:7px}.ps .scenario-grid button{text-align:left}.ps .studio-start textarea{min-height:150px}.ps .composer{position:relative;border:1px solid #dce0ed;border-radius:24px;background:#fff;padding:12px 14px 9px;box-shadow:0 3px 12px #202a4210}.ps .composer:focus-within{border-color:#a699e4}.ps .composer textarea{border:0;outline:0;box-shadow:none;min-height:76px;resize:vertical;padding:8px 2px}.ps .composer textarea:focus-visible{outline:0}.ps .composer-toolbar{display:flex;justify-content:space-between;align-items:center}.ps .attachment-trigger{position:relative}.ps .composer-plus{display:grid;place-items:center;width:34px;height:34px;padding:0;border-radius:50%;font-size:22px;line-height:1}.ps .attachment-popover{position:absolute;z-index:4;top:calc(100% + 6px);left:0;padding:5px;border:1px solid #e1e4ee;border-radius:12px;background:#fff;box-shadow:0 8px 24px #202a4220;white-space:nowrap}.ps .attachment-popover button{border:0}.ps .composer-files{display:flex;flex-wrap:wrap;gap:8px}.ps .composer-file{display:flex;align-items:center;gap:7px;max-width:min(100%,220px);padding:5px;border:1px solid #e1e4ee;border-radius:11px;background:#f8f8fc}.ps .composer-file img,.ps .file-glyph{width:36px;height:36px;flex:none;border-radius:6px;object-fit:cover}.ps .file-glyph{display:grid;place-items:center;background:#eeebff;color:#5440bd;font-size:20px}.ps .composer-file-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px}.ps .composer-file button{width:24px;height:24px;flex:none;padding:0;border:0;border-radius:50%;background:#eeeef5}.ps .studio-start fieldset{padding:22px}.ps .studio-start .intro small{color:#5440bd}.ps .studio-workspace{max-width:1520px}.ps .output-toolbar{display:grid;gap:12px;padding:14px 18px;border:2px solid #b8a8ff;background:#f7f5ff}.ps .output-format-choices button{font-weight:700;padding:9px 18px;min-width:108px}.ps .output-format-choices button[aria-pressed=true]{background:#5440bd;color:#fff;border-color:#5440bd}.ps .gif-controls input{width:90px;margin-left:6px}.ps .gif-controls small{flex-basis:100%;color:#575e72}.ps .studio-heading h2{font-size:clamp(22px,3vw,33px)}.ps .studio-heading .stack{gap:2px}.ps .concept{color:#575e72;max-width:80ch}.ps .studio-grid{display:grid;grid-template-columns:minmax(155px,.68fr) minmax(280px,1.55fr) minmax(255px,1fr);gap:14px;align-items:start}.ps .page-rail,.ps .result-panel,.ps .inspector{min-width:0}.ps .rail-items{display:grid;gap:6px}.ps .rail-items button{display:grid;grid-template-columns:38px minmax(0,1fr);gap:8px;text-align:left;align-items:center}.ps .rail-items button img,.ps .page-number{width:38px;height:38px;border-radius:6px;object-fit:cover}.ps .page-number{display:grid;place-items:center;background:#e9e5fa;color:#4d39a3}.ps .rail-items small,.ps .rail-items strong{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ps .inspector-tabs{gap:4px;border-bottom:1px solid #e1e4ee;padding-bottom:8px}.ps .inspector-tabs button{padding:5px 7px}.ps .empty-preview{background:#f0eff8;min-height:290px}.ps .result-panel .preview{background:#f0eff8}.ps .gallery-item{position:relative;min-width:0}.ps .pose-gallery{grid-template-columns:repeat(auto-fill,minmax(min(100%,235px),1fr));gap:16px}.ps .pose-gallery .pose-main{padding:7px}.ps .pose-gallery .pose-main img{aspect-ratio:1;object-fit:contain;margin-bottom:6px}.ps .pose-angles{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:4px;margin-top:5px}.ps .pose-angles button{min-width:0;padding:2px}.ps .pose-angles img{width:100%;aspect-ratio:1;object-fit:contain}.ps .pose-angles button[aria-pressed=true]{outline:2px solid #6653c4;outline-offset:-2px}.ps .gallery-item>button:first-child{width:100%}.ps .gallery-item .zoom-asset{position:absolute;top:8px;right:8px;padding:4px 8px;font-size:16px}.ps .gallery-grid button{background:#fff}.ps .gallery-grid img{border-radius:5px}.ps textarea.scene-description{width:100%;min-height:220px;max-height:70vh;field-sizing:content;resize:vertical;overflow:auto;line-height:1.65}.ps .prompt-reading{border:1px solid #e1e4ee;border-radius:10px;padding:12px;background:#fafaff}.ps .prompt-reading button{display:inline-flex;align-items:center;justify-content:center}.ps .prompt-prose{white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.75;margin-top:10px;user-select:text}.ps .studio-grid fieldset{padding:0}.ps .tag,.ps .asset-empty{background:#efedf8}.ps footer{padding-left:0}@media(max-width:1050px){.ps .studio-grid{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}.ps .page-rail{grid-column:1/-1}.ps .rail-items{grid-template-columns:repeat(auto-fit,minmax(125px,1fr))}}@media(max-width:680px){.ps .studio-grid{grid-template-columns:1fr}.ps .studio-start{padding-top:16px}}
      `),
        h('header',null,h('h1',null,'图像创作工作台'),h('nav',{className:'line','aria-label':'工作台'},
          Button('＋ 新建项目',newProject,{className:'primary',disabled:!!busy}),
          Button('创作',()=>{setView('create');setPicker(null);setFocused(null);},{'aria-pressed':view==='create'||view==='start'}),
          Button('素材画廊',browseGallery,{'aria-pressed':view==='gallery'}),
          Button('我的项目',()=>{setView('projects');setFocused(null);},{'aria-pressed':view==='projects'}),
          Button('设置',()=>openSettings?closeSettings():setOpenSettings(true),{disabled:!!busy,'aria-expanded':openSettings}))),
        openSettings&&renderSettings(),
        error&&h('p',{className:'shell error',role:'alert'},error),
        busy&&h('div',{className:'shell line',role:'status'},busy,Button('停止',()=>job.controller?.abort(),{disabled:!busy.startsWith('正在生成')})),
        !hydrated&&!seed?h('p',{className:'shell',role:'status'},'正在恢复工作台…'):view==='gallery'?galleryView:view==='projects'?projectView:view==='start'||!hasPlan?startView:workspace,
        viewer&&h('div',{className:'ps-viewer',role:'dialog','aria-modal':'true','aria-label':'查看大图',onClick:()=>setViewer(null)},
          h('div',{className:'ps-viewer-bar',onClick:e=>e.stopPropagation()},
            Button('缩小',()=>setViewer(v=>({...v,scale:Math.max(1,v.scale/1.25)})),{disabled:viewer.scale<=1,'aria-label':'缩小'}),
            h('span',{className:'scale','aria-live':'polite'},Math.round(viewer.scale*100)+'%'),
            Button('放大',()=>setViewer(v=>({...v,scale:Math.min(4,v.scale*1.25)})),{disabled:viewer.scale>=4,'aria-label':'放大'}),
            Button('适应屏幕',()=>setViewer(v=>({...v,scale:1})),{disabled:viewer.scale===1}),
            Button('关闭',()=>setViewer(null),{className:'primary'})),
          h('div',{className:'ps-viewer-stage'},
            h('img',{src:viewer.src,alt:'查看大图',className:viewer.scale>1?'zoomed':'',style:{transform:'scale('+viewer.scale+')'},
              onClick:e=>{e.stopPropagation();setViewer(v=>({...v,scale:v.scale>1?1:2}));},
              title:viewer.scale>1?'点击还原':'点击放大到 200%'}))));
    }

    function apply(ctx) {
      ctx.slots.inject('main', () => ctx.slots.register({ name:'main', key:panel }, Studio));
      ctx.slots.inject('sidebar.panellist', () => ctx.slots.register(
        { name:'sidebar.panellist', id:panel, order:70, label:()=> 'AI 写真工作台' },
        ({size = 20}) => h('svg',{width:size,height:size,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.7,'aria-hidden':true},
          h('rect',{x:3,y:4,width:18,height:16,rx:3}),h('path',{d:'m4 17 5-5 4 4 3-3 4 4'}),h('circle',{cx:15,cy:9,r:1.5}))));
    }
    return { name:panel, inject:['slots'], apply };
  },
});
