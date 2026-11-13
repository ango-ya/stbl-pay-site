// Backend export:merchant-openapi の出力を入力にする。既存決済APIの説明は維持する。
import {readFileSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const yaml=createRequire(new URL('../docs-site/package.json',import.meta.url))('js-yaml');
const source=JSON.parse(readFileSync(new URL('./fixtures/merchant-openapi-0.32.0.json',import.meta.url)));
for(const file of ['docs-site/static/openapi.yaml','docs-site/i18n/en/openapi.yaml']) {
 const spec=yaml.load(readFileSync(file,'utf8'));const en=file.includes('/i18n/');
 spec.info.version='0.32.0-feat-647-machine-refund.146';
 spec.info.description=spec.info.description.replace(/    /g,'').split('\n').filter(l=>!l.includes('返金 API はありません')&&!l.includes('refund API')&&!l.includes('Machine refund endpoints are draft')&&!l.includes('machine返金エンドポイントは公開準備中')).join('\n').trimEnd();
 spec.info.description+='\n'+(en?'Machine refund endpoints are draft for preview review; production availability is not announced.':'machine返金エンドポイントは公開準備中のpreview仕様で、本番提供開始の案内ではありません。');
 for(const [path,methods] of Object.entries(source.paths)) for(const [method,op] of Object.entries(methods)) if(op['x-auth-scheme']==='machine-signature') {
  const next=structuredClone(op);next.operationId=method+'Machine'+path.replace(/[^a-zA-Z]/g,'');
  if(en){next.description='Draft: P-256/SHA-256 signature of METHOD + newline + originalUrl including query + newline + sha256hex(rawBody) + newline + timestamp + newline + nonce. Empty bytes for absent body. Signature: raw r||s hex128. Timestamp: milliseconds (±60000ms). Nonce: lowercase 0x + 32 bytes. No Authorization header.';for(const response of Object.values(next.responses))response.description='Success';}
  spec.paths[path]??={};spec.paths[path][method]=next;
 }
 if(source.components?.schemas) {
  Object.assign(spec.components.schemas,source.components.schemas);
  spec.webhooks.paymentEvent.post.requestBody.content['application/json'].schema.oneOf[0] = {$ref:'#/components/schemas/WebhookEventPayload'};
  spec.webhooks.paymentEvent.post.description = spec.webhooks.paymentEvent.post.description.split('\n').filter(l=>!l.startsWith('Draft preview adds refund.confirmed')&&!l.startsWith('公開準備中の仕様でrefund.confirmed')).join('\n').trimEnd() + '\n'+(en?'Draft preview adds refund.confirmed and refund.failed with dedicated refund data; do not parse these as payment data.':'公開準備中の仕様でrefund.confirmedとrefund.failedを追加します。専用の返金dataを決済dataとして検証しないでください。');
 }
 writeFileSync(file,yaml.dump(spec,{lineWidth:120,noRefs:true}));
}
