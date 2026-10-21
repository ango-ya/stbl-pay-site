(function () {
  "use strict";
  // すてぶるくん・すてぶるちゃんを「生きている」ように動かす（依存ゼロ・CSP/Trusted Types内）。
  // 動かすのは「クラスの付け外し」と「img の src の差し替え」だけ（インラインの指定も、HTML の組み立ても使わない）。
  // - 画面に入っていて、タブが表示中のときだけ is-live を付けてタイマーを回す。外れたら全部止める
  // - すてぶるくん（.kun-rig）：まばたき・目線・ヒーローで 1 回だけ手を振る（呼吸と腕の揺れは CSS が is-live で動かす）
  // - すてぶるちゃん（img[data-chan]）：ウインク・登場のポーズ送り・会話に合わせて手を伸ばす
  // - 会話（.talk）：画面に入ったら 1 回だけ、上の行から順に口パク。立ち絵とも連動する
  //   （再生中に画面外へ出たら打ち切り、タブが隠れたら止めて表示に戻ったら最初から）
  // - すぐには要らないコマの先読みは、ページの読み込みが終わってから（ヒーローの登場に使う絵だけはすぐ読む）
  // - 差し替えるコマは先に読み込んでおき、読み込み済みのものだけ使う（ちらつき防止）
  // - IntersectionObserver が無いときは何もしない（絵は止まったまま）
  // - prefers-reduced-motion: 体が動くもの（呼吸・腕の揺れ・手を振る・登場のポーズ送り）を止める。まばたき・口パク・目線は残す
  // 素材の名前と動きの決まりは README の「キャラクターの素材と動き」を参照。

  if (!("IntersectionObserver" in window)) {
    return;
  }

  const T0 = performance.now();
  const INTRO_WINDOW = 800; // スクリプト開始からこの間に初めて見えたときだけ、登場の動き（手振り・ポーズ送り）をする
  const EXT = ".webp";
  const EN = /^en/i.test(document.documentElement.lang || "");
  const REDUCE = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  const reduced = () => !!(REDUCE && REDUCE.matches);

  const rand = (min, max) => min + Math.random() * (max - min);
  const pick = (list) => list[Math.floor(Math.random() * list.length)];
  const pickWeighted = (items, weights) => {
    let total = 0;
    weights.forEach((w) => {
      total += w;
    });
    let r = Math.random() * total;
    for (let i = 0; i < items.length; i++) {
      r -= weights[i];
      if (r < 0) {
        return items[i];
      }
    }
    return items[items.length - 1];
  };

  // 画像の場所は、その img の src の最後の "/" まで（日本語は相対、英語は絶対パスなので決め打ちしない）
  const dirOf = (img) => {
    const src = img.getAttribute("src") || "";
    return src.slice(0, src.lastIndexOf("/") + 1);
  };

  // ページの読み込みが終わってから呼ぶ（すぐには要らないコマの先読みで、最初の表示の邪魔をしない）
  const afterLoad = (fn) => {
    if (document.readyState === "complete") {
      fn();
    } else {
      window.addEventListener("load", fn, { once: true });
    }
  };

  // 先読み：同じ URL は 1 回だけ読む。読めたものだけ loaded に入る
  const loaded = new Set();
  const loading = new Map();
  const preload = (url) => {
    let entry = loading.get(url);
    if (!entry) {
      const img = new Image();
      img.fetchPriority = "low"; // 対応していないブラウザでは何も起きない
      const promise = new Promise((resolve) => {
        img.onload = () => {
          loaded.add(url);
          resolve(true);
          // 最初の差し替えで描画が遅れないよう、手が空いたところでデコードもしておく
          if (img.decode) {
            img.decode().catch(() => {});
          }
        };
        img.onerror = () => resolve(false);
      });
      img.src = url;
      entry = { img, promise }; // img を持っておく（読み込んだ絵を手放さない）
      loading.set(url, entry);
    }
    return entry.promise;
  };

  // 読み込み済みのコマだけ差し替える（force は、もともとページにあった絵に戻すとき）
  const swap = (img, url, force) => {
    if (img.getAttribute("src") === url) {
      return;
    }
    if (force || loaded.has(url)) {
      img.setAttribute("src", url);
    }
  };

  // タイマーの束。clearAll で全部止める（待っている先読みの続きも取り消す）
  const makeTimers = () => {
    const ids = new Set();
    let generation = 0;
    const timers = {
      set(fn, ms) {
        const id = setTimeout(() => {
          ids.delete(id);
          fn();
        }, ms);
        ids.add(id);
        return id;
      },
      clear(id) {
        clearTimeout(id);
        ids.delete(id);
      },
      clearAll() {
        ids.forEach((id) => clearTimeout(id));
        ids.clear();
        generation++;
      },
      // 先読みが済むか maxMs 経つのを待って fn を呼ぶ
      settle(urls, maxMs, fn) {
        const mine = generation;
        let done = false;
        let timer = 0;
        const fire = () => {
          if (done || mine !== generation) {
            return;
          }
          done = true;
          timers.clear(timer);
          fn();
        };
        Promise.all(urls.map(preload)).then(fire);
        timer = timers.set(fire, maxMs);
      },
    };
    return timers;
  };

  // steps = [[実行する関数, 次までの ms], …]。最後の ms は使わず、終わったら done を呼ぶ
  const play = (timers, steps, done) => {
    let i = 0;
    const next = () => {
      const step = steps[i++];
      step[0]();
      if (i < steps.length) {
        timers.set(next, step[1]);
      } else if (done) {
        done();
      }
    };
    next();
  };

  const actors = new Map(); // 要素 → 役者（すてぶるくん・すてぶるちゃん）
  const talks = [];

  // 「生きている」＝画面に入っている かつ タブが表示中
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      const actor = actors.get(entry.target);
      if (actor) {
        actor.inView = entry.isIntersecting;
        actor.sync();
      }
    });
  });

  const register = (el, actor) => {
    actor.inView = false;
    actor.running = false;
    actor.sync = () => {
      const want = actor.inView && !document.hidden;
      if (want === actor.running) {
        return;
      }
      actor.running = want;
      if (want) {
        el.classList.add("is-live");
        actor.start();
      } else {
        el.classList.remove("is-live");
        actor.stop();
      }
    };
    actors.set(el, actor);
    io.observe(el);
  };

  // ---- すてぶるくん（.kun-rig[data-kun]） ----
  const VOWELS = ["a", "i", "o", "n"];

  const makeKun = (rig) => {
    const eyes = rig.querySelector(".kun-eyes");
    const mouth = rig.querySelector(".kun-mouth");
    if (!eyes || !mouth) {
      return null;
    }
    const hero = rig.getAttribute("data-kun") === "hero";
    const eyesDir = dirOf(eyes);
    const mouthDir = dirOf(mouth);
    const eyesRest = eyes.getAttribute("src"); // eyes-open
    const mouthRest = mouth.getAttribute("src"); // mouth-rest か mouth-o
    const eyeUrl = (name) => eyesDir + "eyes-" + name + EXT;
    const talkUrl = (vowel) => mouthDir + "mouth-talk-" + vowel + EXT;
    // すてぶるちゃんのいる側を多めに見る（ヒーローは右、立ち絵は左にいる）
    const lookMain = hero ? "right" : "left";
    const lookSub = hero ? "left" : "right";

    const tBlink = makeTimers();
    const tGaze = makeTimers();
    const tTalk = makeTimers();
    const tWave = makeTimers();
    let blinking = false;
    let gazing = false;
    let talking = false;
    let preloaded = false;
    let first = true;

    // まばたきと目線は重ならない。片方が動いている間はもう片方を後回しにする
    const scheduleBlink = () => {
      tBlink.set(blink, rand(2000, 5000));
    };
    const blink = () => {
      if (gazing || talking) {
        tBlink.set(blink, rand(250, 600));
        return;
      }
      blinking = true;
      play(
        tBlink,
        [
          [() => swap(eyes, eyeUrl("half")), 50],
          [() => swap(eyes, eyeUrl("closed")), 70],
          [() => swap(eyes, eyeUrl("half")), 50],
          [() => swap(eyes, eyesRest, true), 0],
        ],
        () => {
          blinking = false;
          scheduleBlink();
        }
      );
    };

    const scheduleGaze = () => {
      tGaze.set(gaze, rand(6000, 10000));
    };
    const gaze = () => {
      if (blinking || talking) {
        tGaze.set(gaze, rand(250, 600));
        return;
      }
      gazing = true;
      swap(eyes, eyeUrl(Math.random() < 0.7 ? lookMain : lookSub));
      tGaze.set(() => {
        swap(eyes, eyesRest, true);
        gazing = false;
        scheduleGaze();
      }, rand(900, 1300));
    };

    // ヒーローで 1 回だけ手を振る。animationend か 2200ms 後に外す
    const endWave = () => {
      tWave.clearAll();
      rig.classList.remove("is-waving");
    };
    const wave = () => {
      if (reduced()) {
        return;
      }
      rig.classList.add("is-waving");
      tWave.set(endWave, 2200);
    };
    rig.addEventListener("animationend", (event) => {
      if (event.animationName === "kun-wave") {
        endWave();
      }
    });

    // 話す：ms の間、口を mouth-talk-a/i/o/n から直前と違うものに替える。まばたき・目線は止める
    const endSpeak = () => {
      if (!talking) {
        return;
      }
      tTalk.clearAll();
      talking = false;
      swap(mouth, mouthRest, true);
      if (actor.running) {
        scheduleBlink();
        scheduleGaze();
      }
    };
    const speak = (ms) => {
      if (!actor.running) {
        return;
      }
      if (talking) {
        tTalk.clearAll(); // 続けて呼ばれたら話し直す
      } else {
        tBlink.clearAll();
        tGaze.clearAll();
        blinking = false;
        gazing = false;
        talking = true;
      }
      swap(eyes, eyesRest, true);
      let last = "";
      const tick = () => {
        const options = VOWELS.filter((v) => v !== last && loaded.has(talkUrl(v)));
        if (options.length) {
          last = pick(options);
          swap(mouth, talkUrl(last));
        }
        tTalk.set(tick, rand(90, 130));
      };
      tick();
      tTalk.set(endSpeak, ms);
    };

    const start = () => {
      if (!preloaded) {
        preloaded = true;
        afterLoad(() => {
          ["half", "closed", "left", "right"].forEach((name) => preload(eyeUrl(name)));
          VOWELS.forEach((v) => preload(talkUrl(v)));
        });
      }
      scheduleBlink();
      scheduleGaze();
      if (first) {
        first = false;
        if (hero && performance.now() - T0 <= INTRO_WINDOW && !reduced()) {
          tWave.set(wave, 1200);
        }
      }
    };

    // 止めたら全部のタイマーを捨て、目と口をもとの絵に戻す
    const stop = () => {
      [tBlink, tGaze, tTalk, tWave].forEach((timers) => timers.clearAll());
      blinking = false;
      gazing = false;
      talking = false;
      rig.classList.remove("is-waving");
      swap(eyes, eyesRest, true);
      swap(mouth, mouthRest, true);
    };

    const actor = {
      kind: "kun",
      start,
      stop,
      speak,
      hush: endSpeak,
      // 会話と連動するときに使うコマ（会話を始める前に先読みする）
      frames: () => VOWELS.map(talkUrl),
      onReduce() {
        if (reduced()) {
          endWave();
        }
      },
    };
    return actor;
  };

  // ---- すてぶるちゃん（img[data-chan]。太ももまでの絵） ----
  const makeChan = (img) => {
    const mode = img.getAttribute("data-chan");
    if (mode !== "hero" && mode !== "wink" && mode !== "greet") {
      return null;
    }
    const dir = dirOf(img);
    const url = (name) => dir + "thigh-" + name + EXT;
    const STAND = url("stand");
    const REACH = url("reach");
    const WINK = url("reach-wink");

    const tIntro = makeTimers();
    const tWink = makeTimers();
    const tReach = makeTimers();
    let preloaded = false;
    let first = true;
    let introducing = false;
    let introduced = false; // 登場のポーズ送りをした（途中で止まった場合も含む）。ヒーローはこの後だけウインクする

    // 7〜11 秒おきに 380ms だけウインク
    const scheduleWink = () => {
      tWink.set(() => {
        swap(img, WINK);
        tWink.set(() => {
          swap(img, REACH);
          scheduleWink();
        }, 380);
      }, rand(7000, 11000));
    };

    // 登場のポーズ送り（stand → reach → wink → reach）。ヒーローはまだ透明なうちに stand へ替える
    const finishIntro = () => {
      tIntro.clearAll();
      introducing = false;
      introduced = true;
      swap(img, REACH);
      if (actor.running) {
        scheduleWink();
      }
    };
    const intro = () => {
      introducing = true;
      tIntro.settle([STAND, REACH, WINK], 500, () => {
        swap(img, STAND);
        tIntro.set(() => swap(img, REACH), 1100);
        tIntro.set(() => swap(img, WINK), 1350);
        tIntro.set(finishIntro, 2300);
      });
    };

    // greet：話している間だけ手を伸ばす。話し終わって 600ms 後に立ち姿へ戻す
    const reach = (ms) => {
      if (mode !== "greet" || !actor.running) {
        return;
      }
      tReach.clearAll();
      swap(img, REACH);
      tReach.set(() => swap(img, STAND), ms + 600);
    };
    const hush = () => {
      if (mode !== "greet" || !actor.running) {
        return;
      }
      tReach.clearAll();
      swap(img, STAND);
    };

    const start = () => {
      if (!preloaded) {
        preloaded = true;
        if (mode === "hero") {
          // 登場のポーズ送りはフェードが終わるまでに要るので、すぐ読む（WINK は HTML の絵なので読み込み済み）
          [STAND, REACH, WINK].forEach(preload);
        } else {
          afterLoad(() => (mode === "wink" ? [REACH, WINK] : [STAND, REACH]).forEach(preload));
        }
      }
      if (mode === "wink") {
        scheduleWink();
      } else if (mode === "hero") {
        if (first) {
          first = false;
          if (performance.now() - T0 <= INTRO_WINDOW && !reduced()) {
            intro();
            return;
          }
        }
        if (introduced) {
          scheduleWink();
        }
      }
    };

    const stop = () => {
      [tIntro, tWink, tReach].forEach((timers) => timers.clearAll());
      if (introducing) {
        introducing = false;
        introduced = true;
      }
      if (mode === "greet") {
        swap(img, STAND);
      } else if (mode === "wink" || introduced) {
        swap(img, REACH);
      }
    };

    const actor = {
      kind: "chan",
      start,
      stop,
      reach,
      hush,
      // 会話と連動するときに使うコマ（会話を始める前に先読みする）
      frames: () => (mode === "greet" ? [STAND, REACH] : []),
      onReduce() {
        // 登場のポーズ送りの途中で reduce になったら、そこで切り上げる
        if (reduced() && introducing && actor.running) {
          finishIntro();
        }
      },
    };
    return actor;
  };

  // ---- 会話（.talk） ----
  // data-face → 休み・話す（差し替える候補）・まばたきのコマ（talk/ の中のファイル名、拡張子なし）
  const chanFace = (expr) => ({
    who: "chan",
    rest: "chan-" + expr + "-0",
    talk: [0, 1, 2].map((i) => "chan-" + expr + "-" + i),
    weights: [0.25, 0.4, 0.35],
    blink: "chan-blink-" + expr,
    step: [100, 140],
  });
  const kunFace = (rest, eyes, blink) => ({
    who: "kun",
    rest: "kun-" + rest,
    talk: VOWELS.map((v) => "kun-" + eyes + "-talk-" + v),
    weights: null,
    blink: "kun-" + blink,
    step: [90, 130],
  });
  const FACES = {
    "chan normal": chanFace("normal"),
    "chan proud": chanFace("proud"),
    "chan troubled": chanFace("troubled"),
    "chan serious": chanFace("serious"),
    "kun smile": kunFace("open-rest", "open", "closed-rest"),
    "kun o": kunFace("open-o", "open", "closed-o"),
    "kun wide": kunFace("wide-o", "wide", "closed-o"),
  };

  const makeTalk = (talk) => {
    const entries = [].slice.call(talk.querySelectorAll(".talk-line")).map((line) => {
      const img = line.querySelector("img.talk-face[data-face]");
      const key = img ? (img.getAttribute("data-face") || "").trim().replace(/\s+/g, " ") : "";
      const spec = FACES[key];
      const who = spec ? spec.who : line.classList.contains("talk-kun") ? "kun" : "chan";
      return {
        line,
        who,
        face: spec ? { img, spec, dir: dirOf(img), orig: img.getAttribute("src"), blinking: false, prev: "" } : null,
      };
    });
    if (!entries.length) {
      return null;
    }

    const tWait = makeTimers();
    const tPlay = makeTimers();
    const tMouth = makeTimers();
    const tBlink = makeTimers();
    let visible = false;
    let ratio = 0;
    let waiting = false;
    let playing = false;
    let played = false;
    let blinkOn = false;

    const faceUrl = (face, name) => face.dir + name + EXT;
    const frameUrls = () => {
      const urls = [];
      entries.forEach((entry) => {
        if (entry.face) {
          const spec = entry.face.spec;
          [spec.rest, spec.blink].concat(spec.talk).forEach((name) => urls.push(faceUrl(entry.face, name)));
        }
      });
      return urls;
    };
    // 休みのコマ。読めていなければ HTML に書いた絵に戻す（最後の口パクの絵を残さない）
    const toRest = (face) => {
      const url = faceUrl(face, face.spec.rest);
      if (loaded.has(url)) {
        swap(face.img, url);
      } else {
        swap(face.img, face.orig, true);
      }
    };
    const restAll = () => {
      entries.forEach((entry) => {
        if (entry.face) {
          toRest(entry.face);
        }
      });
    };

    // 立ち絵：同じセクションの .cast が表示されていれば、その中のすてぶるくん・すてぶるちゃんを連動させる
    const stands = () => {
      const section = talk.closest(".section");
      const cast = section ? section.querySelector(".cast") : null;
      if (!cast || cast.getClientRects().length === 0) {
        return {};
      }
      const rig = cast.querySelector(".kun-rig[data-kun]");
      const chan = cast.querySelector("img[data-chan]");
      return { kun: rig ? actors.get(rig) : null, chan: chan ? actors.get(chan) : null };
    };
    // 顔のコマと、立ち絵が会話に合わせて使うコマ（ページの読み込みが終わる前に会話が始まっても間に合うよう、一緒に先読みする）
    const playFrames = () => {
      const stand = stands();
      return frameUrls().concat(stand.kun ? stand.kun.frames() : [], stand.chan ? stand.chan.frames() : []);
    };

    // 話す時間：文字数（脚注記号は数えない）× 95ms（英語は 45ms）、700〜2600ms
    const durationOf = (entry) => {
      const text = entry.line.querySelector(".talk-text");
      const count = (text ? text.textContent : "").replace(/※[0-9０-９]*/g, "").replace(/\s+/g, " ").trim().length;
      return Math.min(2600, Math.max(700, count * (EN ? 45 : 95)));
    };

    // 顔の口パク。ちゃんは重み付き、くんは a/i/o/n から、どちらも直前と違うコマ
    const mouthStart = (face) => {
      const spec = face.spec;
      let last = spec.rest;
      const tick = () => {
        const names = [];
        const weights = [];
        spec.talk.forEach((name, i) => {
          if (name !== last && loaded.has(faceUrl(face, name))) {
            names.push(name);
            weights.push(spec.weights ? spec.weights[i] : 1);
          }
        });
        if (names.length) {
          last = pickWeighted(names, weights);
          swap(face.img, faceUrl(face, last));
        }
        tMouth.set(tick, rand(spec.step[0], spec.step[1]));
      };
      tick();
    };
    const mouthEnd = (face) => {
      tMouth.clearAll();
      toRest(face);
    };

    // 画面に入っている間（再生中は除く）、各顔が 3〜7 秒おきにまばたき（120ms）
    const scheduleBlink = (face) => {
      tBlink.set(() => {
        const frame = faceUrl(face, face.spec.blink);
        if (!loaded.has(frame)) {
          scheduleBlink(face);
          return;
        }
        face.prev = face.img.getAttribute("src");
        face.blinking = true;
        swap(face.img, frame);
        tBlink.set(() => {
          swap(face.img, face.prev, true);
          face.blinking = false;
          scheduleBlink(face);
        }, 120);
      }, rand(3000, 7000));
    };
    const stopBlinks = () => {
      tBlink.clearAll();
      entries.forEach((entry) => {
        const face = entry.face;
        if (face && face.blinking) {
          swap(face.img, face.prev, true);
          face.blinking = false;
        }
      });
    };
    const sync = () => {
      const want = visible && !document.hidden && !playing;
      if (want === blinkOn) {
        return;
      }
      blinkOn = want;
      if (want) {
        entries.forEach((entry) => {
          if (entry.face) {
            scheduleBlink(entry.face);
          }
        });
      } else {
        stopBlinks();
      }
    };

    const finish = () => {
      playing = false;
      played = true;
      talk.classList.add("is-played");
      sync();
    };

    const speakLine = (index) => {
      const entry = entries[index];
      const ms = durationOf(entry);
      const stand = stands();
      entry.line.classList.add("is-speaking");
      if (entry.face) {
        mouthStart(entry.face);
      }
      if (entry.who === "kun" && stand.kun) {
        stand.kun.speak(ms);
      } else if (entry.who === "chan" && stand.chan) {
        stand.chan.reach(ms);
      }
      tPlay.set(() => {
        entry.line.classList.remove("is-speaking");
        if (entry.face) {
          mouthEnd(entry.face);
        }
        if (index + 1 < entries.length) {
          tPlay.set(() => speakLine(index + 1), 450);
        } else {
          finish();
        }
      }, ms);
    };

    const begin = () => {
      waiting = false;
      if (!visible || document.hidden || playing || played) {
        return;
      }
      playing = true;
      sync();
      // 先読みが済むか 1500ms 経つまで待ってから、全部の顔を休みのコマにして再生する
      tPlay.settle(playFrames(), 1500, () => {
        restAll();
        speakLine(0);
      });
    };

    // 画面に 60% 以上入っていて、タブが表示中なら、400ms 待って再生する（1 回だけ）
    const arm = () => {
      if (visible && ratio >= 0.6 && !document.hidden && !played && !playing && !waiting) {
        waiting = true;
        tWait.set(begin, 400);
      }
    };

    // 再生を止める。画面外へ出たときは打ち切り（もう再生しない）、
    // タブが隠れたときは、見ていないあいだに終わらないよう止めて、表示に戻ったら最初から再生する
    const stopPlay = (giveUp) => {
      tPlay.clearAll();
      tMouth.clearAll();
      entries.forEach((entry) => entry.line.classList.remove("is-speaking"));
      restAll();
      const stand = stands();
      if (stand.kun) {
        stand.kun.hush();
      }
      if (stand.chan) {
        stand.chan.hush();
      }
      if (giveUp) {
        finish();
      } else {
        playing = false;
      }
    };

    const onNear = (entry) => {
      if (entry.isIntersecting) {
        nearObserver.unobserve(talk);
        afterLoad(() => playFrames().forEach(preload));
      }
    };
    const onView = (entry) => {
      visible = entry.isIntersecting;
      ratio = entry.intersectionRatio;
      if (!visible) {
        tWait.clearAll();
        waiting = false;
        if (playing) {
          stopPlay(true);
        }
      } else {
        arm();
      }
      sync();
    };
    const onVisibility = () => {
      if (document.hidden) {
        tWait.clearAll();
        waiting = false;
        if (playing) {
          stopPlay(false);
        }
      } else {
        arm();
      }
      sync();
    };

    const nearObserver = new IntersectionObserver((list) => list.forEach(onNear), { rootMargin: "200px" });
    const viewObserver = new IntersectionObserver((list) => list.forEach(onView), { threshold: [0, 0.6] });
    nearObserver.observe(talk);
    viewObserver.observe(talk);

    return { onVisibility };
  };

  document.querySelectorAll(".kun-rig[data-kun]").forEach((rig) => {
    const actor = makeKun(rig);
    if (actor) {
      register(rig, actor);
    }
  });
  document.querySelectorAll("img[data-chan]").forEach((img) => {
    const actor = makeChan(img);
    if (actor) {
      register(img, actor);
    }
  });
  document.querySelectorAll(".talk").forEach((el) => {
    const talk = makeTalk(el);
    if (talk) {
      talks.push(talk);
    }
  });

  // タブを切り替えたら、動かす・止めるを見直す
  document.addEventListener("visibilitychange", () => {
    actors.forEach((actor) => actor.sync());
    talks.forEach((talk) => talk.onVisibility());
  });

  // reduce の変化に追従する（CSS の動きは media query が止める。JS 側は手振りと登場のポーズ送りを切り上げる）
  const onReduceChange = () => {
    actors.forEach((actor) => actor.onReduce());
  };
  if (REDUCE) {
    if (REDUCE.addEventListener) {
      REDUCE.addEventListener("change", onReduceChange);
    } else if (REDUCE.addListener) {
      REDUCE.addListener(onReduceChange);
    }
  }
})();
