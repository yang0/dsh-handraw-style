/**
 * Catalog-based visual decision support.
 * The planner sees a compact, theme-ranked shortlist rather than thousands of raw IDs.
 * All results refer to actual catalog entries; no synthetic IDs are created.
 */
const hints = {
  style: [
    [/摄影|写真|照片|写实|镜头|photo|realistic/i,/摄影|写实|photo|realistic|film|camera|portrait/i],
    [/动漫|二次元|anime|漫画/i,/动漫|漫画|anime|manga|cel|赛璐璐/i],
    [/水彩|watercolor/i,/watercolor|水彩/i],
    [/黏土|粘土|clay|3d|三维/i,/clay|3d|sculpt|黏土|粘土/i],
    [/儿童|绘本|童话|故事书|亲子/i,/picture book|children|storybook|绘本|童趣/i],
    [/国风|水墨|中国风|古风/i,/ink wash|chinese|水墨|国风/i],
    [/海报|扁平|平面|信息图|排版/i,/flat|graphic|poster|editorial|平面|几何/i],
  ],
  color: [
    [/暖|温馨|治愈|阳光|warm|cozy/i,/暖|橙|红|黄|米|warm|sun|gold|peach/i],
    [/冷|科技|理性|未来|科技感|tech/i,/蓝|青|冷|blue|cool|cyan|tech/i],
    [/自然|森林|植物|环保|绿色/i,/绿|植物|green|nature|forest/i],
    [/复古|怀旧|retro|vintage/i,/复古|怀旧|retro|vintage|棕|米/i],
    [/高级|奢华|商务|luxury/i,/黑|金|深|black|gold|luxury/i],
  ],
  layout: [
    [/封面|标题|海报|cover|poster/i,/封面|标题|海报|cover|poster|大标题/i],
    [/步骤|流程|教程|step|guide/i,/步骤|流程|流程图|step|sequence/i],
    [/对比|前后|比较|compare/i,/对比|比较|compare|split|before|after/i],
    [/总结|清单|要点|summary/i,/总结|清单|要点|summary|grid/i],
    [/电商|商品|产品|卖点|product/i,/电商|商品|产品|product|commerce/i],
    [/信息图|数据|图解|知识|infographic/i,/信息|数据|图解|信息图|infographic|diagram/i],
  ],
  tone: [
    [/明亮|清新|阳光|明快/i,/高调|明亮|浅淡/i],
    [/神秘|暗黑|电影|深沉/i,/低调|深重|暗|电影/i],
    [/复古|怀旧|胶片/i,/复古|暖|胶片/i],
  ],
};

function terms(value) {
  const text=String(value||'').toLowerCase();
  const latin=text.match(/[a-z]{3,}/g)||[];
  const chinese=text.match(/[\u3400-\u9fff]+/g)||[];
  return new Set([...latin,...chinese.flatMap(chunk=>[
    ...(chunk.length<=4?[chunk]:[]),
    ...Array.from({length:Math.max(0,chunk.length-1)},(_,i)=>chunk.slice(i,i+2)),
  ])]);
}

export function rankCatalog(rows, context, kind='style') {
  const query=terms(context);
  const contextText=String(context||'');
  return rows.map((item,index)=>{
    const description=[item.name,item.name_zh,item.group,item.prompt,item.desc_zh].filter(Boolean).join(' ').slice(0,500);
    const tokens=terms(description);
    let score=0;
    for(const term of query)if(tokens.has(term))score+=term.length>3?3:2;
    for(const [input,match] of hints[kind]||[]) {
      if(input.test(contextText)&&match.test(description))score+=14;
    }
    return {item,score,index};
  }).sort((a,b)=>b.score-a.score||a.index-b.index);
}

/** Balanced shortlist when many unrelated catalog items exist. Always sorted by semantic relevance. */
export function shortlist(rows, context, kind, limit=48) {
  const ranked=rankCatalog(rows,context,kind);
  if(ranked.length<=limit)return ranked.map(hit=>hit.item);
  const chosen=[],seen=new Set(),groupCounts=new Map();
  for(const hit of ranked) {
    const group=hit.item.group||hit.item.id?.split('-')[0]||'default';
    if((groupCounts.get(group)||0)>=Math.max(3,Math.ceil(limit/4)))continue;
    chosen.push(hit.item);seen.add(hit.item.id);
    groupCounts.set(group,(groupCounts.get(group)||0)+1);
    if(chosen.length===limit)break;
  }
  for(const hit of ranked) {
    if(chosen.length===limit)break;
    if(!seen.has(hit.item.id)){chosen.push(hit.item);seen.add(hit.item.id);}
  }
  return chosen;
}

/** Resolve AI responses by exact ID, normalized ID, or exact catalog name; otherwise use ranked recommendation. */
export function chooseCatalog(rows, requested, context, kind, required=false) {
  if(!rows?.length)return {id:undefined,source:'unavailable'};
  const raw=typeof requested==='string'?requested.trim():'';
  let found=rows.find(x=>x.id?.toLowerCase()===raw.toLowerCase());
  if(!found&&raw){
    const compact=raw.replace(/[\s_-]/g,'').toLowerCase();
    found=rows.find(x=>x.id?.replace(/[\s_-]/g,'').toLowerCase()===compact);
    if(!found)found=rows.find(x=>x.name?.toLowerCase()===raw.toLowerCase()||x.name_zh===raw);
    if(!found){
      const match=/\b([a-z]{1,3})[\s-]*0*(\d{1,4})\b/i.exec(raw);
      if(match)found=rows.find(x=>x.id?.toLowerCase()===match[1].toLowerCase()+'-'+match[2].padStart(3,'0'));
    }
  }
  if(found)return {id:found.id,source:'ai'};
  if(!required)return {id:undefined,source:'none'};
  return {id:rankCatalog(rows,context,kind)[0].item.id,source:'recommended'};
}
