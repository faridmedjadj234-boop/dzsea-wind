
/* ==========================================
   DzSea Wind — Algeria Coastal Weather
   Weather: Open-Meteo
   Map: Leaflet + OpenStreetMap
   ========================================== */

"use strict";

// 1. المدن الساحلية الجزائرية
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

// 2. التأكد من وجود الخريطة
const el = id => document.getElementById(id);

if (typeof L === "undefined" || !el("map")) {
  console.error("DzSea Wind: Leaflet أو عنصر الخريطة غير موجود.");
  if (el("status")) {
    el("status").textContent =
      "تعذر تشغيل الخريطة. تحقق من تحميل مكتبة Leaflet.";
  }
  throw new Error("Map initialization failed");
}

// 3. إعداد الخريطة
const map = L.map("map", {
  zoomControl: false
}).setView([36.25, 3.2], 7);

L.control.zoom({ position: "bottomright" }).addTo(map);

L.tileLayer(
  "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  {
    maxZoom: 18,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }
).addTo(map);

// 4. حالة الموقع
let selectedLayer = "wind";
let selected = {
  name: "تيبازة",
  lat: 36.589,
  lon: 2.448
};

let markers = [];
let requestCounter = 0;

function setText(id, value) {
  const node = el(id);
  if (node) node.textContent = value;
}

function numberOrDash(value, digits = 1) {
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    !Number.isFinite(Number(value))
  ) {
    return "—";
  }

  return Number(value).toFixed(digits);
}

function compass(deg) {
  if (
    deg === null ||
    deg === undefined ||
    !Number.isFinite(Number(deg))
  ) {
    return "—";
  }

  const directions = [
    "شمال",
    "شمال شرق",
    "شرق",
    "جنوب شرق",
    "جنوب",
    "جنوب غرب",
    "غرب",
    "شمال غرب"
  ];

  const index =
    Math.round((((Number(deg) % 360) + 360) % 360) / 45) % 8;

  return directions[index] + ` (${Math.round(Number(deg))}°)`;
}

function windColor(speed) {
  if (speed < 10) return "#73e2bb";
  if (speed < 25) return "#4bd6e7";
  if (speed < 40) return "#ffce69";
  return "#ff8a78";
}

function setStatus(message, error = false) {
  setText("status", message);

  const node = el("status");
  if (node) {
    node.style.color = error ? "#ffb9a8" : "#76e0bb";
  }
}

// 5. رموز الخريطة
function markerIcon(value, layer, direction = 0) {
  const isWind = layer === "wind";
  const content = isWind ? "➤" : "≈";
  const color = isWind
    ? windColor(Number(value ?? 0))
    : "#77c8ff";

  const rotation = isWind
    ? Number(direction || 0)
    : 0;

  return L.divIcon({
    className: "",
    html: `
      <div class="wind-marker ${isWind ? "" : "wave"}"
           style="color:${color};transform:rotate(${rotation}deg)">
        ${content}
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20]
  });
}

// 6. قائمة المدن
function showPlaceList() {
  const container = el("places");
  if (!container) return;

  container.innerHTML = coastalPlaces.map((place, index) => `
    <button class="place-btn" data-place="${index}">
      <strong>${place.name}</strong>
      <span>${place.lat.toFixed(2)}°, ${place.lon.toFixed(2)}°</span>
    </button>
  `).join("");

  container.querySelectorAll("[data-place]").forEach(button => {
    button.addEventListener("click", () => {
      const place = coastalPlaces[Number(button.dataset.place)];

      map.flyTo([place.lat, place.lon], 9, {
        duration: 0.7
      });

      loadLocation(place);
    });
  });
}

// 7. علامات المدن
function drawPlaceMarkers() {
  markers.forEach(marker => map.removeLayer(marker));
  markers = [];

  coastalPlaces.forEach(place => {
    const marker = L.marker(
      [place.lat, place.lon],
      { icon: markerIcon(null, selectedLayer) }
    ).addTo(map);

    marker.bindTooltip(place.name, {
      direction: "top",
      offset: [0, -16]
    });

    marker.on("click", () => loadLocation(place));
    markers.push(marker);
  });
}

function updateMarkerStyles() {
  markers.forEach(marker => {
    marker.setIcon(markerIcon(null, selectedLayer));
  });

  setText(
    "legendText",
    selectedLayer === "wind"
      ? "سرعة الرياح — كم/سا"
      : "ارتفاع الموج — متر"
  );

  document.querySelectorAll(".layer-btn").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.layer === selectedLayer
    );
  });
}

// 8. جلب البيانات من واجهة الطقس
async function fetchWeather(place) {
  const url = new URL("https://api.open-meteo.com/v1/forecast");

  url.search = new URLSearchParams({
    latitude: String(place.lat),
    longitude: String(place.lon),
    current:
      "temperature_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m",
    hourly:
      "wind_speed_10m,wind_direction_10m,visibility,weather_code",
    forecast_days: "3",
    timezone: "Africa/Algiers",
    wind_speed_unit: "kmh"
  }).toString();

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("Weather API: " + response.status);
  }

  return response.json();
}

// 9. جلب بيانات الأمواج
async function fetchMarine(place) {
  const url = new URL("https://marine-api.open-meteo.com/v1/marine");

  url.search = new URLSearchParams({
    latitude: String(place.lat),
    longitude: String(place.lon),
    hourly: "wave_height,wave_period",
    forecast_days: "3",
    timezone: "Africa/Algiers"
  }).toString();

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("Marine API: " + response.status);
  }

  return response.json();
}

// 10. تحديد الساعة الأقرب إلى الوقت الحالي
function findNearestHour(times, currentTime) {
  if (!Array.isArray(times) || !times.length || !currentTime) {
    return -1;
  }

  const target = new Date(currentTime).getTime();
  if (!Number.isFinite(target)) return -1;

  let nearestIndex = -1;
  let nearestDifference = Infinity;

  times.forEach((time, index) => {
    const timestamp = new Date(time).getTime();
    const difference = Math.abs(timestamp - target);

    if (
      Number.isFinite(difference) &&
      difference < nearestDifference
    ) {
      nearestDifference = difference;
      nearestIndex = index;
    }
  });

  // ما نقبلوش بيانات بعيدة بأكثر من ساعة
  return nearestDifference <= 60 * 60 * 1000
    ? nearestIndex
    : -1;
}

// 11. حالة الرؤية والضباب
function renderVisibility(weather) {
  const hourly = weather?.hourly;
  const currentTime = weather?.current?.time;
  const times = hourly?.time || [];

  const index = findNearestHour(times, currentTime);

  const visibility = index >= 0
    ? hourly?.visibility?.[index]
    : null;

  setText(
    "visibility",
    Number.isFinite(visibility)
      ? (visibility / 1000).toFixed(1)
      : "—"
  );

  const code = index >= 0
    ? hourly?.weather_code?.[index]
    : null;

  let fogText = "غير متوفر";

  if (code !== null && code !== undefined) {
    const weatherCode = Number(code);

    if ([45, 48].includes(weatherCode)) {
      fogText = "ضباب";
    } else if ([51, 53, 55, 56, 57].includes(weatherCode)) {
      fogText = "رذاذ";
    } else {
      fogText = "الرمز لا يشير إلى ضباب";
    }
  }

  setText("fogStatus", fogText);
}

// 12. عرض التوقعات بالساعات
function renderForecast(weather, marine) {
  const container = el("forecast");
  if (!container) return;

  const weatherTimes = weather?.hourly?.time || [];
  const windSpeeds = weather?.hourly?.wind_speed_10m || [];
  const windDirections = weather?.hourly?.wind_direction_10m || [];

  const marineTimes = marine?.hourly?.time || [];
  const waveHeights = marine?.hourly?.wave_height || [];
  const wavePeriods = marine?.hourly?.wave_period || [];

  if (!weatherTimes.length && !marineTimes.length) {
    container.innerHTML =
      '<div class="error-row">لا توجد توقعات متاحة حاليًا.</div>';
    return;
  }

  const currentTime =
    weather?.current?.time || marineTimes[0];

  let start = findNearestHour(weatherTimes, currentTime);
  if (start < 0) start = 0;

  const indices = [];

  for (
    let i = start;
    i < Math.min(weatherTimes.length, start + 24);
    i += 3
  ) {
    indices.push(i);
  }

  if (!indices.length) {
    container.innerHTML =
      '<div class="error-row">لا توجد توقعات متاحة حاليًا.</div>';
    return;
  }

  container.innerHTML = indices.map(i => {
    const time = weatherTimes[i];
    const date = new Date(time);

    const label = Number.isFinite(date.getTime())
      ? date.toLocaleString("ar-DZ", {
          weekday: "short",
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "Africa/Algiers"
        })
      : time;

    const marineIndex = findNearestHour(marineTimes, time);

    const windSpeed = windSpeeds[i];
    const windDirection = windDirections[i];

    const waveHeight = marineIndex >= 0
      ? waveHeights[marineIndex]
      : null;

    const wavePeriod = marineIndex >= 0
      ? wavePeriods[marineIndex]
      : null;

    const isWind = selectedLayer === "wind";

    const mainValue = isWind
      ? numberOrDash(windSpeed, 0)
      : numberOrDash(waveHeight, 1);

    const subValue = isWind
      ? "كم/سا · " + compass(windDirection)
      : "متر · " + numberOrDash(wavePeriod, 0) + " ثا";

    return `
      <article class="forecast-item">
        <div class="forecast-time">${label}</div>
        <div class="forecast-symbol">${isWind ? "💨" : "🌊"}</div>
        <div class="forecast-main">${mainValue}</div>
        <div class="forecast-sub">${subValue}</div>
      </article>
    `;
  }).join("");
}

// 13. تحميل بيانات الموقع المختار
async function loadLocation(place) {
  const requestId = ++requestCounter;
  selected = place;

  setStatus("جاري تحميل بيانات " + place.name + "…");

  const weatherResult = fetchWeather(place)
    .then(data => ({ ok: true, data }))
    .catch(error => ({ ok: false, error }));

  const marineResult = fetchMarine(place)
    .then(data => ({ ok: true, data }))
    .catch(error => ({ ok: false, error }));

  const [weatherResponse, marineResponse] = await Promise.all([
    weatherResult,
    marineResult
  ]);

  // تجاهل الردود القديمة إذا اختار المستخدم مدينة أخرى
  if (requestId !== requestCounter) return;

  const weather = weatherResponse.ok
    ? weatherResponse.data
    : null;

  const marine = marineResponse.ok
    ? marineResponse.data
    : null;

  const current = weather?.current;

  // تحديث بطاقات الطقس إذا كانت موجودة في index.html
  // الأسماء البديلة تسمح بدعم بعض اختلافات أسماء العناصر.
  const windValue = numberOrDash(current?.wind_speed_10m, 0);
  const windDirection = compass(current?.wind_direction_10m);
  const temperature = numberOrDash(current?.temperature_2m, 1);

  const marineTimes = marine?.hourly?.time || [];
const waveHeights = marine?.hourly?.wave_height || [];
const wavePeriods = marine?.hourly?.wave_period || [];

const marineIndex = findNearestHour(
  marineTimes,
  current?.time || marineTimes[0]
);

const waveValue = numberOrDash(
  marineIndex >= 0 ? waveHeights[marineIndex] : null,
  1
);

const wavePeriodValue = numberOrDash(
  marineIndex >= 0 ? wavePeriods[marineIndex] : null,
  0
);

  [
    "windSpeed",
    "windValue",
    "wind"
  ].forEach(id => setText(id, windValue));

  [
    "windDirection",
    "windDir"
  ].forEach(id => setText(id, windDirection));

  [
    "temperature",
    "temp",
    "temperatureValue"
  ].forEach(id => setText(id, temperature));

  [
    "waveHeight",
    "waveValue",
    "waves"
  ].forEach(id => setText(id, waveValue));

  setText(
    "gusts",
    "هبات الرياح: " +
      numberOrDash(current?.wind_gusts_10m, 0) +
      " كم/سا"
  );

  renderVisibility(weather);
  renderForecast(weather, marine);

  // تحديث رمز المدينة المختارة
  const markerIndex = coastalPlaces.findIndex(
    item => item.name === place.name
  );

  if (markerIndex >= 0 && markers[markerIndex]) {
    const value = selectedLayer === "wind"
      ? current?.wind_speed_10m
      : marine?.current?.wave_height;

    markers[markerIndex].setIcon(
      markerIcon(
        value,
        selectedLayer,
        current?.wind_direction_10m ?? 0
      )
    );
  }

  if (weather && marine) {
    setStatus("تم تحديث بيانات " + place.name);
  } else if (weather || marine) {
    setStatus("بيانات جزئية — تعذر تحميل بعض المعلومات", true);
  } else {
    setStatus("تعذر الاتصال. تحقق من الإنترنت وحاول مجددًا.", true);
  }
}

// 14. اختيار نقطة على الخريطة
map.on("click", event => {
  const place = {
    name: "موقع مختار",
    lat: event.latlng.lat,
    lon: event.latlng.lng
  };

  loadLocation(place);
});

// 15. التبديل بين الرياح والأمواج
document.querySelectorAll(".layer-btn").forEach(button => {
  button.addEventListener("click", () => {
    const layer = button.dataset.layer;

    if (layer !== "wind" && layer !== "waves") return;

    selectedLayer = layer;
    updateMarkerStyles();

    if (selected) loadLocation(selected);
  });
});

// 16. زر تحديث البيانات
if (el("refreshBtn")) {
  el("refreshBtn").addEventListener("click", () => {
    if (selected) loadLocation(selected);
  });
}

// 17. تحديد الموقع الحالي
if (el("locateBtn")) {
  el("locateBtn").addEventListener("click", () => {
    if (!navigator.geolocation) {
      setStatus("تحديد الموقع غير مدعوم في هذا المتصفح", true);
      return;
    }

    setStatus("جاري تحديد الموقع…");

    navigator.geolocation.getCurrentPosition(
      position => {
        const place = {
          name: "موقعي",
          lat: position.coords.latitude,
          lon: position.coords.longitude
        };

        map.flyTo([place.lat, place.lon], 9);
        loadLocation(place);
      },
      () => {
        setStatus(
          "تعذر تحديد الموقع. تحقق من إذن الموقع في المتصفح.",
          true
        );
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 60000
      }
    );
  });
}

// 18. بدء تشغيل الموقع
showPlaceList();
drawPlaceMarkers();
updateMarkerStyles();
loadLocation(selected);

// إصلاح عرض الخريطة بعد تحميل الصفحة
window.addEventListener("load", () => {
  setTimeout(() => map.invalidateSize(), 200);
});

window.addEventListener("resize", () => {
  map.invalidateSize();
});

// إبقاء الطبقة التجريبية مخفية كما كانت.
// لا نشغّل رسومها المتحركة أو طلباتها الإضافية.
const experimentalCanvas = document.createElement("canvas");
experimentalCanvas.style.display = "none";
