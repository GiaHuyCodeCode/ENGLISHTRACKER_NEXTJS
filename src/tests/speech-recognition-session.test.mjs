/**
 * Speech Recognition Session Management Tests
 * Chạy: node src/tests/speech-recognition-session.test.mjs
 *
 * Test logic session ID và failsafe timer của useSpeechRecognition
 * bằng cách mock browser APIs và giả lập mobile behavior.
 */

// ─── Test runner ─────────────────────────────────────────────────────────────

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
function assertTrue(description, value) { assert(description, value, true); }
function assertFalse(description, value) { assert(description, value, false); }
function assertEqual(description, actual, expected) { assert(description, actual, expected); }
function group(name, fn) { console.log(`\n📦 ${name}`); fn(); }

// ─── Mock Implementation của useSpeechRecognition logic ──────────────────────
// Ta extract core logic thành pure functions để test không cần React hooks.

/**
 * Simulates the SpeechRecognition session management logic.
 * Returns a controller object với các methods để test.
 */
function createSessionManager() {
  let sessionId = 0;
  let explicitlyStopped = false;
  let settled = false;
  let transcript = '';
  let onCompleteCallback = null;
  let failsafeTimer = null;
  let restartCount = 0;
  let settleCallCount = 0;
  let lastSettledTranscript = null;

  const settle = (currentSessionId) => {
    // Key fix: stale session check
    if (sessionId !== currentSessionId) return; // stale session
    if (settled) return;
    settled = true;
    if (failsafeTimer) {
      clearTimeout(failsafeTimer);
      failsafeTimer = null;
    }
    settleCallCount++;
    lastSettledTranscript = transcript.trim();
    onCompleteCallback?.(transcript.trim(), 0);
  };

  const onend = (currentSessionId) => {
    // Stale session check — the KEY FIX for mobile bug
    if (sessionId !== currentSessionId) return;
    if (!explicitlyStopped && !settled) {
      restartCount++;
      // Would restart recognition here
    } else {
      settle(currentSessionId);
    }
  };

  const onerror = (currentSessionId, errorType) => {
    if (sessionId !== currentSessionId) return; // stale
    if (!explicitlyStopped && (errorType === 'no-speech' || errorType === 'aborted')) {
      return; // non-fatal, let onend handle
    }
    settle(currentSessionId);
  };

  return {
    start(onComplete) {
      // Reset all state for new session
      const newSessionId = ++sessionId;
      explicitlyStopped = false;
      settled = false;
      transcript = '';
      onCompleteCallback = onComplete;
      restartCount = 0;
      settleCallCount = 0;
      lastSettledTranscript = null;

      // Failsafe timer
      if (failsafeTimer) clearTimeout(failsafeTimer);
      failsafeTimer = setTimeout(() => {
        failsafeTimer = null;
        if (sessionId === newSessionId && !settled) {
          settle(newSessionId);
        }
      }, 100); // sử dụng 100ms thay vì 7000ms cho test

      return newSessionId;
    },

    stop() {
      explicitlyStopped = true;
      if (failsafeTimer) {
        clearTimeout(failsafeTimer);
        failsafeTimer = null;
      }
    },

    simulateOnend(sessionIdToUse) {
      onend(sessionIdToUse ?? sessionId);
    },

    simulateOnerror(errorType, sessionIdToUse) {
      onerror(sessionIdToUse ?? sessionId, errorType);
    },

    simulateResult(text) {
      transcript = text + ' ';
    },

    // Getters để kiểm tra state
    getCurrentSessionId: () => sessionId,
    isSettled: () => settled,
    isExplicitlyStopped: () => explicitlyStopped,
    getRestartCount: () => restartCount,
    getSettleCallCount: () => settleCallCount,
    getLastSettledTranscript: () => lastSettledTranscript,

    // Cleanup
    cleanup() {
      if (failsafeTimer) {
        clearTimeout(failsafeTimer);
        failsafeTimer = null;
      }
    }
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

group('Session ID — Mỗi start() tạo session mới', () => {
  const mgr = createSessionManager();

  const id1 = mgr.start(() => {});
  assertEqual('session 1 → id=1', id1, 1);

  const id2 = mgr.start(() => {});
  assertEqual('session 2 → id=2', id2, 2);

  const id3 = mgr.start(() => {});
  assertEqual('session 3 → id=3', id3, 3);

  mgr.cleanup();
});

group('Session ID — Stale onend không gây restart (mobile bug fix)', () => {
  const mgr = createSessionManager();
  let onCompleteCalledCount = 0;

  // Bắt đầu session 1
  const sid1 = mgr.start(() => { onCompleteCalledCount++; });

  // Bắt đầu session 2 ngay lập tức (giống khi user chuyển câu)
  const sid2 = mgr.start(() => { onCompleteCalledCount++; });

  // onend của session 1 (STALE) fires — không nên làm gì
  mgr.simulateOnend(sid1);

  assertEqual('stale onend không tạo restart', mgr.getRestartCount(), 0);
  assertFalse('session 2 chưa bị settle bởi stale event', mgr.isSettled());

  mgr.cleanup();
});

group('Session ID — Stale onerror không gây settle', () => {
  const mgr = createSessionManager();
  let completedFromSid1 = false;

  const sid1 = mgr.start(() => { completedFromSid1 = true; });
  const sid2 = mgr.start(() => {});

  // Error từ session 1 (STALE)
  mgr.simulateOnerror('network', sid1);

  assertFalse('stale onerror không settle session hiện tại', mgr.isSettled());
  assertFalse('onComplete của sid1 không được gọi', completedFromSid1);

  mgr.cleanup();
});

group('Normal flow — onend sau stop() gọi settle()', () => {
  const mgr = createSessionManager();
  let completedTranscript = null;

  const sid = mgr.start((t) => { completedTranscript = t; });
  mgr.simulateResult('Hello world');
  mgr.stop();
  mgr.simulateOnend(sid); // onend fires after stop()

  assertTrue('settled sau stop + onend', mgr.isSettled());
  assertEqual('transcript đúng', completedTranscript, 'Hello world');
  assertEqual('settle chỉ gọi 1 lần', mgr.getSettleCallCount(), 1);
});

group('Normal flow — onend với continuous=true gây restart', () => {
  const mgr = createSessionManager();

  const sid = mgr.start(() => {});
  // onend fires nhưng chưa stop → restart
  mgr.simulateOnend(sid);

  assertEqual('onend không có stop → restart 1 lần', mgr.getRestartCount(), 1);
  assertFalse('chưa settled', mgr.isSettled());

  mgr.cleanup();
});

group('no-speech error không settle (non-fatal)', () => {
  const mgr = createSessionManager();
  let completed = false;

  const sid = mgr.start(() => { completed = true; });
  mgr.simulateOnerror('no-speech', sid);

  assertFalse('no-speech không settle', mgr.isSettled());
  assertFalse('onComplete không gọi', completed);

  mgr.cleanup();
});

group('aborted error không settle khi chưa stop (non-fatal)', () => {
  const mgr = createSessionManager();

  const sid = mgr.start(() => {});
  mgr.simulateOnerror('aborted', sid);

  assertFalse('aborted không settle khi chưa explicitlyStopped', mgr.isSettled());

  mgr.cleanup();
});

group('network error gây settle (fatal error)', () => {
  const mgr = createSessionManager();
  let completed = false;

  const sid = mgr.start(() => { completed = true; });
  mgr.simulateOnerror('network', sid);

  assertTrue('network error → settle', mgr.isSettled());
  assertTrue('onComplete được gọi', completed);
});

group('stop() ngăn restart trong onend', () => {
  const mgr = createSessionManager();

  const sid = mgr.start(() => {});
  mgr.stop();
  mgr.simulateOnend(sid);

  assertEqual('sau stop(), onend không restart', mgr.getRestartCount(), 0);
  assertTrue('settled sau stop + onend', mgr.isSettled());

  mgr.cleanup();
});

group('Failsafe timer — force settle sau timeout', (done) => {
  // Async test với Promise
  return new Promise((resolve) => {
    const mgr = createSessionManager();
    let completed = false;
    let completedTranscript = null;

    mgr.start((t) => {
      completed = true;
      completedTranscript = t;
    });

    // Giả lập: recognition stuck, không có onend/onerror
    mgr.simulateResult('partial text');

    // Failsafe timer sẽ fire sau 100ms (mock value)
    setTimeout(() => {
      assertTrue('failsafe đã settle', mgr.isSettled());
      assertTrue('onComplete được gọi', completed);
      assertEqual('transcript được preserve', completedTranscript, 'partial text');
      resolve();
    }, 150);
  });
});

group('Failsafe bị cancel khi settle trước', () => {
  const mgr = createSessionManager();
  let completedCount = 0;

  const sid = mgr.start(() => { completedCount++; });
  mgr.simulateResult('Hello');
  mgr.stop();
  mgr.simulateOnend(sid); // settle normally

  return new Promise((resolve) => {
    setTimeout(() => {
      assertEqual('onComplete chỉ gọi 1 lần (failsafe đã cancel)', completedCount, 1);
      resolve();
    }, 150);
  });
});

group('start() liên tiếp nhanh — chỉ session cuối hoạt động', () => {
  const mgr = createSessionManager();
  const completions = [];

  // Gọi start 3 lần liên tiếp nhanh
  const s1 = mgr.start((t) => completions.push({ session: 1, t }));
  const s2 = mgr.start((t) => completions.push({ session: 2, t }));
  const s3 = mgr.start((t) => completions.push({ session: 3, t }));

  // Chỉ session 3 hợp lệ
  assertEqual('session ID cuối cùng = 3', mgr.getCurrentSessionId(), 3);

  // onend của s1 và s2 fires (stale)
  mgr.simulateOnend(s1);
  mgr.simulateOnend(s2);

  assertEqual('restartCount vẫn = 0 (stale sessions bị ignore)', mgr.getRestartCount(), 0);

  // onend của s3 fires (active) → restart vì chưa stop
  mgr.simulateOnend(s3);
  assertEqual('session 3 tạo restart', mgr.getRestartCount(), 1);

  mgr.cleanup();
});

// ─── Chờ test async rồi in kết quả ──────────────────────────────────────────

const allTests = [
  // Sync tests đã chạy ở trên qua group()
  // Async tests cần collect
];

// Chạy các test async và đợi
const asyncTests = [];

// Failsafe timer test
asyncTests.push(new Promise((resolve) => {
  const mgr = createSessionManager();
  let completed = false;
  let completedTranscript = null;

  mgr.start((t) => {
    completed = true;
    completedTranscript = t;
  });

  mgr.simulateResult('partial text');

  setTimeout(() => {
    assertTrue('failsafe đã settle (async)', mgr.isSettled());
    assertTrue('onComplete được gọi (async)', completed);
    assertEqual('transcript được preserve (async)', completedTranscript, 'partial text');
    resolve();
  }, 150);
}));

// Cancel failsafe test
asyncTests.push(new Promise((resolve) => {
  const mgr = createSessionManager();
  let completedCount = 0;

  const sid = mgr.start(() => { completedCount++; });
  mgr.simulateResult('Hello');
  mgr.stop();
  mgr.simulateOnend(sid);

  setTimeout(() => {
    assertEqual('onComplete chỉ gọi 1 lần (async)', completedCount, 1);
    resolve();
  }, 150);
}));

Promise.all(asyncTests).then(() => {
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
});
