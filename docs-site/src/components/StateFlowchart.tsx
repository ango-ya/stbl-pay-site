import React, {createContext, useContext} from 'react';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
// 図の文字は M PLUS 1p。外部へ読みに行かないよう、パッケージから自前で配信する
import '@fontsource/m-plus-1p/400.css';
import '@fontsource/m-plus-1p/700.css';
import styles from './StateFlowchart.module.css';

// 図の中の文は日本語で書き、英語版では EN で引き直す。無い文は日本語のまま出る（下の検査で落とす）
const EN: Record<string, string> = {
  正常に進む流れ: 'Normal flow',
  'Webhook が届く': 'Webhook is sent',
  '届かない（状態照会で確認）': 'No Webhook (check status)',
  同じ印の場所へつながる: 'Continues at the same mark',
  利用者: 'Buyer',
  加盟店: 'Merchant',
  はい: 'Yes',
  いいえ: 'No',
  マイページで取り消す: 'cancels on My Page',
  取り消した: 'Canceled by buyer',
  'API で作成': 'creates via API',
  '決済を作成した・署名待ち': 'Created, awaiting approval',
  利用者が: 'Buyer',
  '承認した？': 'approved?',
  操作期限まで未承認: 'Not approved in time',
  パスキーで承認: 'approves with passkey',
  署名を受け取った: 'Signature received',
  操作期限に達した: 'Deadline reached',
  残高は: 'Balance',
  '足りる？': 'enough?',
  'はい：残高で払う': 'Yes: use balance',
  が確認: 'confirms',
  'JPYC EX の手続きへ進む': 'goes to JPYC EX',
  '予約開始を受けた・着金待ち': 'Reserved, awaiting deposit',
  期限内に支払える: 'Enough funds',
  '額がそろった？': 'by the deadline?',
  着金期限を過ぎた: 'Past deposit deadline',
  '振込む、': 'transfers,',
  が発行: 'issues',
  今の残高と合わせて足りればよい: 'Existing balance counts toward it',
  '着金・残高を確定した': 'Funds confirmed',
  実行の前に失敗: 'Failed before sending',
  結果が確定できない: 'Outcome unknown',
  ウォレットは: 'Wallet',
  '作成済み？': 'created?',
  ウォレットを作成: 'Creating wallet',
  作成して戻る: 'creates, returns',
  作成に失敗: 'Creation failed',
  送金を実行: 'sends JPYC',
  送金の結果を確認中: 'Checking send result',
  送金は: 'Send',
  '成功した？': 'succeeded?',
  送金に失敗: 'Send failed',
  支払いが成立した: 'Payment completed',
  加盟店が決済を作成: 'Created by merchant',
  期限まで未承認: 'Not approved',
  利用者がパスキーで承認: 'Approved with passkey',
  期限に達した: 'Timed out',
  '→ 印 A へ': '→ go to mark A',
  'JPYC EX へ進んだ': 'Went to JPYC EX',
  着金期限切れ: 'Deposit expired',
  振込む: 'transfers',
  残高と合算でもよい: 'Balance counts toward it',
  '着金・残高を確定': 'Funds confirmed',
  実行前に失敗: 'Not sent',
  確定できない: 'Unknown',
  '作成後に印 B へ': 'Then go to mark B',
  '失敗は failed': 'On failure: failed',
  'STBLpay が送金を実行': 'STBLpay sends JPYC',
  支払いが成立: 'Payment completed',
  'signed と、着金の前の issue_pending から': 'From signed, or issue_pending before the deposit,',
  '利用者が取り消すと canceled になります。': 'a buyer cancellation leads to canceled.',
  '決済の状態遷移のフローチャート。created から、利用者の承認、残高が足りるかどうか、着金、ウォレットの作成、送金の成否の分岐を経て、settled・failed・nonce_conflict・expired・canceled のどれかで終わります。':
    'Flowchart of payment status transitions. Starting from created, it branches on buyer approval, whether the balance is enough, the deposit, wallet creation and whether the send succeeded, and ends in settled, failed, nonce_conflict, expired or canceled.',
};

const LocaleContext = createContext<string>('ja');
function useT() {
  const en = useContext(LocaleContext) === 'en';
  return (t: string) => (en ? (EN[t] ?? t) : t);
}

type Kind = 'plain' | 'main' | 'settled' | 'fail' | 'warn' | 'muted';
type Hook = 'yes' | 'no' | null;

const BOX_CLASS: Record<Kind, string> = {
  plain: styles.box,
  main: `${styles.box} ${styles.boxMain}`,
  settled: `${styles.box} ${styles.boxSettled}`,
  fail: `${styles.box} ${styles.boxFail}`,
  warn: `${styles.box} ${styles.boxWarn}`,
  muted: `${styles.box} ${styles.boxMuted}`,
};

type BoxProps = {
  x: number;
  y: number;
  w: number;
  h: number;
  name: string;
  desc: string[];
  kind?: Kind;
  hook?: Hook;
  // 幅の狭い箱では、名前と重ならないよう Webhook の印を右下に置く
  hookBottom?: boolean;
};

// 状態（行き止まりの状態も同じ形で描く）。desc は 1 行ずつ
function StateBox({x, y, w, h, name, desc, kind = 'plain', hook = null, hookBottom = false}: BoxProps) {
  const t = useT();
  const on = kind === 'settled';
  const hy = hookBottom ? y + h - 14 : y + 14;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={4} className={BOX_CLASS[kind]} />
      <text x={x + 12} y={y + 21} className={`${styles.name} ${on ? styles.nameOn : ''}`}>
        {name}
      </text>
      {desc.map((line, i) => (
        <text key={line} x={x + 12} y={y + 39 + i * 16} className={`${styles.desc} ${on ? styles.descOn : ''}`}>
          {t(line)}
        </text>
      ))}
      {hook === 'yes' ? (
        <circle cx={x + w - 14} cy={hy} r={5.5} className={on ? styles.hookYesOn : styles.hookYes} />
      ) : null}
      {hook === 'no' ? <circle cx={x + w - 14} cy={hy} r={5.5} className={styles.hookNo} /> : null}
    </g>
  );
}

// 分岐。上下左右の頂点から線を出す
function Diamond({cx, cy, w, h, lines}: {cx: number; cy: number; w: number; h: number; lines: string[]}) {
  const t = useT();
  const top = cy - ((lines.length - 1) * 17) / 2 + 5;
  return (
    <g>
      <path d={`M${cx},${cy - h / 2} L${cx + w / 2},${cy} L${cx},${cy + h / 2} L${cx - w / 2},${cy} Z`} className={styles.diamond} />
      {lines.map((line, i) => (
        <text key={line} x={cx} y={top + i * 17} textAnchor="middle" className={styles.question}>
          {t(line)}
        </text>
      ))}
    </g>
  );
}

// 別の場所の同じ印へつながる、の印
function Mark({x, y, letter}: {x: number; y: number; letter: string}) {
  return (
    <g>
      <circle cx={x} cy={y} r={9} className={styles.mark} />
      <text x={x} y={y + 4} textAnchor="middle" className={styles.markText}>
        {letter}
      </text>
    </g>
  );
}

type LineKind = 'main' | 'thin' | 'fail' | 'warn';

function Defs({p}: {p: string}) {
  const head = (id: LineKind, cls: string, s: number) => (
    <marker id={`${p}-${id}`} viewBox="0 0 10 10" refX={HEAD_REF_X} refY="5" markerWidth={s} markerHeight={s} markerUnits="userSpaceOnUse" orient="auto">
      <path d="M0,0 L10,5 L0,10 z" className={cls} />
    </marker>
  );
  return (
    <defs>
      {head('main', styles.hMain, HEAD_SIZE.main)}
      {head('thin', styles.hThin, HEAD_SIZE.thin)}
      {head('fail', styles.hFail, HEAD_SIZE.fail)}
      {head('warn', styles.hWarn, HEAD_SIZE.warn)}
    </defs>
  );
}

const LINE_CLASS = {main: styles.lMain, thin: styles.lThin, fail: styles.lFail, warn: styles.lWarn};
const HEAD_SIZE: Record<LineKind, number> = {main: 8, thin: 7, fail: 7, warn: 7};
// 線は行き先の 3px 手前で止めている（`H${CX - 3}` など）。矢じりの先端をその 3px 先、行き先の縁に合わせる
const GAP = 3;
// 矢じり（0〜10 の座標で、先端は 10）の根元から 1 の位置を、線の終点に合わせる
const HEAD_REF_X = 1;
// 線の終点を戻す距離。戻した終点から先端までが (10 - HEAD_REF_X) / 10 × 大きさなので、先端が元の終点の GAP 先に来る
const trimBy = (k: LineKind) => ((10 - HEAD_REF_X) * HEAD_SIZE[k]) / 10 - GAP;

// 線の終わりを矢じりの中まで戻す。先端まで線を引くと、細くなった矢じりの先から線がはみ出して点に見える。
// 経路は M・H・V・A だけで書いているので、最後の H か V を短くすればよい
function trimEnd(d: string, by: number): string {
  const m = d.match(/^(.*?)([HV])(-?[\d.]+)\s*$/s);
  if (!m) return d;
  const [, before, cmd, value] = m;
  const prev = [...before.matchAll(/([MHVA])([^MHVA]*)/g)];
  let x = 0;
  let y = 0;
  for (const [, c, args] of prev) {
    const n = args.split(/[\s,]+/).filter(Boolean).map(Number);
    if (c === 'M') [x, y] = n;
    if (c === 'H') x = n[0];
    if (c === 'V') y = n[0];
    if (c === 'A') [x, y] = n.slice(-2);
  }
  const to = Number(value);
  const from = cmd === 'H' ? x : y;
  return `${before}${cmd}${to - Math.sign(to - from) * by}`;
}

function Line({p, d, kind, head = true}: {p: string; d: string; kind: LineKind; head?: boolean}) {
  return (
    <path
      d={head ? trimEnd(d, trimBy(kind)) : d}
      className={LINE_CLASS[kind]}
      markerEnd={head ? `url(#${p}-${kind})` : undefined}
    />
  );
}

type Anchor = 'start' | 'middle' | 'end';
function Label({x, y, lines, anchor = 'start', strong = false}: {x: number; y: number; lines: string[]; anchor?: Anchor; strong?: boolean}) {
  const t = useT();
  return (
    <g>
      {lines.map((line, i) => (
        <text key={line} x={x} y={y + i * 16} textAnchor={anchor} className={strong ? styles.labelStrong : styles.label}>
          {t(line)}
        </text>
      ))}
    </g>
  );
}

// 1 つの分岐から 2 つの行き止まりへ分ける線（縦に並べた 2 つへ）
function Fork({p, sx, sy, fx, tx, ys, kinds}: {p: string; sx: number; sy: number; fx: number; tx: number; ys: number[]; kinds: LineKind[]}) {
  return (
    <g>
      <Line p={p} kind="thin" d={`M${sx},${sy} H${fx}`} head={false} />
      <Line p={p} kind="thin" d={`M${fx},${Math.min(...ys)} V${Math.max(...ys)}`} head={false} />
      {ys.map((y, i) => (
        <Line key={y} p={p} kind={kinds[i]} d={`M${fx},${y} H${tx - 3}`} />
      ))}
    </g>
  );
}

// 誰の操作か（利用者・加盟店・STBLpay・JPYC EX）。色に加えて名前を書くので、色だけに頼らない
type Who = 'user' | 'merchant' | 'stbl' | 'issuer';
const WHO: Record<Who, {name: string; w: number; cls: string; tcls: string}> = {
  user: {name: '利用者', w: 48, cls: styles.whoUser, tcls: styles.whoUserText},
  merchant: {name: '加盟店', w: 48, cls: styles.whoMerchant, tcls: styles.whoMerchantText},
  stbl: {name: 'STBLpay', w: 60, cls: styles.whoStbl, tcls: styles.whoStblText},
  issuer: {name: 'JPYC EX', w: 62, cls: styles.whoIssuer, tcls: styles.whoIssuerText},
};

// 文字幅の目安（全角 12.5px・半角 7px）
const textW = (t: string) => [...t].reduce((n, c) => n + (c.charCodeAt(0) > 0xff ? 12.5 : 7), 0);

// 誰の印の幅。英語は名前の長さから決める（日本語は WHO の幅のまま）
const whoW = (who: Who, t: (s: string) => string) => (t(WHO[who].name) === WHO[who].name ? WHO[who].w : textW(t(WHO[who].name)) + 14);

// 「はい」などの前置き、誰の印、操作の説明を 1 行に並べる。y は文字のベースライン
function Act({x, y, who, text, pre}: {x: number; y: number; who: Who; text?: string; pre?: string}) {
  const t = useT();
  const a = WHO[who];
  const w = whoW(who, t);
  const px = pre ? x + textW(t(pre)) + 6 : x;
  return (
    <g>
      {pre ? <Label x={x} y={y} lines={[pre]} /> : null}
      <rect x={px} y={y - 13} width={w} height={18} rx={9} className={`${styles.who} ${a.cls}`} />
      <text x={px + w / 2} y={y} textAnchor="middle" className={`${styles.whoText} ${a.tcls}`}>
        {t(a.name)}
      </text>
      {text ? <Label x={px + w + 6} y={y} lines={[text]} /> : null}
    </g>
  );
}

function Legend({x, y, p, marks = false}: {x: number; y: number; p: string; marks?: boolean}) {
  return (
    <g>
      <Line p={p} kind="main" d={`M${x},${y} H${x + 36}`} />
      <Label x={x + 46} y={y + 4} lines={['正常に進む流れ']} />
      <circle cx={x + 5} cy={y + 28} r={5.5} className={styles.hookYes} />
      <Label x={x + 17} y={y + 32} lines={['Webhook が届く']} />
      <circle cx={x + 5} cy={y + 52} r={5.5} className={styles.hookNo} />
      <Label x={x + 17} y={y + 56} lines={['届かない（状態照会で確認）']} />
      {marks ? (
        <>
          <Mark x={x + 5} y={y + 80} letter="A" />
          <Label x={x + 20} y={y + 84} lines={['同じ印の場所へつながる']} />
        </>
      ) : null}
    </g>
  );
}

const TITLE =
  '決済の状態遷移のフローチャート。created から、利用者の承認、残高が足りるかどうか、着金、ウォレットの作成、送金の成否の分岐を経て、settled・failed・nonce_conflict・expired・canceled のどれかで終わります。';

const CANCEL_NOTE = ['signed と、着金の前の issue_pending から', '利用者が取り消すと canceled になります。'];

// 横長（本文の幅が 760px 以上のとき）
function Desktop() {
  const p = 'sfd';
  const BX = 230; // 状態の箱の左端
  const BW = 200;
  const MX = BX + BW / 2; // 中心の縦線
  const DW = 220;
  const DH = 60;
  const DL = MX - DW / 2; // 分岐の左の頂点
  const DR = MX + DW / 2; // 分岐の右の頂点
  const CX = 590; // 右の行き止まりの箱
  const CW = 160;
  const CH = 48;
  const FX = 520; // 分ける線の縦の位置
  const H = 50;
  const G = 32; // 縦の矢印の長さ
  const LX = MX - 10; // 縦線の左のラベル（右寄せ）
  const chip = (cy: number) => cy - CH / 2;
  // 上から順に、箱の上端（y）と分岐の中心（c）
  const yCreated = 16;
  const c1 = yCreated + H + G + DH / 2;
  const ySigned = c1 + DH / 2 + G;
  const c2 = ySigned + H + G + DH / 2;
  const yIssue = c2 + DH / 2 + G + 4;
  const c3 = yIssue + H + G + DH / 2;
  // 「はい」の矢印には 2 行のラベルを置くので、ほかの矢印より長くする
  const yConf = c3 + DH / 2 + G + 22;
  const c4 = yConf + H + G + DH / 2;
  const yExec = c4 + DH / 2 + G;
  const c5 = yExec + H + G + DH / 2;
  const ySettled = c5 + DH / 2 + G;
  const down = (from: number, to: number) => `M${MX},${from} V${to - 3}`;
  const yDeploy = c4 - H / 2;
  const t = useT();
  return (
    <svg className={styles.desktop} viewBox={`0 0 760 ${ySettled + H + 16}`} role="img" aria-label={t(TITLE)}>
      <title>{t(TITLE)}</title>
      <Defs p={p} />
      <Legend x={20} y={c5 + 20} p={p} />

      {/* 取消：signed・issue_pending から利用者がマイページで。2 本の線の代わりに括弧でまとめる */}
      <path d={`M${BX},${ySigned + H / 2} H205 V${yIssue + H / 2} H${BX}`} className={styles.group} />
      <Line p={p} kind="thin" d={`M205,${ySigned + H / 2 + 34} H185 V${c1 + 5} H163`} />
      <Act x={20} y={c1 - 32} who="user" text="マイページで取り消す" />
      <StateBox x={20} y={c1 - 20} w={140} h={H} name="canceled" desc={['取り消した']} kind="muted" hook="yes" />

      {/* 加盟店が作成 → created → 承認 → signed */}
      <Line p={p} kind="thin" d={`M580,${yCreated + H / 2} H${BX + BW + 3}`} />
      <Act x={444} y={yCreated + H / 2 - 9} who="merchant" text="API で作成" />
      <StateBox x={BX} y={yCreated} w={BW} h={H} name="created" desc={['決済を作成した・署名待ち']} kind="main" />
      <Line p={p} kind="main" d={down(yCreated + H, c1 - DH / 2)} />
      <Diamond cx={MX} cy={c1} w={DW} h={DH} lines={['利用者が', '承認した？']} />
      <Line p={p} kind="thin" d={`M${DR},${c1} H${CX - 3}`} />
      <Label x={(DR + CX) / 2} y={c1 - 8} anchor="middle" lines={['いいえ']} />
      <StateBox x={CX} y={chip(c1)} w={CW} h={CH} name="expired" desc={['操作期限まで未承認']} kind="muted" hook="yes" />
      <Line p={p} kind="main" d={down(c1 + DH / 2, ySigned)} />
      <Act x={MX + 10} y={ySigned - 11} pre="はい" who="user" text="パスキーで承認" />
      <StateBox x={BX} y={ySigned} w={BW} h={H} name="signed" desc={['署名を受け取った']} kind="main" />
      <Line p={p} kind="thin" d={`M${BX + BW},${ySigned + H / 2} H${CX - 3}`} />
      <StateBox x={CX} y={chip(ySigned + H / 2)} w={CW} h={CH} name="expired" desc={['操作期限に達した']} kind="muted" hook="yes" />

      {/* 残高は足りる？ */}
      <Line p={p} kind="main" d={down(ySigned + H, c2 - DH / 2)} />
      <Diamond cx={MX} cy={c2} w={DW} h={DH} lines={['残高は', '足りる？']} />
      {/* 取消の括弧（x=205）と交わるところは、半円で飛び越える */}
      <Line p={p} kind="main" d={`M${DL},${c2} H212 A7,7 0 0 0 198,${c2} H60 V${yConf + 18} H${BX - 3}`} />
      <Label x={70} y={c2 - 30} lines={['はい：残高で払う']} strong />
      <Act x={70} y={c2 - 10} who="stbl" text="が確認" />
      <Line p={p} kind="main" d={down(c2 + DH / 2, yIssue)} />
      <Act x={MX + 10} y={yIssue - 13} pre="いいえ" who="user" text="JPYC EX の手続きへ進む" />

      {/* 振込の経路 */}
      <StateBox x={BX} y={yIssue} w={BW} h={H} name="issue_pending" desc={['予約開始を受けた・着金待ち']} />
      <Line p={p} kind="main" d={down(yIssue + H, c3 - DH / 2)} />
      <Diamond cx={MX} cy={c3} w={DW} h={DH} lines={['期限内に支払える', '額がそろった？']} />
      <Line p={p} kind="thin" d={`M${DR},${c3} H${CX - 3}`} />
      <Label x={(DR + CX) / 2} y={c3 - 8} anchor="middle" lines={['いいえ']} />
      <StateBox x={CX} y={chip(c3)} w={CW} h={CH} name="expired" desc={['着金期限を過ぎた']} kind="muted" hook="yes" />
      {/* 着金は取り消されない状態になるまで issue_pending のまま待ち、deposit_confirmed へ 1 度に進む */}
      <Line p={p} kind="main" d={down(c3 + DH / 2, yConf)} />
      <Act x={MX + 10} y={c3 + DH / 2 + 22} pre="はい" who="user" text="振込む、" />
      <Act x={MX + 10 + textW(t('はい')) + 6 + whoW('user', t) + 6 + textW(t('振込む、')) + 4} y={c3 + DH / 2 + 22} who="issuer" text="が発行" />
      <Label x={MX + 10 + textW(t('はい')) + 6} y={c3 + DH / 2 + 42} lines={['今の残高と合わせて足りればよい']} />

      {/* 実行の前 */}
      <StateBox x={BX} y={yConf} w={BW} h={H} name="deposit_confirmed" desc={['着金・残高を確定した']} kind="main" />
      <Fork p={p} sx={BX + BW} sy={yConf + H / 2} fx={FX} tx={CX} ys={[yConf - 3, yConf + 53]} kinds={['fail', 'warn']} />
      <StateBox x={CX} y={chip(yConf - 3)} w={CW} h={CH} name="failed" desc={['実行の前に失敗']} kind="fail" hook="yes" />
      <StateBox x={CX} y={chip(yConf + 53)} w={CW} h={CH} name="nonce_conflict" desc={['結果が確定できない']} kind="warn" hook="no" />
      <Line p={p} kind="main" d={down(yConf + H, c4 - DH / 2)} />
      <Diamond cx={MX} cy={c4} w={DW} h={DH} lines={['ウォレットは', '作成済み？']} />
      <Line p={p} kind="thin" d={`M${DL},${c4} H163`} />
      <Label x={190} y={c4 - 8} anchor="middle" lines={['いいえ']} />
      <StateBox x={20} y={yDeploy} w={140} h={H} name="deploying" desc={['ウォレットを作成']} />
      <Line p={p} kind="thin" d={`M90,${yDeploy} V${yConf + 40} H${BX - 3}`} />
      <Act x={96} y={(yConf + 40 + yDeploy) / 2 + 5} who="stbl" text="作成して戻る" />
      <Line p={p} kind="fail" d={`M90,${yDeploy + H} V${yDeploy + H + 20}`} />
      <StateBox x={20} y={yDeploy + H + 23} w={140} h={CH} name="failed" desc={['作成に失敗']} kind="fail" hook="yes" />

      {/* 実行 */}
      <Line p={p} kind="main" d={down(c4 + DH / 2, yExec)} />
      <Act x={MX + 10} y={yExec - 11} pre="はい" who="stbl" text="送金を実行" />
      <StateBox x={BX} y={yExec} w={BW} h={H} name="executing" desc={['送金の結果を確認中']} kind="main" />
      <Line p={p} kind="main" d={down(yExec + H, c5 - DH / 2)} />
      <Diamond cx={MX} cy={c5} w={DW} h={DH} lines={['送金は', '成功した？']} />
      <Fork p={p} sx={DR} sy={c5} fx={FX} tx={CX} ys={[c5 - 28, c5 + 28]} kinds={['fail', 'warn']} />
      <Label x={(DR + FX) / 2} y={c5 - 8} anchor="middle" lines={['いいえ']} />
      <StateBox x={CX} y={chip(c5 - 28)} w={CW} h={CH} name="failed" desc={['送金に失敗']} kind="fail" hook="yes" />
      <StateBox x={CX} y={chip(c5 + 28)} w={CW} h={CH} name="nonce_conflict" desc={['結果が確定できない']} kind="warn" hook="no" />
      <Line p={p} kind="main" d={down(c5 + DH / 2, ySettled)} />
      <Label x={LX} y={ySettled - 11} anchor="end" lines={['はい']} />
      <StateBox x={BX} y={ySettled} w={BW} h={H} name="settled" desc={['支払いが成立した']} kind="settled" hook="yes" />
    </svg>
  );
}

// 縦長（本文の幅が足りないとき）。右へ線を引く余白が無いので、残高払いの合流と
// ウォレット作成の戻りは、線ではなく印（A・B）でつなぐ
function Mobile() {
  const p = 'sfm';
  const BX = 4;
  const BW = 162;
  const MX = BX + BW / 2;
  const DW = 162;
  const DH = 76;
  const DR = MX + DW / 2;
  const CX = 202;
  const CW = 134;
  const CH = 48;
  const FX = 184;
  const H = 52;
  const chip = (cy: number) => cy - CH / 2;
  const yes = (y: number, text = 'はい') => <Label x={MX + 8} y={y} lines={[text]} />;
  const t = useT();
  return (
    <svg className={styles.mobile} viewBox="0 0 340 1390" role="img" aria-label={t(TITLE)}>
      <title>{t(TITLE)}</title>
      <Defs p={p} />

      <StateBox x={BX} y={10} w={BW} h={H} name="created" desc={['加盟店が決済を作成']} kind="main" />
      <Line p={p} kind="main" d={`M${MX},62 V89`} />
      <Diamond cx={MX} cy={130} w={DW} h={DH} lines={['利用者が', '承認した？']} />
      <Line p={p} kind="thin" d={`M${DR},130 H${CX - 3}`} />
      <StateBox x={CX} y={chip(130)} w={CW} h={CH} name="expired" desc={['期限まで未承認']} kind="muted" hook="yes" hookBottom />
      <Line p={p} kind="main" d={`M${MX},168 V195`} />
      <Act x={MX + 8} y={186} pre="はい" who="user" />
      <StateBox x={BX} y={198} w={BW} h={H} name="signed" desc={['利用者がパスキーで承認']} kind="main" />
      <Mark x={BX + BW - 14} y={212} letter="C" />
      <Line p={p} kind="thin" d={`M${BX + BW},224 H${CX - 3}`} />
      <StateBox x={CX} y={chip(224)} w={CW} h={CH} name="expired" desc={['期限に達した']} kind="muted" hook="yes" hookBottom />

      <Line p={p} kind="main" d={`M${MX},250 V277`} />
      <Diamond cx={MX} cy={318} w={DW} h={DH} lines={['残高は', '足りる？']} />
      <Line p={p} kind="main" d={`M${DR},318 H${CX - 3}`} />
      <rect x={CX} y={chip(318)} width={CW} height={CH} rx={CH / 2} className={styles.group} />
      <Label x={CX + 14} y={chip(318) + 20} lines={['はい：残高で払う']} strong />
      <Label x={CX + 14} y={chip(318) + 38} lines={['→ 印 A へ']} />
      <Mark x={CX + CW - 14} y={chip(318) + 34} letter="A" />
      <Line p={p} kind="main" d={`M${MX},356 V383`} />
      <Act x={MX + 8} y={374} pre="いいえ" who="user" />

      <StateBox x={BX} y={386} w={BW} h={H} name="issue_pending" desc={['JPYC EX へ進んだ']} />
      <Mark x={BX + BW - 14} y={400} letter="C" />
      <Line p={p} kind="main" d={`M${MX},438 V465`} />
      <Diamond cx={MX} cy={506} w={DW} h={DH} lines={['期限内に支払える', '額がそろった？']} />
      <Line p={p} kind="thin" d={`M${DR},506 H${CX - 3}`} />
      <StateBox x={CX} y={chip(506)} w={CW} h={CH} name="expired" desc={['着金期限切れ']} kind="muted" hook="yes" hookBottom />
      <Line p={p} kind="main" d={`M${MX},544 V659`} />
      <Act x={MX + 8} y={568} pre="はい" who="user" text="振込む" />
      <Act x={MX + 8} y={592} who="issuer" text="が発行" />
      <Label x={MX + 8} y={616} lines={['残高と合算でもよい']} />

      <StateBox x={BX} y={662} w={BW} h={H} name="deposit_confirmed" desc={['着金・残高を確定']} kind="main" />
      <Mark x={BX + BW - 34} y={652} letter="A" />
      <Mark x={BX + BW - 12} y={652} letter="B" />
      <Fork p={p} sx={BX + BW} sy={688} fx={FX} tx={CX} ys={[662, 716]} kinds={['fail', 'warn']} />
      <StateBox x={CX} y={chip(662)} w={CW} h={CH} name="failed" desc={['実行前に失敗']} kind="fail" hook="yes" hookBottom />
      <StateBox x={CX} y={chip(716)} w={CW} h={CH} name="nonce_conflict" desc={['確定できない']} kind="warn" hook="no" hookBottom />
      <Line p={p} kind="main" d={`M${MX},714 V747`} />
      <Diamond cx={MX} cy={788} w={DW} h={DH} lines={['ウォレットは', '作成済み？']} />
      <Line p={p} kind="thin" d={`M${DR},788 H${CX - 3}`} />
      <StateBox x={CX} y={758} w={CW} h={70} name="deploying" desc={['作成後に印 B へ', '失敗は failed']} />
      <Mark x={CX + CW - 14} y={772} letter="B" />
      <Line p={p} kind="main" d={`M${MX},826 V853`} />
      <Act x={MX + 8} y={844} pre="はい" who="stbl" />

      <StateBox x={BX} y={856} w={BW} h={H} name="executing" desc={['STBLpay が送金を実行']} kind="main" />
      <Line p={p} kind="main" d={`M${MX},908 V935`} />
      <Diamond cx={MX} cy={976} w={DW} h={DH} lines={['送金は', '成功した？']} />
      <Fork p={p} sx={DR} sy={976} fx={FX} tx={CX} ys={[950, 1004]} kinds={['fail', 'warn']} />
      <StateBox x={CX} y={chip(950)} w={CW} h={CH} name="failed" desc={['送金に失敗']} kind="fail" hook="yes" hookBottom />
      <StateBox x={CX} y={chip(1004)} w={CW} h={CH} name="nonce_conflict" desc={['確定できない']} kind="warn" hook="no" hookBottom />
      <Line p={p} kind="main" d={`M${MX},1014 V1047`} />
      {yes(1038)}
      <StateBox x={BX} y={1050} w={BW} h={H} name="settled" desc={['支払いが成立']} kind="settled" hook="yes" />

      {/* 取消は signed・issue_pending から。線を引く余白が無いので印 C でつなぐ */}
      <Act x={BX} y={1132} who="user" text="マイページで取り消す" />
      <StateBox x={BX} y={1140} w={BW} h={H} name="canceled" desc={['取り消した']} kind="muted" hook="yes" />
      <Mark x={BX + BW + 16} y={1166} letter="C" />
      <Label x={BX} y={1218} lines={CANCEL_NOTE} />
      <Legend x={BX + 2} y={1272} p={p} marks />
    </svg>
  );
}

export default function StateFlowchart() {
  const {i18n} = useDocusaurusContext();
  return (
    <LocaleContext.Provider value={i18n.currentLocale}>
      <div className={styles.root}>
        <Desktop />
        <Mobile />
      </div>
    </LocaleContext.Provider>
  );
}
