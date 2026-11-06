import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rankCatalog, shortlist, chooseCatalog } from '../planning-selection.js';

const styles = [
  { id:'FA-001',group:'FA',name:'Pen Doodle',prompt:'极简线描、黑白钢笔' },
  { id:'FB-002',group:'FB',name:'Watercolor Storybook',prompt:'儿童绘本、水彩、柔和纸纹' },
  { id:'FI-003',group:'FI',name:'Realistic Photography',prompt:'写实摄影、镜头、自然光' },
];
const colors=[
  {id:'C-01',name:'Warm Sun',prompt:'暖色、金黄与米色'},
  {id:'C-02',name:'Cool Blue',prompt:'冷色、蓝色、科技'},
];

test('semantic recommendation promotes relevant real catalog styles', () => {
  assert.equal(rankCatalog(styles,'儿童水彩绘本','style')[0].item.id,'FB-002');
  assert.equal(rankCatalog(styles,'真实摄影照片','style')[0].item.id,'FI-003');
  assert.equal(chooseCatalog(styles,null,'儿童水彩绘本','style',true).id,'FB-002');
});
test('recognizes AI-provided IDs or names before using a fallback', () => {
  assert.deepEqual(chooseCatalog(styles,'fb-002','无关描述','style',true),{id:'FB-002',source:'ai'});
  assert.deepEqual(chooseCatalog(styles,'Watercolor Storybook','无关描述','style',true),{id:'FB-002',source:'ai'});
  assert.equal(chooseCatalog(styles,'FI-999','儿童水彩绘本','style',true).source,'recommended');
});
test('chooses a real palette and keeps optional assets truly optional', () => {
  assert.equal(chooseCatalog(colors,null,'温暖阳光','color',true).id,'C-01');
  assert.equal(chooseCatalog(styles,null,'儿童水彩绘本','style',false).id,undefined);
  assert.equal(chooseCatalog([],null,'', 'style',true).id,undefined);
});
test('shortlists are ranked without inventing IDs', () => {
  const list=shortlist(styles,'摄影照片','style',2);
  assert.equal(list.length,2);
  assert.equal(list[0].id,'FI-003');
  assert.ok(list.every(x=>styles.includes(x)));
});
