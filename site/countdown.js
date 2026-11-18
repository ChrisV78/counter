const target = new Date(2027, 1, 1).getTime();
const units = [
  { element: document.getElementById("days"), seconds: 86400 },
  { element: document.getElementById("hours"), seconds: 3600 },
  { element: document.getElementById("minutes"), seconds: 60 },
  { element: document.getElementById("seconds"), seconds: 1 },
];

function updateCountdown() {
  const now = Date.now();
  let remaining = Math.max(0, Math.ceil((target - now) / 1000));

  for (const unit of units) {
    const value = Math.floor(remaining / unit.seconds);
    unit.element.textContent = String(value).padStart(2, "0");
    remaining %= unit.seconds;
  }

  if (now >= target) {
    document.getElementById("status").textContent = "The wait is over. 1 February 2027 is here.";
    clearInterval(interval);
  }
}

const interval = setInterval(updateCountdown, 1000);
updateCountdown();
document.addEventListener("visibilitychange", updateCountdown);
