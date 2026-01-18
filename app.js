// João Pessoa timezone (Brazil, UTC-3)
const TIMEZONE = "America/Recife";

let tideData = [];
let tideChart = null;

const tidesEl = document.getElementById("tides");
const dayPicker = document.getElementById("day-picker");
const currentEstimateEl = document.getElementById("current-estimate");
const nextTideEl = document.getElementById("next-tide");
const chartCanvas = document.getElementById("tide-chart");

// Get current time in João Pessoa timezone
function getNowInTimezone() {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: TIMEZONE })
  );
}

// Get today's date string in João Pessoa timezone
function getTodayString() {
  const now = new Date();
  return now.toLocaleDateString("sv-SE", { timeZone: TIMEZONE });
}

// Parse a tide datetime as João Pessoa local time
function parseTideTime(datetimeStr) {
  // The datetime in JSON is already in João Pessoa local time (e.g., "2026-01-18T14:30:00")
  // We need to interpret it as João Pessoa time, not local time
  const [datePart, timePart] = datetimeStr.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute, second = 0] = timePart.split(":").map(Number);

  // Create a date string that forces interpretation in the target timezone
  const tzDate = new Date(
    new Date(year, month - 1, day, hour, minute, second).toLocaleString("en-US", { timeZone: TIMEZONE })
  );

  // Return timestamp that represents this moment in João Pessoa
  return { year, month, day, hour, minute, second, original: datetimeStr };
}

// Format time for display (always in João Pessoa time)
function formatTime(hour, minute) {
  return `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
}

// Format time from a parsed tide time object
function formatTideTime(parsed) {
  return formatTime(parsed.hour, parsed.minute);
}

// Get current time components in João Pessoa
function getNowComponents() {
  const now = new Date();
  const options = { timeZone: TIMEZONE, hour12: false };
  const hour = parseInt(now.toLocaleString("en-US", { ...options, hour: "numeric" }));
  const minute = parseInt(now.toLocaleString("en-US", { ...options, minute: "numeric" }));
  const second = parseInt(now.toLocaleString("en-US", { ...options, second: "numeric" }));
  return { hour, minute, second };
}

// Convert time components to minutes since midnight
function toMinutes(hour, minute) {
  return hour * 60 + minute;
}

function formatDuration(ms) {
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) {
    return `${hours}h ${minutes}min`;
  }
  return `${minutes}min`;
}

function interpolateTide(h1, h2, pct) {
  return h1 + (h2 - h1) * 0.5 * (1 - Math.cos(Math.PI * pct));
}

function generateChartData(tides, selectedDate) {
  const labels = [];
  const data = [];
  const pointColors = [];

  const today = getTodayString();
  const isToday = selectedDate === today;
  const nowComponents = getNowComponents();
  const nowMinutes = toMinutes(nowComponents.hour, nowComponents.minute);

  let currentTimeIndex = -1;

  for (let i = 0; i < tides.length; i++) {
    const tide = tides[i];
    const parsed = parseTideTime(tide.datetime);
    const tideMinutes = toMinutes(parsed.hour, parsed.minute);

    // Add the tide point itself
    labels.push(formatTideTime(parsed));
    data.push(tide.height);
    pointColors.push("#1976d2");

    // Track if current time falls near this point
    if (isToday && currentTimeIndex === -1) {
      if (i < tides.length - 1) {
        const nextParsed = parseTideTime(tides[i + 1].datetime);
        const nextMinutes = toMinutes(nextParsed.hour, nextParsed.minute);
        if (nowMinutes >= tideMinutes && nowMinutes < nextMinutes) {
          // Add interpolated points between this tide and next
          let currentMin = tideMinutes + 15;
          while (currentMin < nextMinutes) {
            const h = Math.floor(currentMin / 60);
            const m = currentMin % 60;
            labels.push(formatTime(h, m));

            const pct = (currentMin - tideMinutes) / (nextMinutes - tideMinutes);
            data.push(interpolateTide(tide.height, tides[i + 1].height, pct));
            pointColors.push("transparent");

            // Check if this is the current time slot
            if (currentTimeIndex === -1 && currentMin <= nowMinutes && currentMin + 15 > nowMinutes) {
              currentTimeIndex = labels.length - 1;
            }

            currentMin += 15;
          }
        }
      }
    } else if (i < tides.length - 1) {
      // Add interpolated points for smooth curve
      const nextParsed = parseTideTime(tides[i + 1].datetime);
      const nextMinutes = toMinutes(nextParsed.hour, nextParsed.minute);

      let currentMin = tideMinutes + 15;
      while (currentMin < nextMinutes) {
        const h = Math.floor(currentMin / 60);
        const m = currentMin % 60;
        labels.push(formatTime(h, m));

        const pct = (currentMin - tideMinutes) / (nextMinutes - tideMinutes);
        data.push(interpolateTide(tide.height, tides[i + 1].height, pct));
        pointColors.push("transparent");

        currentMin += 15;
      }
    }
  }

  return { labels, data, pointColors, currentTimeIndex };
}

function renderChart(tides, selectedDate) {
  const { labels, data, pointColors } = generateChartData(tides, selectedDate);
  const today = getTodayString();
  const isToday = selectedDate === today;
  const nowComponents = getNowComponents();
  const nowTimeStr = formatTime(nowComponents.hour, nowComponents.minute);

  if (tideChart) {
    tideChart.destroy();
  }

  const ctx = chartCanvas.getContext("2d");

  // Find the index closest to current time for the vertical line
  let nowIndex = -1;
  if (isToday) {
    for (let i = 0; i < labels.length - 1; i++) {
      if (labels[i] <= nowTimeStr && labels[i + 1] > nowTimeStr) {
        // Interpolate position between indices
        nowIndex = i + 0.5;
        break;
      }
    }
    // If we're past the last label
    if (nowIndex === -1 && labels.length > 0 && nowTimeStr >= labels[labels.length - 1]) {
      nowIndex = labels.length - 1;
    }
  }

  // Custom plugin for drawing the "now" line
  const nowLinePlugin = {
    id: "nowLine",
    afterDraw: (chart) => {
      if (!isToday || nowIndex === -1) return;

      const { ctx, scales: { x, y } } = chart;
      const xPos = x.getPixelForValue(nowIndex);

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(xPos, y.top);
      ctx.lineTo(xPos, y.bottom);
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#e53935";
      ctx.setLineDash([5, 3]);
      ctx.stroke();

      // Draw "Agora" label
      ctx.fillStyle = "#e53935";
      ctx.font = "bold 10px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Agora", xPos, y.top - 5);

      ctx.restore();
    }
  };

  tideChart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Altura da maré (m)",
          data,
          borderColor: "#1976d2",
          backgroundColor: "rgba(25, 118, 210, 0.1)",
          fill: true,
          tension: 0.4,
          pointRadius: data.map((_, i) =>
            pointColors[i] === "#1976d2" ? 6 : 0
          ),
          pointBackgroundColor: pointColors,
          pointBorderColor: pointColors.map((c) =>
            c === "#1976d2" ? "#fff" : "transparent"
          ),
          pointBorderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      layout: {
        padding: {
          top: 20,
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context) => `${context.parsed.y.toFixed(2)} m`,
          },
        },
      },
      scales: {
        x: {
          display: true,
          ticks: {
            maxTicksLimit: 6,
            font: { size: 11 },
          },
          grid: { display: false },
        },
        y: {
          display: true,
          min: 0,
          max: 3,
          ticks: {
            stepSize: 0.5,
            font: { size: 11 },
            callback: (value) => value + " m",
          },
          grid: { color: "rgba(0,0,0,0.05)" },
        },
      },
    },
    plugins: [nowLinePlugin],
  });
}

function showCurrentEstimate(tides) {
  const nowComponents = getNowComponents();
  const nowMinutes = toMinutes(nowComponents.hour, nowComponents.minute);

  for (let i = 0; i < tides.length - 1; i++) {
    const t1 = parseTideTime(tides[i].datetime);
    const t2 = parseTideTime(tides[i + 1].datetime);
    const t1Minutes = toMinutes(t1.hour, t1.minute);
    const t2Minutes = toMinutes(t2.hour, t2.minute);

    if (nowMinutes >= t1Minutes && nowMinutes <= t2Minutes) {
      const h1 = tides[i].height;
      const h2 = tides[i + 1].height;
      const pct = (nowMinutes - t1Minutes) / (t2Minutes - t1Minutes);
      const estimate = interpolateTide(h1, h2, pct);
      const isRising = h2 > h1;

      currentEstimateEl.innerHTML = `
        <div class="current-estimate">
          <div class="time">Agora (${formatTime(nowComponents.hour, nowComponents.minute)})</div>
          <div class="height">${estimate.toFixed(2)} m</div>
          <div class="trend ${isRising ? "rising" : "falling"}">
            ${isRising ? "↑ subindo" : "↓ descendo"}
          </div>
        </div>
      `;
      return;
    }
  }

  currentEstimateEl.innerHTML = "";
}

function showNextTide(tides) {
  const nowComponents = getNowComponents();
  const nowMinutes = toMinutes(nowComponents.hour, nowComponents.minute);

  for (const tide of tides) {
    const parsed = parseTideTime(tide.datetime);
    const tideMinutes = toMinutes(parsed.hour, parsed.minute);

    if (tideMinutes > nowMinutes) {
      const diffMinutes = tideMinutes - nowMinutes;
      const diffMs = diffMinutes * 60 * 1000;
      const isHigh = tide.height >= 1.5;

      nextTideEl.innerHTML = `
        <div class="next-tide">
          Próxima maré <strong>${isHigh ? "alta" : "baixa"}</strong> em
          <strong>${formatDuration(diffMs)}</strong> (${formatTideTime(parsed)})
        </div>
      `;
      return;
    }
  }

  nextTideEl.innerHTML = "";
}

function showTidesFor(date) {
  const tides = tideData
    .filter((t) => t.datetime.startsWith(date))
    .sort((a, b) => a.datetime.localeCompare(b.datetime));

  if (tides.length === 0) {
    tidesEl.innerHTML =
      '<div class="error">Sem dados disponíveis para esta data.</div>';
    currentEstimateEl.innerHTML = "";
    nextTideEl.innerHTML = "";
    if (tideChart) {
      tideChart.destroy();
      tideChart = null;
    }
    return;
  }

  const today = getTodayString();
  const isToday = date === today;

  if (isToday) {
    showCurrentEstimate(tides);
    showNextTide(tides);
  } else {
    currentEstimateEl.innerHTML = "";
    nextTideEl.innerHTML = "";
  }

  renderChart(tides, date);

  tidesEl.innerHTML = tides
    .map((t) => {
      const parsed = parseTideTime(t.datetime);
      const isHigh = t.height >= 1.5;
      const icon = isHigh ? "🌊" : "🌙";
      return `
        <div class="tide-entry ${isHigh ? "high" : "low"}">
          <div class="left">
            <span class="icon">${icon}</span>
            <span class="time">${formatTideTime(parsed)}</span>
          </div>
          <span class="height">${t.height.toFixed(2)} m</span>
        </div>
      `;
    })
    .join("");
}

// Event listeners
dayPicker.addEventListener("change", () => {
  showTidesFor(dayPicker.value);
});

// Load tide data
fetch("tides.json")
  .then((res) => {
    if (!res.ok) throw new Error("Falha ao carregar dados");
    return res.json();
  })
  .then((data) => {
    tideData = data;
    const dates = tideData.map((t) => t.datetime.split("T")[0]);
    const uniqueDates = [...new Set(dates)].sort((a, b) =>
      a.localeCompare(b)
    );

    if (uniqueDates.length === 0) {
      tidesEl.innerHTML =
        '<div class="error">Nenhum dado de maré disponível.</div>';
      return;
    }

    const today = getTodayString();
    dayPicker.min = uniqueDates[0];
    dayPicker.max = uniqueDates[uniqueDates.length - 1];
    dayPicker.value = uniqueDates.includes(today) ? today : uniqueDates[0];
    showTidesFor(dayPicker.value);
  })
  .catch((err) => {
    tidesEl.innerHTML = `<div class="error">Erro ao carregar os dados da maré.<br><small>${err.message}</small></div>`;
    console.error(err);
  });

// Register service worker
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(console.error);
}

// Install prompt handling
let deferredPrompt;
const installBanner = document.getElementById("install-banner");
const installBtn = document.getElementById("install-btn");
const closeInstallBtn = document.getElementById("close-install");

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

function wasInstallDismissed() {
  const dismissed = localStorage.getItem("installDismissed");
  if (!dismissed) return false;
  const dismissedDate = new Date(dismissed);
  const daysSince =
    (Date.now() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24);
  return daysSince < 7;
}

function showInstallBanner() {
  if (!isStandalone() && !wasInstallDismissed()) {
    installBanner.classList.remove("hidden");
    document.body.classList.add("has-install-banner");
  }
}

function hideInstallBanner() {
  installBanner.classList.add("hidden");
  document.body.classList.remove("has-install-banner");
}

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  showInstallBanner();
});

installBtn.addEventListener("click", async () => {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    deferredPrompt = null;
    hideInstallBanner();
  } else {
    alert(
      'Para instalar:\n1. Toque no botão de compartilhar\n2. Selecione "Adicionar à Tela de Início"'
    );
  }
});

closeInstallBtn.addEventListener("click", () => {
  localStorage.setItem("installDismissed", new Date().toISOString());
  hideInstallBanner();
});

window.addEventListener("appinstalled", () => {
  hideInstallBanner();
  deferredPrompt = null;
});

// iOS detection - show banner with instructions
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
if (isIOS && !isStandalone()) {
  setTimeout(showInstallBanner, 2000);
}
