/**
 * Shadowing Logic Unit Tests
 * Chạy: node src/tests/shadowing-logic.test.mjs
 *
 * Test toàn bộ pure logic của ShadowingBlock + SentenceShadowingBlock
 * mà không cần browser, DOM, hay testing framework.
 */

// ─── Test runner đơn giản ─────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures = [];

function assert(description, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    console.log(`  ✅ ${description}`);
    passed++;
  } else {
    console.log(`  ❌ ${description}`);
    console.log(`     expected: ${JSON.stringify(expected)}`);
    console.log(`     actual:   ${JSON.stringify(actual)}`);
    failed++;
    failures.push({ description, expected, actual });
  }
}

function assertEqual(description, actual, expected) {
  assert(description, actual, expected);
}

function assertTrue(description, value) {
  assert(description, value, true);
}

function assertFalse(description, value) {
  assert(description, value, false);
}

function group(name, fn) {
  console.log(`\n📦 ${name}`);
  fn();
}

// ─── Copy logic từ ShadowingBlock / SentenceShadowingBlock ───────────────────
// (Được copy trực tiếp để test isolated, không phụ thuộc vào bundler)

function normalize(s) {
  return s.trim().toLowerCase().replace(/[^a-z0-9\s']/g, '').replace(/\s+/g, ' ');
}

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return dp[m][n];
}

function fuzzyOk(a, b) {
  if (a === b) return true;
  const maxLen = Math.max(a.length, b.length);
  return maxLen === 0 ? true : 1 - levenshtein(a, b) / maxLen >= 0.8;
}

/**
 * Tính accuracy score giống SentenceShadowingBlock.handleRecordStart
 * @param {string} targetText - Câu chuẩn
 * @param {string} transcript - Transcript từ SpeechRecognition
 * @returns {{ accuracy: number, wordDiff: {word: string, ok: boolean}[] }}
 */
function calcAccuracy(targetText, transcript) {
  const recWords = normalize(transcript).split(' ').filter(Boolean);
  const tgtWords = normalize(targetText).split(' ').filter(Boolean);

  let hits = 0;
  const wordDiff = targetText.trim().split(/\s+/).map((w, i) => {
    const ok = i < recWords.length ? fuzzyOk(recWords[i], normalize(w)) : false;
    if (ok) hits++;
    return { word: w, ok };
  });

  const accuracy = transcript.trim() === ''
    ? 0
    : (tgtWords.length ? Math.round((hits / tgtWords.length) * 100) : 0);

  return { accuracy, wordDiff };
}

/**
 * Tính score tổng của submitSentenceShadowing
 */
function calcSubmitScore(results) {
  if (results.length === 0) return 0;
  return Math.round(results.reduce((sum, r) => sum + r.accuracy, 0) / results.length);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

group('normalize()', () => {
  assertEqual('chuỗi bình thường → lowercase trim', normalize('  Hello, World!  '), 'hello world');
  // normalize() GIỮ apostrophe vì ký tự ' nằm trong [a-z0-9\s']
  // "It's fine." → "it's fine" (không loại bỏ dấu ')
  assertEqual("apostrophe trong từ được giữ nguyên", normalize("It's fine."), "it's fine");
  assertEqual('giữ số', normalize('100%'), '100');
  assertEqual('chuỗi rỗng → rỗng', normalize(''), '');
  assertEqual('nhiều khoảng trắng liền → 1 space', normalize('a   b   c'), 'a b c');
  assertEqual('dấu câu phức tạp', normalize('Hello, World! How are you?'), 'hello world how are you');
  assertEqual("apostrophe trong don't được giữ", normalize("don't stop"), "don't stop");
  assertEqual('dấu ngoặc kép bị loại', normalize('"beautiful"'), 'beautiful');
  assertEqual('chữ hoa → thường', normalize('THE QUICK BROWN FOX'), 'the quick brown fox');
});

group('levenshtein()', () => {
  assertEqual('giống nhau → 0', levenshtein('cat', 'cat'), 0);
  assertEqual('1 ký tự khác → 1', levenshtein('cat', 'cut'), 1);
  assertEqual('thiếu 1 ký tự → 1', levenshtein('hello', 'helo'), 1);
  assertEqual('chuỗi rỗng vs abc → 3', levenshtein('', 'abc'), 3);
  assertEqual('kitten vs sitting → 3', levenshtein('kitten', 'sitting'), 3);
  assertEqual('hai chuỗi rỗng → 0', levenshtein('', ''), 0);
  assertEqual('a vs b → 1', levenshtein('a', 'b'), 1);
  assertEqual('abc vs xyz → 3', levenshtein('abc', 'xyz'), 3);
  assertEqual('ab vs a → 1 (delete)', levenshtein('ab', 'a'), 1);
  assertEqual('a vs ab → 1 (insert)', levenshtein('a', 'ab'), 1);
});

group('fuzzyOk() — ngưỡng 80%', () => {
  assertTrue('giống hệt nhau → true', fuzzyOk('hello', 'hello'));
  assertTrue('thiếu 1/5 ký tự → true (80%)', fuzzyOk('helo', 'hello'));
  assertTrue('beautiful vs beautifull → true', fuzzyOk('beautiful', 'beautifull'));
  // "its" vs "it's": lev=1, maxLen=4 → similarity=0.75 < 0.8 → false (đúng)
  // Cả 2 đã được normalize() trước khi đưa vào fuzzyOk nên đây là behavior thực tế
  assertFalse("its vs it's → false (0.75 < 0.8)", fuzzyOk('its', "it's"));
  assertFalse('hi vs hello → false (<80%)', fuzzyOk('hi', 'hello'));
  assertFalse('cat vs dog → false', fuzzyOk('cat', 'dog'));
  assertFalse('chuỗi rỗng vs word → false', fuzzyOk('', 'word'));
  assertTrue('hai chuỗi rỗng → true', fuzzyOk('', ''));
  // "run" vs "ran": lev=1, maxLen=3 → similarity=0.667 < 0.8 → false
  assertFalse('run vs ran → false (0.667 < 0.8)', fuzzyOk('run', 'ran'));
  assertTrue('runnin vs running → true', fuzzyOk('runnin', 'running'));
  assertFalse('stop vs step → false', fuzzyOk('stop', 'step'));
  // Thêm: test các từ thực tế người dùng hay nói
  assertTrue('speek ~ speak → true', fuzzyOk('speek', 'speak')); // lev=1, max=5=0.8
  assertTrue('wold ~ world → true', fuzzyOk('wold', 'world')); // lev=1, max=5=0.8
  assertFalse('apple ~ application → false', fuzzyOk('apple', 'application')); // lev=7, max=11=0.36
  // "stop" vs "step" — lev=2, maxLen=4 → similarity=0.5 < 0.8
  assertFalse('stop vs step → false', fuzzyOk('stop', 'step'));
});

group('calcAccuracy() — Tính điểm câu', () => {
  const { accuracy: a1 } = calcAccuracy('The cat sat', 'The cat sat');
  assertEqual('nói đúng 100% → 100', a1, 100);

  const { accuracy: a2 } = calcAccuracy('The cat sat', 'The cat');
  assertEqual('nói 2/3 từ đúng → 67', a2, 67);

  const { accuracy: a3 } = calcAccuracy('The cat sat', '');
  assertEqual('transcript rỗng → 0', a3, 0);

  const { accuracy: a4 } = calcAccuracy('Hello world', 'Helo world');
  assertEqual('Helo ~ Hello + world → 100 (fuzzy)', a4, 100);

  // "I am fine" nói "I am happy" → "fine" vs "happy" fail (lev=4,max=5=0.2)
  const { accuracy: a5, wordDiff: w5 } = calcAccuracy('I am fine', 'I am happy');
  assertEqual('I am happy vs I am fine → 67 (2/3)', a5, 67);
  assert('wordDiff: I=ok', w5[0], { word: 'I', ok: true });
  assert('wordDiff: am=ok', w5[1], { word: 'am', ok: true });
  assert('wordDiff: fine=fail', w5[2], { word: 'fine', ok: false });

  const { accuracy: a6 } = calcAccuracy('Go to school', 'go to school');
  assertEqual('case insensitive → 100', a6, 100);

  // Nói nhiều từ hơn câu gốc — chỉ tính theo vị trí
  const { accuracy: a7 } = calcAccuracy('cat', 'the cat sat on the mat');
  // Tgt: ["cat"], recWords: ["the","cat",...] → recWords[0]="the" vs "cat"=fail → 0%
  assertEqual('nói thừa từ — chỉ tính theo thứ tự vị trí → 0', a7, 0);

  // Câu nhiều từ, nói đúng hết
  const { accuracy: a8 } = calcAccuracy(
    'She sells seashells by the seashore',
    'She sells seashells by the seashore',
  );
  assertEqual('câu dài 6 từ đúng hết → 100', a8, 100);

  // Nói đúng ngoại trừ 1 từ
  const { accuracy: a9 } = calcAccuracy(
    'She sells seashells by the seashore',
    'She sells seashells by the shore',
  );
  // "shore" vs "seashore" — lev=3,max=9 → sim=0.667 < 0.8 → fail
  assertEqual('1 từ fail trong 6 → 83', a9, 83);
});

group('calcAccuracy() — wordDiff chi tiết', () => {
  const { wordDiff } = calcAccuracy('The quick brown fox', 'The quik brown fox');
  assert('The=ok', wordDiff[0], { word: 'The', ok: true });
  assert('quick ~ quik=ok (fuzzy)', wordDiff[1], { word: 'quick', ok: true });
  assert('brown=ok', wordDiff[2], { word: 'brown', ok: true });
  assert('fox=ok', wordDiff[3], { word: 'fox', ok: true });

  const { wordDiff: wd2 } = calcAccuracy('Hello world', 'Wrong text here extra');
  assert('Hello vs Wrong → fail', wd2[0], { word: 'Hello', ok: false });
  assert('world vs text → fail', wd2[1], { word: 'world', ok: false });
});

group('calcSubmitScore() — Điểm tổng bài Shadowing', () => {
  assertEqual('3 câu [80,90,70] → 80', calcSubmitScore([
    { accuracy: 80 }, { accuracy: 90 }, { accuracy: 70 }
  ]), 80);

  assertEqual('1 câu [0] → 0', calcSubmitScore([{ accuracy: 0 }]), 0);

  assertEqual('0 câu → 0', calcSubmitScore([]), 0);

  assertEqual('3 câu [100,100,100] → 100', calcSubmitScore([
    { accuracy: 100 }, { accuracy: 100 }, { accuracy: 100 }
  ]), 100);

  assertEqual('điểm lẻ làm tròn [1,1,1] → 1', calcSubmitScore([
    { accuracy: 1 }, { accuracy: 1 }, { accuracy: 1 }
  ]), 1);

  // Ví dụ thực tế: 5 câu với accuracy thực
  assertEqual('5 câu thực tế → 72', calcSubmitScore([
    { accuracy: 85 },
    { accuracy: 60 },
    { accuracy: 90 },
    { accuracy: 55 },
    { accuracy: 70 },
  ]), 72);
});

group('ShadowingBlock — Từ đơn (Voca mode)', () => {
  // Voca shadowing dùng cùng logic nhưng targetText = 1 từ
  const { accuracy: a1 } = calcAccuracy('beautiful', 'beautiful');
  assertEqual('beautiful → 100', a1, 100);

  const { accuracy: a2 } = calcAccuracy('beautiful', 'beautifull');
  assertEqual('beautifull ~ beautiful → 100 (fuzzy)', a2, 100);

  const { accuracy: a3 } = calcAccuracy('comfortable', 'confortable');
  // "confortable" vs "comfortable" — lev=1, max=11 → sim=0.909 ≥ 0.8 → true
  assertEqual('confortable ~ comfortable → 100', a3, 100);

  const { accuracy: a4 } = calcAccuracy('environment', 'environment');
  assertEqual('environment → 100', a4, 100);

  const { accuracy: a5 } = calcAccuracy('apple', 'orange');
  // lev('apple','orange')=5, max=6 → sim=0.167 → false → 0%
  assertEqual('apple vs orange → 0', a5, 0);

  // Cụm từ nhiều từ (word = "go to school")
  const { accuracy: a6 } = calcAccuracy('go to school', 'go to school');
  assertEqual('go to school → 100', a6, 100);

  const { accuracy: a7 } = calcAccuracy('go to school', 'go to');
  // 2/3 từ → 67
  assertEqual('go to (thiếu school) → 67', a7, 67);
});

group('Edge Cases', () => {
  // Số trong câu
  const { accuracy: e1 } = calcAccuracy('I have 5 apples', 'I have 5 apples');
  assertEqual('câu có số → 100', e1, 100);

  // Dấu câu trong câu gốc được normalize
  const { accuracy: e2 } = calcAccuracy('Hello, how are you?', 'Hello how are you');
  assertEqual('dấu câu trong target bị normalize → 100', e2, 100);

  // transcript có dấu câu
  const { accuracy: e3 } = calcAccuracy('Hello world', 'Hello, world!');
  assertEqual('transcript có dấu câu → 100 (sau normalize)', e3, 100);

  // Câu 1 từ đúng
  const { accuracy: e4 } = calcAccuracy('cat', 'cat');
  assertEqual('1 từ đúng → 100', e4, 100);

  // Câu 1 từ sai
  const { accuracy: e5 } = calcAccuracy('cat', 'dog');
  assertEqual('1 từ sai → 0', e5, 0);
});

// ─── Tổng kết ─────────────────────────────────────────────────────────────────

console.log('\n' + '─'.repeat(60));
console.log(`\n📊 Kết quả: ${passed} passed, ${failed} failed\n`);

if (failures.length > 0) {
  console.log('❌ Các test thất bại:');
  failures.forEach(f => {
    console.log(`  • ${f.description}`);
  });
  process.exit(1);
} else {
  console.log('🎉 Tất cả test đã pass!\n');
  process.exit(0);
}
