import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {buildOpenApi, assertCompatibleDefinition} from './build-openapi.mjs';
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
 assert.deepEqual(actual.info,{...expected.info,version:'0.38.0'});assert.deepEqual(actual.security,expected.security);
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
