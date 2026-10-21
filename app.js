const coastalPlaces = [
  { name: "الجزائر العاصمة", lat: 36.7538, lon: 3.0588 },
  { name: "تيبازة", lat: 36.589, lon: 2.448 },
  { name: "وهران", lat: 35.697, lon: -0.633 },
  { name: "بجاية", lat: 36.751, lon: 5.056 },
  { name: "عنابة", lat: 36.900, lon: 7.766 },
  { name: "جيجل", lat: 36.820, lon: 5.766 },
  { name: "سكيكدة", lat: 36.876, lon: 6.909 },
  { name: "مستغانم", lat: 35.931, lon: 0.089 },
  { name: "شرشال", lat: 36.607, lon: 2.190 },
  { name: "تلمسان / الغزوات", lat: 35.100, lon: -1.850 }
];

const map = L.map("map", { zoomControl: false }).setView([36.25, 3.2], 7);
L.control.zoom({ position: "bottomright" }).addTo(map);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 18,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

let selectedLayer = "wind";
let selected = { name: "تيبازة", lat: 36.589, lon: 2.448 };
let markers = [];
let requestCounter = 0;

const el = id => document.getElementById(id);
const numberOrDash = (value, digits = 1) =>
  value === null || value === undefined || !Number.isFinite(Number(value))
    ? "—" : Number(value).toFixed(digits);

function compass(deg) {
  if (deg === null || deg === undefined || !Number.isFinite(Number(deg))) return "—";
  const dirs = ["شمال", "شمال شرق", "شرق", "جنوب شرق", "جنوب", "جنوب غرب", "غرب", "شمال غرب"];
  return dirs[Math.round(Number(deg) / 45) % 8] + ` (${Math.round(Number(deg))}°)`;
}
function windColor(speed) {
  if (speed < 10) return "#73e2bb";
  if (speed < 25) return "#4bd6e7";
  if (speed < 40) return "#ffce69";
  return "#ff8a78";
}
function markerIcon(value, layer) {
  const content = layer === "wind" ? "➤" : "≈";
  const color = layer === "wind" ? windColor(value ?? 0) : "#77c8ff";
  return L.divIcon({
    className: "",
    html: `<div class="wind-marker ${layer === "waves" ? "wave" : ""}" style="color:${color};transform:rotate(${layer === "wind" ? 0 : 0}deg)">${content}</div>`,
    iconSize: [40, 40], iconAnchor: [20, 20]
  });
}
function setStatus(message, error = false) {
  el("status").textContent = message;
  el("status").style.color = error ? "#ffb9a8" : "#76e0bb";
}
function showPlaceList() {
  el("places").innerHTML = coastalPlaces.map((p, i) =>
    `<button class="place-btn" data-place="${i}"><strong>${p.name}</strong><span>${p.lat.toFixed(2)}°, ${p.lon.toFixed(2)}°</span></button>`
  ).join("");
  el("places").querySelectorAll("[data-place]").forEach(btn => {
    btn.addEventListener("click", () => {
      const p = coastalPlaces[Number(btn.dataset.place)];
      map.flyTo([p.lat, p.lon], 9, { duration: 0.7 });
      loadLocation(p);
    });
  });
}
function drawPlaceMarkers() {
  markers.forEach(m => map.removeLayer(m));
  markers = [];
  coastalPlaces.forEach(p => {
    const m = L.marker([p.lat, p.lon], { icon: markerIcon(null, selectedLayer) }).addTo(map);
    m.bindTooltip(p.name, { direction: "top", offset: [0, -16] });
    m.on("click", () => loadLocation(p));
    markers.push(m);
  });
}
function updateMarkerStyles() {
  markers.forEach((m, i) => m.setIcon(markerIcon(null, selectedLayer)));
  el("legendText").textContent = selectedLayer === "wind" ? "سرعة الرياح — كم/سا" : "ارتفاع الموج — متر";
  document.querySelectorAll(".layer-btn").forEach(b => b.classList.toggle("active", b.dataset.layer === selectedLayer));
}
function renderForecast(weather, marine) {
  const times = weather?.hourly?.time || [];
  const ws = weather?.hourly?.wind_speed_10m || [];
  const wd = weather?.hourly?.wind_direction_10m || [];
  const wave = marine?.hourly?.wave_height || [];
  const period = marine?.hourly?.wave_period || [];
  const now = new Date();
  let start = times.findIndex(t => new Date(t) >= now);
  if (start < 0) start = 0;
  const indices = [];
  for (let i = start; i < Math.min(times.length, start + 24); i += 3) indices.push(i);
  if (!indices.length) {
    el("forecast").innerHTML = '<div class="error-row">لا توجد توقعات متاحة حاليًا.</div>';
    return;
  }
  el("forecast").innerHTML = indices.map(i => {
    const time = new Date(times[i]);
    const label = time.toLocaleString("ar-DZ", { weekday: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Algiers" });
    const windKmh = ws[i] == null ? null : ws[i];
    return `<article class="forecast-item">
      <div class="forecast-time">${label}</div>
      <div class="forecast-symbol">${selectedLayer === "wind" ? "💨" : "🌊"}</div>
      <div class="forecast-main">${selectedLayer === "wind" ? numberOrDash(windKmh, 0) : numberOrDash(wave[i], 1)}</div>
      <div class="forecast-sub">${selectedLayer === "wind" ? "كم/سا · " + compass(wd[i]) : "متر · " + numberOrDash(period[i], 0) + " ثا"}</div>
    </article>`;
  }).join("");
}
async function loadLocation(place) {
  selected = place;
  const currentRequest = ++requestCounter;
  el("selectedTitle").textContent = place.name || "موقع مختار";
  el("selectedCoords").textContent = `${Number(place.lat).toFixed(4)}, ${Number(place.lon).toFixed(4)}`;
  setStatus("جارٍ التحميل…");
  el("forecast").innerHTML = '<div class="loading-row">جارٍ جلب بيانات الطقس والأمواج…</div>';
  const weatherUrl = new URL("https://api.open-meteo.com/v1/forecast");
  weatherUrl.search = new URLSearchParams({
    latitude: place.lat, longitude: place.lon,
    current: "temperature_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m",
    hourly: "wind_speed_10m,wind_direction_10m,visibility,weather_code",
    forecast_days: "3", timezone: "Africa/Algiers", wind_speed_unit: "kmh"
  }).toString();
  const marineUrl = new URL("https://marine-api.open-meteo.com/v1/marine");
  marineUrl.search = new URLSearchParams({
    latitude: place.lat, longitude: place.lon,
    hourly: "wave_height,wave_direction,wave_period,wind_wave_height,swell_wave_height",
    forecast_days: "3", timezone: "Africa/Algiers", length_unit: "metric"
  }).toString();
  try {
    const results = await Promise.allSettled([
      fetch(weatherUrl).then(r => { if (!r.ok) throw new Error("weather " + r.status); return r.json(); }),
      fetch(marineUrl).then(r => { if (!r.ok) throw new Error("marine " + r.status); return r.json(); })
    ]);
    if (currentRequest !== requestCounter) return;
    const weather = results[0].status === "fulfilled" ? results[0].value : null;
    const marine = results[1].status === "fulfilled" ? results[1].value : null;
    const current = weather?.current;
    const marineHourly = marine?.hourly;
    const currentTime = current?.time;
    let marineIndex = marineHourly?.time?.findIndex(t => t === currentTime) ?? 0;
    if (marineIndex < 0) marineIndex = 0;
    el("windSpeed").textContent = numberOrDash(current?.wind_speed_10m, 0);
    el("windDirection").textContent = "الاتجاه: " + compass(current?.wind_direction_10m);
    el("waveHeight").textContent = numberOrDash(marineHourly?.wave_height?.[marineIndex], 1);
    el("waveDirection").textContent = "الاتجاه: " + compass(marineHourly?.wave_direction?.[marineIndex]);
    el("wavePeriod").textContent = numberOrDash(marineHourly?.wave_period?.[marineIndex], 0);
    el("temperature").textContent = numberOrDash(current?.temperature_2m, 1);
    el("gusts").textContent = "هبات الرياح: " + numberOrDash(current?.wind_gusts_10m, 0) + " كم/سا";
    const hourlyWeather = weather?.hourly;
const weatherTimes = hourlyWeather?.time || [];
const weatherIndex = weatherTimes.findIndex(t => t === currentTime);

const visibilityMeters = weatherIndex >= 0
  ? hourlyWeather?.visibility?.[weatherIndex]
  : null;

el("visibility").textContent =
  visibilityMeters == null ? "—" : (visibilityMeters / 1000).toFixed(1);

const weatherCode = weatherIndex >= 0
  ? hourlyWeather?.weather_code?.[weatherIndex]
  : null;

let fogText = "غير متوفر";

if (weatherCode != null) {
  if ([45, 48].includes(weatherCode)) {
    fogText = "ضباب";
  } else if ([51, 53, 55, 56, 57].includes(weatherCode)) {
    fogText = "رذاذ";
  } else {
    fogText = "الرمز لا يشير إلى ضباب";
  }
}

el("fogStatus").textContent = fogText;
    if (weather && marine) {
      renderForecast(weather, marine);
      setStatus("تم التحديث");
    } else if (weather || marine) {
      renderForecast(weather, marine);
      setStatus("بيانات جزئية", true);
    } else {
      el("forecast").innerHTML = '<div class="error-row">تعذر تحميل البيانات. تحقق من الإنترنت وحاول مجددًا.</div>';
      setStatus("تعذر الاتصال", true);
    }
    if (selectedLayer === "wind") {
      const speed = Number(current?.wind_speed_10m ?? 0);
      const m = markers.find((_, i) => coastalPlaces[i].name === place.name);
      if (m) m.setIcon(markerIcon(speed, "wind"));
    }
  } catch (error) {
    if (currentRequest !== requestCounter) return;
    console.error(error);
    setStatus("خطأ في البيانات", true);
    el("forecast").innerHTML = '<div class="error-row">تعذر تحميل البيانات. جرّب مرة أخرى بعد قليل.</div>';
  }
}
map.on("click", event => {
  const p = { name: "موقع مختار", lat: event.latlng.lat, lon: event.latlng.lng };
  loadLocation(p);
});
document.querySelectorAll(".layer-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    selectedLayer = btn.dataset.layer;
    updateMarkerStyles();
    if (selected) loadLocation(selected);
  });
});
el("refreshBtn").addEventListener("click", () => loadLocation(selected));
el("locateBtn").addEventListener("click", () => {
  if (!navigator.geolocation) {
    setStatus("الموقع غير مدعوم", true);
    return;
  }
  setStatus("تحديد الموقع…");
  navigator.geolocation.getCurrentPosition(
    pos => {
      const p = { name: "موقعي", lat: pos.coords.latitude, lon: pos.coords.longitude };
      map.flyTo([p.lat, p.lon], 9);
      loadLocation(p);
    },
    () => setStatus("لم يُسمح بالموقع", true),
    { enableHighAccuracy: false, timeout: 10000 }
  );
});

showPlaceList();
drawPlaceMarkers();
loadLocation(selected);


/* DzSea Wind - experimental animated wind layer */
(() => {
  const canvas = document.createElement("canvas");
  canvas.style.cssText =
    "position:absolute;inset:0;width:100%;height:100%;z-index:450;pointer-events:none;";
  map.getContainer().appendChild(canvas);

  const ctx = canvas.getContext("2d");
  let windPoints = [];
  let particles = [];
  let animationId;
  let refreshTimer;
  let loading = false;

  function resizeCanvas() {
    const rect = map.getContainer().getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);
    particles = [];
    for (let i = 0; i < 180; i++) {
      particles.push({
        x: Math.random() * rect.width,
        y: Math.random() * rect.height,
        age: Math.random() * 80
      });
    }
  }
  function nearestWind(lat, lon) {
    if (!windPoints.length) return null;

    let best = null;
    let bestDistance = Infinity;

    for (const p of windPoints) {
      const dx = (p.lon - lon) * Math.cos(lat * Math.PI / 180);
      const dy = p.lat - lat;
      const distance = dx * dx + dy * dy;

      if (distance < bestDistance) {
        bestDistance = distance;
        best = p;
      }
    }
    return best;
  }

  function windAt(x, y) {
    const ll = map.containerPointToLatLng([x, y]);
    const p = nearestWind(ll.lat, ll.lng);
    if (!p) return null;

    const angle = (p.direction + 180) * Math.PI / 180;
    return {
      dx: Math.sin(angle) * p.speed * 0.045,
      dy: -Math.cos(angle) * p.speed * 0.045,
      speed: p.speed
    };
  }

  function drawParticles() {
    const rect = map.getContainer().getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    if (selectedLayer !== "wind" || !windPoints.length) {
      ctx.clearRect(0, 0, w, h);
      animationId = requestAnimationFrame(drawParticles);
      return;
    }

    ctx.clearRect(0, 0, w, h);
    ctx.fillRect(0, 0, w, h);

    for (const p of particles) {
      const wind = windAt(p.x, p.y);

      if (!wind || wind.speed < 1) {
        p.age = 100;
      } else {
        const oldX = p.x;
        const oldY = p.y;

        p.x += wind.dx;
        p.y += wind.dy;
        p.age++;

        ctx.beginPath();
        ctx.moveTo(oldX, oldY);
        ctx.lineTo(p.x, p.y);

        ctx.strokeStyle =
          wind.speed < 10 ? "rgba(115,226,187,.8)" :
          wind.speed < 25 ? "rgba(75,214,231,.9)" :
          wind.speed < 40 ? "rgba(255,206,105,.9)" :
                            "rgba(255,138,120,.95)";

        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      if (
        p.age > 90 || p.x < 0 || p.x > w ||
        p.y < 0 || p.y > h
      ) {
        p.x = Math.random() * w;
        p.y = Math.random() * h;
        p.age = 0;
      }
    }

    animationId = requestAnimationFrame(drawParticles);
  }

  async function loadWindGrid() {
    if (loading || selectedLayer !== "wind") return;
    loading = true;

    try {
      const bounds = map.getBounds();
      const south = Math.max(-75, bounds.getSouth());
      const north = Math.min(75, bounds.getNorth());
      const west = Math.max(-180, bounds.getWest());
      const east = Math.min(180, bounds.getEast());

      const latitudes = [];
      const longitudes = [];
      const count = 9;

      for (let y = 0; y < count; y++) {
        for (let x = 0; x < count; x++) {
          latitudes.push(south + (north - south) * y / (count - 1));
          longitudes.push(west + (east - west) * x / (count - 1));
        }
      }

      const url = new URL("https://api.open-meteo.com/v1/forecast");
      url.search = new URLSearchParams({
        latitude: latitudes.join(","),
        longitude: longitudes.join(","),
        current: "wind_speed_10m,wind_direction_10m",
        wind_speed_unit: "kmh"
      }).toString();

      const response = await fetch(url);
      if (!response.ok) throw new Error("Wind API error");

      const result = await response.json();
      const locations = Array.isArray(result) ? result : [result];

      windPoints = locations.map((item, i) => ({
        lat: latitudes[i],
        lon: longitudes[i],
        speed: Number(item.current?.wind_speed_10m ?? 0),
        direction: Number(item.current?.wind_direction_10m ?? 0)
      })).filter(p =>
        Number.isFinite(p.speed) &&
        Number.isFinite(p.direction)
      );
    } catch (error) {
      console.error("Wind overlay:", error);
    } finally {
      loading = false;
    }
  }

  function scheduleWindRefresh() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      resizeCanvas();
      loadWindGrid();
    }, 900);
  }
canvas.style.display = "none";
  map.on("moveend zoomend", scheduleWindRefresh);
  map.on("movestart zoomstart", () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  });

  const oldUpdateMarkerStyles = updateMarkerStyles;
  updateMarkerStyles = function () {
    oldUpdateMarkerStyles();
    if (selectedLayer === "wind") {
      scheduleWindRefresh();
    } else {
      windPoints = [];
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  window.addEventListener("resize", resizeCanvas);

  resizeCanvas();
  loadWindGrid();
  drawParticles();
})();
