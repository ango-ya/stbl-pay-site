import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {diffSpecs} from './openapi-parity.mjs';
const yaml=createRequire(new URL('../docs-site/package.json',import.meta.url))('js-yaml');
const source=JSON.parse(readFileSync(new URL('./fixtures/merchant-openapi-0.32.0.json',import.meta.url)));
const ja=yaml.load(readFileSync('docs-site/static/openapi.yaml','utf8'));
const en=yaml.load(readFileSync('docs-site/i18n/en/openapi.yaml','utf8'));
test('Japanese and English specification parity',()=>assert.deepEqual(diffSpecs(ja,en),[]));
test('all machine paths and schemas match backend generated export',()=>{
 let count=0;
 for(const [path,methods] of Object.entries(source.paths))for(const [method,op] of Object.entries(methods))if(op['x-auth-scheme']==='machine-signature'){
 count++;
 const actual=structuredClone(ja.paths[path][method]);delete actual.operationId;
 assert.deepEqual(actual,op);
 }
 assert.equal(count,6);
});

test('webhook union is generated from the shared schema',()=>{
 assert.deepEqual(ja.components.schemas.WebhookEventPayload,source.components.schemas.WebhookEventPayload);
 assert.equal(ja.webhooks.paymentEvent.post.requestBody.content['application/json'].schema.oneOf[0].$ref,'#/components/schemas/WebhookEventPayload');
 const union=source.components.schemas.WebhookEventPayload.oneOf;
 assert.equal(union.length,6);
 assert.deepEqual(union.slice(-2).map(v=>v.properties.type.const),['refund.confirmed','refund.failed']);
});
