const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const test = require("node:test");
const { runInNewContext } = require("node:vm");

const filename = join(__dirname, "../site/countdown.js");
const source = readFileSync(filename, "utf8");
const target = new Date("2027-02-01T00:00:00").getTime();
const unitIds = ["days", "hours", "minutes", "seconds"];

function loadCountdown(now) {
  const elements = Object.fromEntries(
    [...unitIds, "status"].map((id) => [id, { textContent: "" }]),
  );
  const timers = new Map();
  const listeners = new Map();
  let nextTimerId = 1;
  const document = {
    visibilityState: "hidden",
    getElementById: (id) => elements[id],
    addEventListener: (type, callback) => listeners.set(type, callback),
  };

  runInNewContext(source, {
    document,
    Date: class extends Date {
      static now() { return typeof now === "function" ? now() : now; }
    },
    setInterval(callback, delay) {
      const id = nextTimerId++;
      timers.set(id, { callback, delay });
      return id;
    },
    clearInterval: (id) => timers.delete(id),
  }, { filename });

  return {
    timers,
    values: () => unitIds.map((id) => elements[id].textContent),
    status: () => elements.status.textContent,
    setNow(value) { now = value; },
    tick() {
      for (const { callback } of timers.values()) callback();
    },
    show() {
      document.visibilityState = "visible";
      listeners.get("visibilitychange")();
    },
  };
}

for (const [seconds, expected] of [
  [90061, ["01", "01", "01", "01"]],
  [86400, ["01", "00", "00", "00"]],
  [3600, ["00", "01", "00", "00"]],
  [60, ["00", "00", "01", "00"]],
  [59, ["00", "00", "00", "59"]],
  [8640000, ["100", "00", "00", "00"]],
]) {
  test(`renders ${seconds} remaining seconds as days/hours/minutes/seconds`, () => {
    const countdown = loadCountdown(target - seconds * 1000);
    assert.deepEqual(countdown.values(), expected);
    assert.equal(countdown.status(), "");
    assert.equal(countdown.timers.size, 1);
  });
}

test("keeps one second displayed until local midnight, including the final millisecond", () => {
  for (const milliseconds of [999, 500, 1]) {
    const countdown = loadCountdown(target - milliseconds);
    assert.deepEqual(countdown.values(), ["00", "00", "00", "01"]);
    assert.equal(countdown.status(), "");
    assert.equal(countdown.timers.size, 1);
  }
});

for (const [name, offset] of [["exactly at", 0], ["after", 1], ["one day after", 86400000]]) {
  test(`shows completion and stops ticking ${name} local midnight on February 1, 2027`, () => {
    const countdown = loadCountdown(target + offset);
    assert.deepEqual(countdown.values(), ["00", "00", "00", "00"]);
    assert.notEqual(countdown.status().trim(), "");
    assert.equal(countdown.timers.size, 0);
  });
}

test("the one-second timer recalculates from Date.now instead of counting ticks", () => {
  const countdown = loadCountdown(target - 90000);
  assert.equal([...countdown.timers.values()][0].delay, 1000);

  countdown.setNow(target - 25000);
  countdown.tick();
  assert.deepEqual(countdown.values(), ["00", "00", "00", "25"]);
  assert.equal(countdown.status(), "");

  countdown.setNow(target);
  countdown.tick();
  assert.deepEqual(countdown.values(), ["00", "00", "00", "00"]);
  assert.notEqual(countdown.status().trim(), "");
  assert.equal(countdown.timers.size, 0);
});

test("crossing midnight during a render cannot stop the timer with one second left", () => {
  let now = target - 1;
  const countdown = loadCountdown(() => now++);
  assert.deepEqual(countdown.values(), ["00", "00", "00", "01"]);
  assert.equal(countdown.status(), "");
  assert.equal(countdown.timers.size, 1);
  countdown.tick();
  assert.deepEqual(countdown.values(), ["00", "00", "00", "00"]);
  assert.notEqual(countdown.status().trim(), "");
  assert.equal(countdown.timers.size, 0);
});

test("becoming visible refreshes elapsed time without waiting for a timer tick", () => {
  const countdown = loadCountdown(target - 90000);

  countdown.setNow(target - 5000);
  countdown.show();
  assert.deepEqual(countdown.values(), ["00", "00", "00", "05"]);
  assert.equal(countdown.status(), "");

  countdown.setNow(target + 5000);
  countdown.show();
  assert.deepEqual(countdown.values(), ["00", "00", "00", "00"]);
  assert.notEqual(countdown.status().trim(), "");
  assert.equal(countdown.timers.size, 0);
});
