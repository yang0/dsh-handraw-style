import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPlan } from '../host.js';

const catalog = {
  style:[{id:'FA-001',name:'绘本风格'},{id:'FB-002',name:'扁平插画'}],
  color:[{id:'C-01',name:'暖色系'}],
  layout:[{id:'SC-001',name:'封面排版'}],
  pose:[],face:[],clothes:[],
};
const list = async kind => catalog[kind] ?? [];
const base = {theme:'一只猫在阳光下喝茶',count:1};
const validPlan = {
  concept:'暖色绘本风格，主体清晰，适当留白',mode:'single',platform:'square',
  style:'FA-001',color:'C-01',
  pages:[{role:'single',title:'猫咪下午茶',brief:'茶杯在前，猫咪坐在窗台，暖色阳光，三分构图',
    layout:'SC-001',people:false,promptMode:'pure-image',
    direction:{tone:'T-01',mood:'温暖',whitespace:'moderate',audience:'亲子',scenario:'绘本封面',ratio:'1:1'}}],
};
async function withPlan(plan, run) {
  const previous=globalThis.fetch;
  globalThis.fetch=async () => Response.json({choices:[{message:{content:JSON.stringify(plan)}}]});
  try { return await run(); } finally { globalThis.fetch=previous; }
}
const planRequest=() => createPlan(base,{key:'mock-secret-key',baseUrl:'http://127.0.0.1:38650/v1'},list,new AbortController().signal);

test('AI must select a real catalog style', async () => {
  await withPlan({...validPlan,style:null},async () => {
    await assert.rejects(planRequest(), /画风是必选项/);
  });
  await withPlan({...validPlan,style:'FA-999'},async () => {
    await assert.rejects(planRequest(), /画风是必选项/);
  });
});

test('AI plan returns validated style, assets and rendering parameters', async () => {
  const plan=await withPlan(validPlan,planRequest);
  assert.equal(plan.style,'FA-001');
  assert.equal(plan.color,'C-01');
  assert.equal(plan.pages[0].layout,'SC-001');
  assert.equal(plan.pages[0].direction.tone,'T-01');
  assert.equal(plan.pages[0].direction.whitespace,'moderate');
  assert.equal(plan.pages[0].direction.ratio,'1:1');
  assert.equal(plan.pages[0].promptMode,'pure-image');
});

test('invalid parameter choices are safely dropped', async () => {
  const plan=await withPlan({...validPlan,pages:[{...validPlan.pages[0],layout:'SC-999',promptMode:'unknown',
    direction:{tone:'T-999',whitespace:'unknown',ratio:'invalid'}}]},planRequest);
  assert.equal(plan.pages[0].layout,undefined);
  assert.equal(plan.pages[0].promptMode,undefined);
  assert.equal(plan.pages[0].direction.tone,undefined);
  assert.equal(plan.pages[0].direction.whitespace,'auto');
  assert.equal(plan.pages[0].direction.ratio,undefined);
});
