import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, mkdtempSync, writeFileSync, rmSync, mkdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRequire} from 'node:module';
import {buildOpenApi, assertCompatibleDefinition, run as runBuild} from './build-openapi.mjs';
import {translateGenerated} from './openapi-en/translate.mjs';
import {diffSpecs} from './openapi-parity.mjs';
const yaml=createRequire(new URL('../docs-site/package.json',import.meta.url))('js-yaml');
const loadJson=path=>JSON.parse(readFileSync(new URL(path,import.meta.url)));
const generated=loadJson('./fixtures/merchant-openapi.json');
const baseline=loadJson('./fixtures/openapi-handwritten-baseline.json');
const translations=loadJson('./openapi-en/translations.json');
const handwritten=locale=>yaml.load(readFileSync(`docs-site/openapi/handwritten.${locale}.yaml`,'utf8'));
test('手書きの2 operationとWebhookと到達定義を日英とも保持する',()=>{
 for(const locale of ['ja','en']){
 const actual=buildOpenApi(handwritten(locale),generated,locale,translations);
 const expected=baseline[locale];for(const [path,methods] of Object.entries(expected.paths))assert.deepEqual(actual.paths[path],methods);
 assert.deepEqual(actual.webhooks,expected.webhooks);
 for(const [kind,definitions] of Object.entries(expected.components))for(const [name,value] of Object.entries(definitions))assert.deepEqual(actual.components[kind][name],value);
 assert.deepEqual(actual.info,{...expected.info,version:generated.info.version});assert.deepEqual(actual.security,expected.security);
 assert.equal(Object.values(expected.paths).flatMap(Object.values).length,2);
 for(const tag of expected.tags)assert.deepEqual(actual.tags.find(value=>value.name===tag.name),tag);
 }
});
test('注釈差とrequired/enum順を許容し構造差は拒否する',()=>{
 assert.doesNotThrow(()=>assertCompatibleDefinition('PaymentStatus',{type:'string',description:'手書き',examples:['created']},{type:'string',description:'生成',examples:['created','settled']}));
 assert.doesNotThrow(()=>assertCompatibleDefinition('X',{type:'object',required:['a','b']},{required:['b','a'],type:'object'}));
 for(const [left,right] of [[{required:['id']},{required:[]}],[{type:'string'},{type:'number'}],[{pattern:'a'},{pattern:'b'}],[{nullable:true},{nullable:false}],[{type:'apiKey',name:'a',in:'header'},{type:'apiKey',name:'b',in:'header'}],[{properties:{description:{type:'string'}}},{properties:{description:{type:'number'}}}]])assert.throws(()=>assertCompatibleDefinition('X',left,right),/handwritten.*generated/);
});
test('参照とinlineを比較し循環でも停止し構造差を隠さない',()=>{
 const roots={handwritten:{components:{schemas:{Node:{type:'object',properties:{next:{$ref:'#/components/schemas/Node'}}}}}},generated:{components:{schemas:{Node:{properties:{next:{$ref:'#/components/schemas/Node'}},type:'object'}}}}};
 assert.doesNotThrow(()=>assertCompatibleDefinition('Node',{$ref:'#/components/schemas/Node'},roots.generated.components.schemas.Node,roots));
 roots.generated.components.schemas.Node.properties.extra={type:'string'};
 assert.throws(()=>assertCompatibleDefinition('Node',{$ref:'#/components/schemas/Node'},roots.generated.components.schemas.Node,roots));
});
test('prereleaseとoperation衝突を拒否する',()=>{
 const pre=structuredClone(generated);pre.info.version+='-preview';assert.throws(()=>buildOpenApi(handwritten('ja'),pre,'ja',translations));
 const input=handwritten('ja');input.paths['/payments/{paymentIntentId}']=generated.paths['/payments/{paymentIntentId}'];assert.throws(()=>buildOpenApi(input,generated,'ja',translations));
});
test('例summary・エラーセル・headerの未訳と原文変更を拒否する',()=>{
 for(const key of Object.keys(translations)){
 const missing=structuredClone(translations);delete missing[key];assert.throws(()=>translateGenerated(generated,missing),key);
 }
 const changed=structuredClone(generated);changed.paths['/payments/{paymentIntentId}'].get.summary+='変更';assert.throws(()=>translateGenerated(changed,translations));
 const malformed=structuredClone(generated);malformed.paths['/payments/{paymentIntentId}'].get.responses['400'].description=malformed.paths['/payments/{paymentIntentId}'].get.responses['400'].description.replace('meaning','reason');assert.throws(()=>translateGenerated(malformed,translations));
});
test('query・値・入力を保ち繰り返して同じ成果物になる',()=>{
 const before=structuredClone(generated),input=handwritten('en'),saved=structuredClone(input);
 const actual=buildOpenApi(input,generated,'en',translations);
 assert.deepEqual(actual,buildOpenApi(input,generated,'en',translations));assert.deepEqual(generated,before);assert.deepEqual(input,saved);
 const operation=Object.values(actual.paths).flatMap(Object.values).find(op=>op.operationId==='listMachinePaymentRefunds');assert.ok(operation.parameters.some(p=>p.in==='query'));
 assert.deepEqual(diffSpecs(buildOpenApi(handwritten('ja'),generated,'ja',translations),actual),[]);
});

test('schemaの注釈だけを除き既定値やenum値のdescriptionを構造として比べる',()=>{
 assert.throws(()=>assertCompatibleDefinition('X',{default:{description:'a'}},{default:{description:'b'}}));
 assert.throws(()=>assertCompatibleDefinition('X',{const:{title:'a'}},{const:{title:'b'}}));
 assert.throws(()=>assertCompatibleDefinition('X',{type:'string',format:'date-time'},{type:'string',format:'date'}));
 assert.throws(()=>assertCompatibleDefinition('X',{additionalProperties:true},{additionalProperties:false}));
 assert.throws(()=>assertCompatibleDefinition('X',{type:['string','null']},{type:'string'}));
 assert.doesNotThrow(()=>assertCompatibleDefinition('X',{enum:['a','b']},{enum:['b','a']}));
});

test('parityはx-で始まるフィールド名を許容し未対応の拡張を拒否する',()=>{
 assert.deepEqual(diffSpecs({properties:{'x-key':{type:'string'}}},{properties:{'x-key':{type:'string'}}}),[]);
 assert.ok(diffSpecs({'x-auth-scheme':'api-key'},{'x-auth-scheme':'api-key'}).length);
});

test('生成された公開7operationの例とエラーコードを日英とも保つ',()=>{
 const translated=translateGenerated(generated,translations);
 for(const [path,methods] of Object.entries(generated.paths))for(const [method,operation] of Object.entries(methods)){
 const actual=translated.paths[path][method];assert.equal(actual.operationId,operation.operationId);
 for(const [status,response] of Object.entries(operation.responses)){
 const actualResponse=actual.responses[status];
 for(const [name,example] of Object.entries(response.content?.['application/json']?.examples??{}))assert.deepEqual(actualResponse.content['application/json'].examples[name].value,example.value);
 if(response.description.startsWith('|')){
 const codes=response.description.split('\n').slice(2).map(line=>line.split('|')[1].trim());
 const actualCodes=actualResponse.description.split('\n').slice(2).map(line=>line.split('|')[1].trim());assert.deepEqual(actualCodes,codes);
 }
 }
 }
 assert.equal(Object.keys(generated.components.schemas).length,19);assert.equal(Object.keys(generated.components.parameters).length,3);
});

test('削除された説明の訳や参照の構造制約を上書きして通さない',()=>{
 assert.throws(()=>translateGenerated(generated,{...translations,'schemas.Removed.description':{source:'削除済み',translation:'Removed'}}),/Unused translation/);
 const roots={handwritten:{components:{schemas:{X:{type:'string',pattern:'a'}}}},generated:{}};
 assert.throws(()=>assertCompatibleDefinition('X',{$ref:'#/components/schemas/X',pattern:'b'},{type:'string',pattern:'b'},roots));
 const chained={components:{schemas:{X:{$ref:'#/components/schemas/Y'},Y:{type:'string'}}}};
 assert.doesNotThrow(()=>assertCompatibleDefinition('X',{$ref:'#/components/schemas/X'},{type:'string'},{handwritten:chained,generated:{}}));
});

test('同じ参照objectでも各rootから解決しschema注釈と値の比較履歴を混同しない',()=>{
 const reference={$ref:'#/components/schemas/X'};
 assert.throws(()=>assertCompatibleDefinition('X',reference,reference,{handwritten:{components:{schemas:{X:{type:'string'}}}},generated:{components:{schemas:{X:{type:'number'}}}}}));
 const left={type:'object',description:'a'},right={type:'object',description:'b'};
 assert.throws(()=>assertCompatibleDefinition('X',{properties:{field:left},default:left},{properties:{field:right},default:right}));
});

test('defaultやconst内のenum/required配列はデータ順を保持する',()=>{
 for(const container of ['default','const'])for(const key of ['enum','required']){
  assert.throws(()=>assertCompatibleDefinition('X',{[container]:{[key]:['a','b']}},{[container]:{[key]:['b','a']}}));
 }
});

test('schema enumのobject要素はキー順と集合順を正規化し要素内の配列順は保持する',()=>{
 assert.doesNotThrow(()=>assertCompatibleDefinition('X',{enum:[{x:1},{x:2}]},{enum:[{x:2},{x:1}]}));
 assert.doesNotThrow(()=>assertCompatibleDefinition('X',{enum:[{a:1,b:2},{x:2}]},{enum:[{x:2},{b:2,a:1}]}));
 assert.throws(()=>assertCompatibleDefinition('X',{enum:[{enum:['a','b']}]},{enum:[{enum:['b','a']}]}));
 assert.throws(()=>assertCompatibleDefinition('X',{enum:[{description:'a'}]},{enum:[{description:'b'}]}));
});

test('ref siblingも通常のschema比較と同じキー順と集合順を許容する',()=>{
 const target={type:'object',properties:{a:{type:'string'},b:{type:'number'}},required:['a','b'],enum:[{a:'x',b:1},{a:'y',b:2}]};
 const siblings={properties:{b:{type:'number'},a:{type:'string'}},required:['b','a'],enum:[{b:2,a:'y'},{b:1,a:'x'}]};
 const roots={handwritten:{components:{schemas:{X:target}}},generated:{}};
 assert.doesNotThrow(()=>assertCompatibleDefinition('X',{$ref:'#/components/schemas/X',...siblings},target,roots));
 assert.throws(()=>assertCompatibleDefinition('X',{$ref:'#/components/schemas/X',default:{enum:['b','a']}},{...target,default:{enum:['a','b']}},roots));
 const withDefault={...target,default:{enum:['a','b']}};
 assert.throws(()=>assertCompatibleDefinition('X',{$ref:'#/components/schemas/X',default:{enum:['b','a']}},{...withDefault,default:{enum:['b','a']}},{handwritten:{components:{schemas:{X:withDefault}}},generated:{}}));
});

 test('CIは生成一致・単体・lint・build・E2Eをnpm scriptsから順に実行する',()=>{
 const root=loadJson('../package.json');
 const workflow=yaml.load(readFileSync('.github/workflows/ci.yml','utf8'));
 const runs=workflow.jobs.test.steps.map(step=>step.run).filter(Boolean);
 const commands=['npm ci','npm --prefix docs-site ci','npm run openapi:check','npm run test:machine-openapi','npm run test:refund-signer','npm run lint:openapi','npm run build:docs','npm run test:e2e'];
 let previous=-1;
 for(const command of commands){const index=runs.indexOf(command);assert.ok(index>previous,`Missing or misplaced ${command}`);previous=index;}
 assert.equal(root.scripts['test:machine-openapi'],'node --test scripts/machine-openapi.test.mjs');
 assert.equal(root.scripts['test:refund-signer'],'node --test scripts/refund-signer.test.mjs');
 assert.equal(root.scripts['build:docs'],'bash scripts/build-dist.sh');
 assert.equal(root.scripts['lint:openapi'],'npm --prefix docs-site run lint:openapi');
 });

test('Redoclyは日英のタグなしWebhookだけを例外とし未知タグ・未解決ref・重複IDを拒否する',()=>{
 const config=yaml.load(readFileSync('docs-site/redocly.yaml','utf8'));
 assert.deepEqual(config,{extends:[],rules:{'no-unresolved-refs':'error','operation-operationId-unique':'error','operation-tag-defined':'error'}});
 const ignores=yaml.load(readFileSync('docs-site/.redocly.lint-ignore.yaml','utf8'));
 assert.deepEqual(ignores,Object.fromEntries(['static/openapi.yaml','i18n/en/openapi.yaml'].map(path=>[path,{'operation-tag-defined':['#/webhooks/paymentEvent/post']}])));
 const directory=mkdtempSync(join(tmpdir(),'stbl-openapi-lint-'));
 const base={openapi:'3.1.0',info:{title:'Fixture',version:'1.0.0'},tags:[{name:'Known'}],paths:{'/a':{get:{operationId:'first',tags:['Known'],responses:{200:{description:'OK'}}}}}};
 writeFileSync(join(directory,'redocly.yaml'),readFileSync('docs-site/redocly.yaml'));
 writeFileSync(join(directory,'.redocly.lint-ignore.yaml'),readFileSync('docs-site/.redocly.lint-ignore.yaml'));
 const cli=join(process.cwd(),'docs-site/node_modules/@redocly/cli/bin/cli.js');
 const run=(spec,path)=>{writeFileSync(join(directory,path),JSON.stringify(spec));return spawnSync(process.execPath,[cli,'lint','--config','redocly.yaml',path],{cwd:directory,encoding:'utf8',env:{...process.env,REDOCLY_TELEMETRY:'off',REDOCLY_SUPPRESS_UPDATE_NOTICE:'true'}});};
 try{
 base.webhooks={paymentEvent:{post:{operationId:'receiveEvent',responses:{200:{description:'OK'}}}}};
 for(const path of ['static/openapi.yaml','i18n/en/openapi.yaml']){
 mkdirSync(join(directory,path,'..'),{recursive:true});
 const valid=run(base,path);assert.equal(valid.status,0,valid.stderr);
 for(const [rule,change,pointer] of [
 ['no-unresolved-refs',spec=>{spec.paths['/a'].get.responses[200].content={'application/json':{schema:{$ref:'#/components/schemas/Missing'}}};}],
 ['operation-operationId-unique',spec=>{spec.paths['/b']={get:structuredClone(spec.paths['/a'].get)};}],
 ['operation-tag-defined',spec=>{spec.paths['/a'].get.tags=['Unknown'];},'#/paths/~1a/get/tags/0'],
 ['operation-tag-defined',spec=>{spec.webhooks.paymentEvent.post.tags=['Unknown'];},'#/webhooks/paymentEvent/post/tags/0'],
 ]){const broken=structuredClone(base);change(broken);const result=run(broken,path);assert.notEqual(result.status,0,`${path}: ${rule}`);assert.match(result.stdout+result.stderr,new RegExp(rule));if(pointer)assert.ok((result.stdout+result.stderr).includes(pointer),result.stdout+result.stderr);}
 }
 }finally{rmSync(directory,{recursive:true,force:true});}
});

test('$refのsiblingは注釈だけを許し検証キーは重ねて評価できないため拒否する',()=>{
 const roots={handwritten:{components:{schemas:{X:{type:'object',properties:{a:{type:'string'}}}}}},generated:{}};
 const target={type:'object',properties:{a:{type:'string'}}};
 assert.doesNotThrow(()=>assertCompatibleDefinition('X',{$ref:'#/components/schemas/X',description:'注釈',title:'題',examples:['a']},target,roots));
 assert.throws(()=>assertCompatibleDefinition('X',{$ref:'#/components/schemas/X',additionalProperties:false},{...target,additionalProperties:false},roots),/conflicts/);
 assert.throws(()=>assertCompatibleDefinition('X',{$ref:'#/components/schemas/X',maxProperties:1},{...target,maxProperties:1},roots),/conflicts/);
});

test('パス変数名だけが違うパスは衝突として拒否する',()=>{
 const input=handwritten('ja');input.paths['/payments/{id}']={post:{operationId:'dummyPost',responses:{200:{description:'ok'}}}};
 assert.throws(()=>buildOpenApi(input,generated,'ja',translations),/Path template collision/);
});

test('パスを共有するときパスレベルのフィールドが食い違えば拒否する',()=>{
 const input=handwritten('ja');input.paths['/payments/{paymentIntentId}']={parameters:[{name:'x',in:'header',schema:{type:'string'}}],post:{operationId:'dummyPost',responses:{200:{description:'ok'}}}};
 assert.throws(()=>buildOpenApi(input,generated,'ja',translations),/Path-level/);
 const same=handwritten('ja');same.paths['/payments/{paymentIntentId}']={post:{operationId:'dummyPost',responses:{200:{description:'ok'}}}};
 assert.doesNotThrow(()=>buildOpenApi(same,generated,'ja',translations));
});

test('古い訳があるとき日英どちらのファイルも書かずに失敗する',()=>{
 const files={
  './fixtures/merchant-openapi.json':JSON.stringify(generated),
  './openapi-en/translations.json':JSON.stringify(Object.fromEntries(Object.entries(translations).map(([k,v],i)=>[k,i?v:{...v,source:v.source+'変更'}]))),
  '../docs-site/openapi/handwritten.ja.yaml':readFileSync('docs-site/openapi/handwritten.ja.yaml','utf8'),
  '../docs-site/openapi/handwritten.en.yaml':readFileSync('docs-site/openapi/handwritten.en.yaml','utf8'),
 };
 const written=[];
 assert.throws(()=>runBuild({argv:[],read:path=>files[path],write:(destination)=>written.push(destination)}),/stale translation/);
 assert.deepEqual(written,[]);
});

test('エラー表の検証はエラー応答の説明だけに限り他の説明の表は通常の文として訳す',()=>{
 const changed=structuredClone(generated);
 const [name,schema]=Object.entries(changed.components.schemas).find(([,value])=>typeof value.description==='string');
 schema.description='| Value | Meaning |\n| --- | --- |\n| a | b |';
 const key=`schemas.${name}.description`;
 assert.doesNotThrow(()=>translateGenerated(changed,{...translations,[key]:{source:schema.description,translation:'| Value | Meaning |\n| --- | --- |\n| a | B |'}}));
 const response=changed.paths['/payments/{paymentIntentId}'].get.responses['400'];
 response.description=response.description.replace('| code | meaning | action |','| Value | Meaning |');
 assert.throws(()=>translateGenerated(changed,translations),/Invalid error table/);
});

test('parityはpathsとoperationのresponses直下のx-拡張を拒否する',()=>{
 assert.ok(diffSpecs({paths:{'x-a':{}}},{paths:{'x-a':{}}}).length);
 assert.ok(diffSpecs({webhooks:{'x-a':{}}},{webhooks:{'x-a':{}}}).length);
 const op=()=>({paths:{'/a':{get:{responses:{'x-a':{description:'d'}}}}}});
 assert.ok(diffSpecs(op(),op()).length);
 const named=()=>({components:{schemas:{'x-a':{type:'string'}}},paths:{'/a':{get:{responses:{200:{description:'d',content:{'application/json':{examples:{'x-a':{value:1}}}}}}}}}});
 assert.deepEqual(diffSpecs(named(),named()),[]);
});
