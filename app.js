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
    hourly: "wind_speed_10m,wind_direction_10m",
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
