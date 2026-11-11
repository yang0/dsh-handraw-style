import { readFile } from 'node:fs/promises';

const assets = new URL('./assets/', import.meta.url);
const read = async name => JSON.parse(await readFile(new URL(name, assets), 'utf8'));
let rules;
const stripIds = text => text?.replace(/\b(?:FA|FB|FC|FD|FE|FF|FG|FH|FI|SC|IG|SB|IP|EC|C)-\d{2,3}\b/g, '').replace(/[（(]\s*[)）]/g, '').trim();
const photoTypes = ['跨界续绘','撕纸第二世界','越界破框','微缩浮岛','记忆图谱','悬浮落地','正负形咬合'];

function photoLayout(text, variant, english, size) {
  const lines = text.split('\n');
  const chosen = lines.find(line => (english ? new RegExp('^[-–] \\[Type 0'+variant+'\\b','i') : new RegExp('^[-–] 【类型 0'+variant+'\\b')).test(line));
  const end = lines.findIndex(line => /七大核心转译类型|Seven.*(?:Core|Type)/i.test(line));
  const splitStart=lines.findIndex(line=>/画幅比例驱动|Aspect Ratio.*(?:Split|Driven)/i.test(line));
  const photoStart=lines.findIndex(line=>/真实摄影区（|Realistic Photography/i.test(line));
  const start=end<0?'':lines.slice(0,end).filter((_,i)=>splitStart<0||photoStart<=splitStart||i<splitStart||i>=photoStart).join('\n');
  const split = size==='1536x1024' ? '左右等分，左摄影、右手绘' : '上下等分，上摄影、下手绘';
  return [start, english?'Use one fixed equal split for this output: '+(size==='1536x1024'?'photo left, illustration right.':'photo above, illustration below.'):'本张采用唯一切分方式：'+split+'。',
    chosen?.replace(/^[-–]\s*/, '') || (english ? 'Use the selected artistic transformation.' : '本张采用'+photoTypes[variant-1]+'。')].filter(Boolean).join('\n');
}

export async function compilePrompt({ design, refs, model, list, size }) {
  const [capabilities, fixed, tones] = await (rules ??= Promise.all([read('model-capabilities.json'),read('handraw-rules.json'),read('tones.json')]));
  const get = async (kind,id) => id ? (await list(kind)).find(x=>x.id===id) : undefined;
  const [layout,color,style,scene] = await Promise.all([
    get('layout',design.layout),get('color',design.color),get('style',refs.style),get('style',refs.style2),
  ]);
  if (design.layout && !layout) throw Object.assign(new Error('所选图型已不可用，请重新选择。'),{status:400});
  const ecommerce=layout?.id.startsWith('EC-');
  const allowedStyle=!ecommerce||design.explicitStyle;
  const selected={...refs};
  const mode=layout ? (ecommerce?'ecommerce':'graphic-text') : design.mode==='graphic-text'?'graphic-text':'pure-image';
  const variant=Number.isInteger(design.variant)&&design.variant>=1&&design.variant<=7?design.variant:1;
  const styleParts=[];
  const baseModel=String(model??'').split('/').pop().split(/[:@]/)[0];
  for (const [kind,entry] of [['style',style],['style2',scene]]) {
    if (!allowedStyle||!entry) { delete selected[kind]; continue; }
    const policy=capabilities.models[model]||capabilities.models[baseModel], calibrated=policy?.styles?.[entry.id];
    const named=calibrated?.name_activation==='strong';
    if (named||(policy?.traits_activation==='strong'&&entry.prompt))delete selected[kind];
    styleParts.push({kind,entry,traits:!named?entry.prompt:''});
  }
  const detail = (value, zh, en, english) => typeof value==='string' && value.trim()
    ? (english?en:zh)+value.trim().slice(0,240) : '';
  const negativeSpace = {
    moderate:['【大量留白】','[Generous negative space]'],
    high:['【大量留白，场景只显示必要部分，不要显示全】','[Generous negative space, scene shows only essential parts, do not show in full]'],
  };
  const tone=tones.find(x=>x.id===design.tone);
  const lines=(english)=>[
    ...styleParts.flatMap(({kind,entry,traits})=>[
      (kind==='style2'?(english?'Scene style: ':'场景风格：'):(english?'Style name: ':'风格名称：'))+entry.name,
      entry.author&&(english?'Reference author and style: ':'参考作者与风格名称：')+entry.author+' / '+entry.name,
      traits&&(english?'Core style traits: ':'核心风格特征：')+traits,
    ]),
    color&&(english?color.promptEn||color.prompt:color.prompt),
    (english?'Theme: ':'主题：')+design.theme,
    detail(design.scenario,'业务场景：','Scenario: ',english),
    detail(design.audience,'受众：','Audience: ',english),
    detail(design.mood,'情绪：','Mood: ',english),
    detail(design.ratio,'画幅比例：','Aspect ratio: ',english),
    tone&&(english?'Tone: '+tone.name_en+' — '+tone.desc_en:'影调：'+tone.name_zh+'。'+tone.desc_zh),
    Object.hasOwn(negativeSpace,design.whitespace)&&negativeSpace[design.whitespace][english?1:0],
    typeof design.sourceText==='string'&&design.sourceText.trim()&&('创作资料（供理解主题，不逐字绘制）：\n'+design.sourceText.slice(0,12000)),
    design.brief&&(english?'Image direction: ':'画面要求：')+design.brief,
    design.copy&&mode!=='pure-image'&&(english?'Copy: ':'画面文案：')+design.copy,
    layout&&(english?'Layout: ':'排版图型：')+stripIds(layout.id==='SC-021'?photoLayout(english?layout.promptEn:layout.prompt,variant,english,size):english?layout.promptEn||layout.prompt:layout.prompt),
    design.redraw&&(refs.upload||refs.attachments)&&(english?'Redraw the person and scene from scratch in the chosen style. Preserve facial features, pose and contours without applying a filter to the original.':'提取上传图的人物五官、姿态和场景轮廓，按所选画风从零重绘，避免在原图上叠加滤镜。'),
    design.localText&&(english?'Reserve space for locally rendered copy. Do not draw readable text.':'给本地排版留出文字区，画面内不绘制可读文字。'),
  ].filter(Boolean);
  const zh=lines(false);
  const suffix=mode==='graphic-text'&&!design.localText?fixed.suffix:'';
  return { refs:selected, zh:[...zh,suffix].filter(Boolean).join('\n'),
    withReferences: referenceLines=>[...zh,...referenceLines,suffix].filter(Boolean).join('\n'), mode };
}
