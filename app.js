const CONFIG = {
  geojsonPath: "data/be.json",
  threshold: 5,
  totalSeats: 150,
  districts: {
    "Antwerp": { id: "antwerp", name: "Anvers", seats: 24 },
    "Limburg": { id: "limburg", name: "Limbourg", seats: 12 },
    "East Flanders": { id: "east-flanders", name: "Flandre orientale", seats: 20 },
    "Flemish Brabant": { id: "flemish-brabant", name: "Brabant flamand", seats: 15 },
    "West Flanders": { id: "west-flanders", name: "Flandre occidentale", seats: 16 },
    "Brussels": { id: "brussels", name: "Bruxelles-Capitale", seats: 16 },
    "Walloon Brabant": { id: "walloon-brabant", name: "Brabant wallon", seats: 5 },
    "Hainaut": { id: "hainaut", name: "Hainaut", seats: 17 },
    "Liege": { id: "liege", name: "Liège", seats: 14 },
    "Luxembourg": { id: "luxembourg", name: "Luxembourg", seats: 4 },
    "Namur": { id: "namur", name: "Namur", seats: 7 }
  }
};

// Initial parties requested for the V1.
const DEFAULT_PARTIES = [
  { id: "mr", name: "MR", short: "MR", color: "#174ea6" },
  { id: "ps", name: "PS", short: "PS", color: "#e31b23" },
  { id: "nva", name: "N-VA", short: "N-VA", color: "#f4c430" },
  { id: "vb", name: "Vlaams Belang", short: "VB", color: "#7a1620" },
  { id: "cdv", name: "CD&V", short: "CD&V", color: "#f59e0b" }
];

// Add two useful default parties without making them mandatory.
const OPTIONAL_DEFAULT_PARTIES = [
  { id: "vooruit", name: "Vooruit", short: "VRT", color: "#cf1f2d" },
  { id: "groen", name: "Groen", short: "GRN", color: "#159447" }
];

let parties = [...DEFAULT_PARTIES, ...OPTIONAL_DEFAULT_PARTIES];
let districts = {};
let selectedDistrictKey = "Antwerp";
let mapSvg;
let geoJsonData;
let featureByKey = new Map();

function getGeometryRings(geometry) {
  if (!geometry) return [];
  if (geometry.type === "Polygon") return geometry.coordinates;
  if (geometry.type === "MultiPolygon") return geometry.coordinates.flat();
  return [];
}

function getAllCoordinates(geojson) {
  const coords = [];
  for (const feature of geojson.features) {
    for (const ring of getGeometryRings(feature.geometry)) {
      for (const point of ring) coords.push(point);
    }
  }
  return coords;
}

function projectPoint([lon, lat], bounds, width, height, padding = 26) {
  const [minLon, minLat, maxLon, maxLat] = bounds;
  const x = padding + ((lon - minLon) / (maxLon - minLon || 1)) * (width - padding * 2);
  // Latitude grows upward; SVG grows downward.
  const y = height - padding - ((lat - minLat) / (maxLat - minLat || 1)) * (height - padding * 2);
  return [x, y];
}

function ringToPath(ring, bounds, width, height) {
  return ring.map((point, i) => {
    const [x, y] = projectPoint(point, bounds, width, height);
    return `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(" ") + " Z";
}

function geometryToPath(geometry, bounds, width, height) {
  const rings = getGeometryRings(geometry);
  return rings.map(ring => ringToPath(ring, bounds, width, height)).join(" ");
}

function centroidOfFeature(feature) {
  const points = [];
  for (const ring of getGeometryRings(feature.geometry)) {
    for (const point of ring) points.push(point);
  }
  const lon = points.reduce((s, p) => s + p[0], 0) / Math.max(1, points.length);
  const lat = points.reduce((s, p) => s + p[1], 0) / Math.max(1, points.length);
  return [lon, lat];
}

function buildMap() {
  const mapEl = document.getElementById("map");
  mapEl.innerHTML = `
    <svg id="provinceMap" class="province-map" viewBox="0 0 900 720"
         preserveAspectRatio="xMidYMid meet"
         aria-label="Carte interactive des circonscriptions belges"
         role="img">
      <rect x="0" y="0" width="900" height="720" fill="#dbeafe"></rect>
      <g id="provinceLayer"></g>
    </svg>
  `;

  mapSvg = document.getElementById("provinceMap");

  fetch(CONFIG.geojsonPath)
    .then(response => {
      if (!response.ok) throw new Error(`GeoJSON HTTP ${response.status}`);
      return response.json();
    })
    .then(geojson => {
      geoJsonData = geojson;
      renderGeoJsonMap();
      selectDistrict("Antwerp");
    })
    .catch(error => {
      console.error(error);
      mapEl.innerHTML = `
        <div style="height:100%;min-height:650px;display:grid;place-items:center;padding:24px;text-align:center;color:#991b1b;background:#fef2f2">
          <div>
            <strong>Impossible de charger la carte.</strong>
            <p style="margin:8px 0 0;font-size:13px">Vérifie que <code>data/be.json</code> est bien présent dans le repository.</p>
          </div>
        </div>
      `;
      showToast("Impossible de charger data/be.json.");
    });
}

function renderGeoJsonMap() {
  const width = 900;
  const height = 720;
  const coordinates = getAllCoordinates(geoJsonData);
  const lons = coordinates.map(p => p[0]);
  const lats = coordinates.map(p => p[1]);
  const bounds = [
    Math.min(...lons),
    Math.min(...lats),
    Math.max(...lons),
    Math.max(...lats)
  ];

  const layer = document.getElementById("provinceLayer");
  layer.innerHTML = "";
  featureByKey.clear();

  for (const feature of geoJsonData.features) {
    const key = getDistrictFromFeature(feature);
    if (!key) continue;

    const district = districts[key];
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", geometryToPath(feature.geometry, bounds, width, height));
    path.setAttribute("class", "province-path");
    path.dataset.district = key;
    path.setAttribute("fill", dominantPartyColor(district));
    path.setAttribute("fill-opacity", "0.82");
    path.setAttribute("stroke", "#ffffff");
    path.setAttribute("stroke-width", "2");
    path.setAttribute("vector-effect", "non-scaling-stroke");
    path.setAttribute("title", district.name);

    path.addEventListener("click", () => selectDistrict(key));
    path.addEventListener("mouseenter", () => {
      path.setAttribute("stroke", "#0f172a");
      path.setAttribute("stroke-width", key === selectedDistrictKey ? "3.5" : "3");
    });
    path.addEventListener("mouseleave", () => {
      path.setAttribute("stroke", key === selectedDistrictKey ? "#0f172a" : "#ffffff");
      path.setAttribute("stroke-width", key === selectedDistrictKey ? "3.5" : "2");
    });

    layer.appendChild(path);
    featureByKey.set(key, path);

    const [lon, lat] = centroidOfFeature(feature);
    const [x, y] = projectPoint([lon, lat], bounds, width, height);
    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("x", x.toFixed(2));
    label.setAttribute("y", y.toFixed(2));
    label.setAttribute("class", "province-label");
    label.setAttribute("text-anchor", "middle");
    label.setAttribute("dominant-baseline", "middle");
    label.textContent = district.name;
    layer.appendChild(label);
  }

  renderMap();
}

function renderMap() {
  if (!geoJsonData) return;

  for (const [key, path] of featureByKey.entries()) {
    const district = districts[key];
    const selected = key === selectedDistrictKey;
    path.setAttribute("fill", dominantPartyColor(district));
    path.setAttribute("fill-opacity", selected ? "0.95" : "0.82");
    path.setAttribute("stroke", selected ? "#0f172a" : "#ffffff");
    path.setAttribute("stroke-width", selected ? "3.5" : "2");
    path.setAttribute("aria-label", `${district.name}, ${district.seats} sièges`);
  }

  renderLegend();
}

function renderLegend() {
  const legend = document.getElementById("mapLegend");
  legend.innerHTML = parties.map(p => `
    <span class="legend-item">
      <span class="legend-dot" style="background:${p.color}"></span>
      ${escapeHtml(p.short)}
    </span>
  `).join("");
}

function renderPartyInputs() {
  const district = districts[selectedDistrictKey];
  const container = document.getElementById("partyInputs");

  container.innerHTML = parties.map(p => {
    const value = Number(district.percentages[p.id] || 0);
    const preview = Number(district.seatsByParty[p.id] || 0);
    return `
      <div class="party-row">
        <label class="party-label" for="pct-${p.id}">
          <span class="party-dot" style="background:${p.color}"></span>
          <span>${escapeHtml(p.name)}</span>
        </label>
        <input class="percent-input" id="pct-${p.id}" data-party-id="${p.id}"
               type="number" min="0" max="100" step="0.1" value="${value}">
        <span class="party-seat-preview">${preview} sièges</span>
      </div>
    `;
  }).join("");

  container.querySelectorAll(".percent-input").forEach(input => {
    input.addEventListener("input", () => {
      const id = input.dataset.partyId;
      district.percentages[id] = sanitizePercent(input.value);
      updateInputSummary(false);
    });
  });
}

function updateInputSummary(recalculate = false) {
  const district = districts[selectedDistrictKey];
  if (recalculate) calculateDistrict(district);

  const total = districtTotal(district);
  const delta = Math.abs(total - 100);

  document.getElementById("inputTotal").textContent = `${total.toFixed(1)} %`;
  document.getElementById("selectedStatus").textContent =
    delta < 0.01 ? "100 % saisi" : `${total.toFixed(1)} % saisi`;

  const warning = document.getElementById("inputWarning");
  if (delta < 0.01) {
    warning.classList.add("hidden");
    warning.textContent = "";
  } else {
    warning.classList.remove("hidden");
    warning.textContent =
      total < 100
        ? `Il manque ${(100 - total).toFixed(1)} point(s) pour atteindre 100 %.`
        : `Le total dépasse 100 % de ${(total - 100).toFixed(1)} point(s).`;
  }
}

function renderPartyList() {
  const list = document.getElementById("partyList");
  list.innerHTML = parties.map((p, index) => `
    <div class="party-config-row">
      <div class="party-config">
        <span class="mini-color" style="background:${p.color}"></span>
        <strong>${escapeHtml(p.name)}</strong>
        <small>${escapeHtml(p.short)}</small>
      </div>
      <input type="color" value="${p.color}" data-color-id="${p.id}" aria-label="Couleur ${escapeHtml(p.name)}">
      <button class="delete-party" data-delete-id="${p.id}" title="Supprimer ${escapeHtml(p.name)}" ${parties.length <= 1 ? "disabled" : ""}>×</button>
    </div>
  `).join("");

  list.querySelectorAll("[data-color-id]").forEach(input => {
    input.addEventListener("input", () => {
      const party = parties.find(p => p.id === input.dataset.colorId);
      if (!party) return;
      party.color = input.value;
      renderAll();
    });
  });

  list.querySelectorAll("[data-delete-id]").forEach(button => {
    button.addEventListener("click", () => removeParty(button.dataset.deleteId));
  });
}

function removeParty(id) {
  const party = parties.find(p => p.id === id);
  if (!party) return;

  parties = parties.filter(p => p.id !== id);

  for (const district of Object.values(districts)) {
    delete district.percentages[id];
    delete district.seatsByParty[id];
    district.winner = getWinner(district.percentages);
  }

  renderAll();
  showToast(`${party.name} a été supprimé.`);
}

function addParty() {
  const nameInput = document.getElementById("newPartyName");
  const shortInput = document.getElementById("newPartyShort");
  const colorInput = document.getElementById("newPartyColor");

  const name = nameInput.value.trim();
  const short = (shortInput.value.trim() || name.slice(0, 5)).toUpperCase();
  const color = colorInput.value;

  if (!name) {
    showToast("Donne un nom au nouveau parti.");
    return;
  }

  const id = slugDistrict(`${name}-${Date.now()}`);
  parties.push({ id, name, short, color });

  for (const district of Object.values(districts)) {
    district.percentages[id] = 0;
    district.seatsByParty[id] = 0;
  }

  nameInput.value = "";
  shortInput.value = "";
  renderAll();
  showToast(`${name} a été ajouté à toutes les circonscriptions.`);
}

function fillEvenly() {
  const district = districts[selectedDistrictKey];
  const share = 100 / parties.length;

  for (const p of parties) district.percentages[p.id] = Number(share.toFixed(2));

  // Correct the rounding residue on the first party.
  const sum = districtTotal(district);
  district.percentages[parties[0].id] += Number((100 - sum).toFixed(2));

  calculateDistrict(district);
  renderAll();
  showToast("Répartition égale appliquée.");
}

function selectDistrict(key) {
  if (!districts[key]) return;
  selectedDistrictKey = key;
  const district = districts[key];

  document.getElementById("selectedTitle").textContent = district.name;
  document.getElementById("selectedSeats").textContent = district.seats;

  renderPartyInputs();
  updateInputSummary(false);
  renderMap();

}

function resetSimulation() {
  initializeDistricts();
  calculateAll();
  selectDistrict("Antwerp");
  showToast("Simulation réinitialisée.");
}

function renderNationalResults() {
  const totals = nationalSeats();
  const maxSeats = Math.max(1, ...Object.values(totals));
  const used = Object.values(totals).reduce((a, b) => a + b, 0);

  document.getElementById("nationalTotal").textContent = `${used} / ${CONFIG.totalSeats}`;

  const results = parties
    .map(p => ({ ...p, seats: totals[p.id] || 0 }))
    .sort((a, b) => b.seats - a.seats || a.name.localeCompare(b.name));

  document.getElementById("nationalResults").innerHTML = results.map(p => {
    const pct = CONFIG.totalSeats ? (p.seats / CONFIG.totalSeats) * 100 : 0;
    const width = (p.seats / maxSeats) * 100;
    return `
      <div class="result-row">
        <div class="result-main">
          <div class="result-name">
            <span>
              <span class="party-dot" style="display:inline-block;vertical-align:-1px;background:${p.color};margin-right:6px"></span>
              ${escapeHtml(p.name)}
            </span>
            <span>${pct.toFixed(1)} %</span>
          </div>
          <div class="result-bar">
            <div class="result-fill" style="width:${width}%;background:${p.color}"></div>
          </div>
        </div>
        <div class="seat-count">${p.seats}</div>
        <div class="seat-pct">sièges</div>
      </div>
    `;
  }).join("");
}

function renderAll() {
  renderPartyList();
  renderPartyInputs();
  renderNationalResults();
  renderMap();
  updateInputSummary(false);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[c]));
}

let toastTimer;
function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
}

// Event wiring
document.getElementById("calculateBtn").addEventListener("click", calculateAll);
document.getElementById("resetBtn").addEventListener("click", resetSimulation);
document.getElementById("fillEvenBtn").addEventListener("click", fillEvenly);
document.getElementById("addPartyBtn").addEventListener("click", addParty);

document.getElementById("newPartyName").addEventListener("keydown", e => {
  if (e.key === "Enter") addParty();
});
document.getElementById("newPartyShort").addEventListener("keydown", e => {
  if (e.key === "Enter") addParty();
});

initializeDistricts();
buildMap();
renderAll();
