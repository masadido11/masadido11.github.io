const CONFIG = {
  geojsonPath: "./data/be.json",
  geojsonFallbackPath: "be.json",
  threshold: 5,
  totalSeats: 150,
  districts: {
    "Antwerp": { id: "antwerp", name: "Anvers", seats: 24, language: "nl" },
    "Limburg": { id: "limburg", name: "Limbourg", seats: 12, language: "nl" },
    "East Flanders": { id: "east-flanders", name: "Flandre orientale", seats: 20, language: "nl" },
    "Flemish Brabant": { id: "flemish-brabant", name: "Brabant flamand", seats: 15, language: "nl" },
    "West Flanders": { id: "west-flanders", name: "Flandre occidentale", seats: 16, language: "nl" },
    "Brussels": { id: "brussels", name: "Bruxelles-Capitale", seats: 16, language: "both" },
    "Walloon Brabant": { id: "walloon-brabant", name: "Brabant wallon", seats: 5, language: "fr" },
    "Hainaut": { id: "hainaut", name: "Hainaut", seats: 17, language: "fr" },
    "Liege": { id: "liege", name: "Liège", seats: 14, language: "fr" },
    "Luxembourg": { id: "luxembourg", name: "Luxembourg", seats: 4, language: "fr" },
    "Namur": { id: "namur", name: "Namur", seats: 7, language: "fr" },
    "GermanCommunity": {
      id: "german-community",
      name: "Communauté germanophone",
      seats: 0,
      language: "de",
      indicative: true,
      note: "Rattachée à la circonscription de Liège au niveau fédéral — saisie indicative, sans sièges propres."
    }
  }
};

// Approximate coordinates for the German-speaking Community marker (around Eupen).
const GERMAN_COMMUNITY_LATLNG = [50.6296, 6.0296];

// Partis par défaut demandés (partis traditionnels + principaux partis actuels).
// family: "fr" = francophone, "nl" = néerlandophone, "de" = germanophone,
// "both" = bilingue/national et visible dans toutes les circonscriptions.
const DEFAULT_PARTIES = [
  { id: "mr", name: "MR", short: "MR", color: "#0B3D91", family: "fr" },
  { id: "ps", name: "PS", short: "PS", color: "#E4032E", family: "fr" },
  { id: "le", name: "Les Engagés", short: "LE", color: "#F5A623", family: "fr" },
  { id: "ecolo", name: "Ecolo", short: "ECOLO", color: "#3C8E3C", family: "fr" },
  { id: "defi", name: "Défi", short: "DÉFI", color: "#EC008C", family: "fr" },
  { id: "ptb", name: "PTB/PVDA", short: "PTB", color: "#8B1E3F", family: "both" },
  { id: "openvld", name: "Open Vld", short: "VLD", color: "#1CADE4", family: "nl" },
  { id: "cdv", name: "CD&V", short: "CD&V", color: "#FF7F00", family: "nl" },
  { id: "vooruit", name: "Vooruit", short: "VRT", color: "#C9184A", family: "nl" },
  { id: "nva", name: "N-VA", short: "N-VA", color: "#FFD200", family: "nl" },
  { id: "vb", name: "Vlaams Belang", short: "VB", color: "#5C1A1A", family: "nl" },
  { id: "groen", name: "Groen", short: "GROEN", color: "#4CAF50", family: "nl" }
];

// Political left-to-right seating order used by the hemicycle visual.
const HEMICYCLE_ORDER = ["ptb", "ps", "vooruit", "groen", "ecolo", "defi", "le", "cdv", "openvld", "mr", "nva", "vb"];

let parties = [...DEFAULT_PARTIES];
let districts = {};
let selectedDistrictKey = "Antwerp";
let featureByKey = new Map();

const money = new Intl.NumberFormat("fr-BE", { maximumFractionDigits: 1 });

function makeBlankResult() {
  return Object.fromEntries(parties.map(p => [p.id, 0]));
}

function initializeDistricts() {
  districts = {};
  for (const key of Object.keys(CONFIG.districts)) {
    districts[key] = {
      ...CONFIG.districts[key],
      percentages: makeBlankResult(),
      seatsByParty: makeBlankResult(),
      winner: null
    };
  }
}

function slugDistrict(name) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-");
}

function getDistrictFromFeature(feature) {
  const name = feature?.properties?.name;
  if (name && CONFIG.districts[name]) return name;

  const slug = slugDistrict(name || "");
  for (const [key, info] of Object.entries(CONFIG.districts)) {
    if (slugDistrict(key) === slug || info.id === slug) return key;
  }
  return null;
}

function dHondt(percentages, seatCount, threshold = CONFIG.threshold) {
  const raw = Object.entries(percentages).map(([partyId, pct]) => [partyId, Number(pct) || 0]);
  const total = raw.reduce((sum, [, pct]) => sum + pct, 0);
  const allocations = Object.fromEntries(Object.keys(percentages).map(id => [id, 0]));

  if (total <= 0 || seatCount <= 0) return allocations;

  // Threshold is applied against the share of the entered total, exactly like the
  // real system applies it against the share of valid votes cast — the user's
  // raw numbers don't need to add up to exactly 100 for this to be correct.
  const eligible = raw.filter(([, pct]) => (pct / total) * 100 >= threshold && pct > 0);

  const quotients = [];
  for (const [partyId, votes] of eligible) {
    for (let divisor = 1; divisor <= seatCount; divisor++) {
      quotients.push({ partyId, value: votes / divisor });
    }
  }

  quotients.sort((a, b) => {
    if (b.value !== a.value) return b.value - a.value;
    return a.partyId.localeCompare(b.partyId);
  });

  for (let i = 0; i < Math.min(seatCount, quotients.length); i++) {
    allocations[quotients[i].partyId] += 1;
  }

  return allocations;
}

function sanitizePercent(value) {
  const n = Number(String(value).replace(",", "."));
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, n));
}

function calculateDistrict(district) {
  district.seatsByParty = dHondt(district.percentages, district.seats);
  district.winner = getWinner(district.percentages);
  return true;
}

function getWinner(percentages) {
  let winner = null;
  for (const p of parties) {
    const value = Number(percentages[p.id] || 0);
    if (winner === null || value > winner.value) {
      winner = { partyId: p.id, value };
    }
  }
  return winner && winner.value > 0 ? winner.partyId : null;
}

function calculateAll() {
  for (const district of Object.values(districts)) {
    calculateDistrict(district);
  }
  renderAll();
  showToast("Répartition recalculée pour les 11 circonscriptions.");
}

function nationalSeats() {
  const totals = Object.fromEntries(parties.map(p => [p.id, 0]));
  for (const district of Object.values(districts)) {
    for (const p of parties) totals[p.id] += district.seatsByParty[p.id] || 0;
  }
  return totals;
}

function districtTotal(district) {
  return Object.values(district.percentages).reduce((a, b) => a + Number(b || 0), 0);
}

function dominantPartyColor(district) {
  const winner = district.winner;
  if (!winner) return "#cbd5e1";
  return parties.find(p => p.id === winner)?.color || "#cbd5e1";
}

function getAllowedParties(district) {
  const allowedFamilies = district.allowedFamilies || [district.language || "both"];
  return parties.filter(p => allowedFamilies.includes(p.family) || p.family === "both");
}

function fetchGeoJson() {
  return fetch(CONFIG.geojsonPath)
    .then(response => {
      if (!response.ok) throw new Error(`Impossible de charger ./data/be.json (${response.status})`);
      return response.json();
    })
    .catch(primaryError => {
      console.warn(`Échec de chargement de ${CONFIG.geojsonPath} (${primaryError.message}). Essai de ${CONFIG.geojsonFallbackPath}...`);
      return fetch(CONFIG.geojsonFallbackPath).then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status} sur ${CONFIG.geojsonFallbackPath}`);
        return response.json();
      });
    });
}

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

function projectPoint([lon, lat], bounds, width, height, padding = 28) {
  const [minLon, minLat, maxLon, maxLat] = bounds;
  const x = padding + ((lon - minLon) / (maxLon - minLon || 1)) * (width - padding * 2);
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
  return getGeometryRings(geometry)
    .map(ring => ringToPath(ring, bounds, width, height))
    .join(" ");
}

function centroidOfFeature(feature) {
  const points = [];
  for (const ring of getGeometryRings(feature.geometry)) {
    for (const point of ring) points.push(point);
  }
  const lon = points.reduce((sum, p) => sum + p[0], 0) / Math.max(1, points.length);
  const lat = points.reduce((sum, p) => sum + p[1], 0) / Math.max(1, points.length);
  return [lon, lat];
}

function buildMap() {
  const mapEl = document.getElementById("map");
  mapEl.innerHTML = `
    <svg id="provinceMap" class="province-map" viewBox="0 0 900 720" preserveAspectRatio="xMidYMid meet"
         aria-label="Carte interactive des circonscriptions belges" role="img">
      <rect x="0" y="0" width="900" height="720" fill="#dbeafe"></rect>
      <g id="provinceLayer"></g>
    </svg>
  `;

  fetchGeoJson().then(geojson => {
    renderGeoJsonMap(geojson);
    selectDistrict("Antwerp");
  }).catch(error => {
    console.error(error);
    mapEl.innerHTML = `<div style="height:100%;min-height:650px;display:grid;place-items:center;padding:24px;text-align:center;color:#991b1b;background:#fef2f2"><div><strong>Impossible de charger la carte.</strong><p style="margin:8px 0 0;font-size:13px">Vérifie que <code>data/be.json</code> est bien présent.</p></div></div>`;
    showToast(`Impossible de charger la carte (${error.message}).`);
  });
}

function renderGeoJsonMap(geojson) {
  const width = 900;
  const height = 720;
  const coordinates = getAllCoordinates(geojson);
  const lons = coordinates.map(p => p[0]);
  const lats = coordinates.map(p => p[1]);
  const bounds = [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)];
  const layer = document.getElementById("provinceLayer");
  layer.innerHTML = "";
  featureByKey.clear();

  for (const feature of geojson.features) {
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
  if (!featureByKey.size) return;
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

function renderPartyInputs() {
  const district = districts[selectedDistrictKey];
  const container = document.getElementById("partyInputs");
  const allowed = getAllowedParties(district);

  container.innerHTML = allowed.map(p => {
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
        <span class="party-seat-preview" id="seat-${p.id}">${preview} sièges</span>
      </div>
    `;
  }).join("");

  container.querySelectorAll(".percent-input").forEach(input => {
    input.addEventListener("input", () => {
      const id = input.dataset.partyId;
      district.percentages[id] = sanitizePercent(input.value);
      calculateDistrict(district);
      updateInputSummary(false);
      updateSeatPreviews(district);
      renderNationalResults();
      renderMap();
    });
  });
}

function updateSeatPreviews(district) {
  for (const p of parties) {
    const el = document.getElementById(`seat-${p.id}`);
    if (el) el.textContent = `${district.seatsByParty[p.id] || 0} sièges`;
  }
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
  if (total <= 0) {
    warning.classList.remove("hidden");
    warning.textContent = "Aucune valeur saisie pour cette circonscription.";
  } else if (delta < 0.01) {
    warning.classList.add("hidden");
    warning.textContent = "";
  } else {
    warning.classList.remove("hidden");
    warning.textContent = `Total à ${total.toFixed(1)} % — les sièges sont calculés au prorata (pas besoin d'atteindre pile 100 %).`;
  }
}


function familyLabel(family) {
  return {
    fr: "Francophone",
    nl: "Néerlandophone",
    de: "Germanophone",
    both: "Toutes communautés"
  }[family] || "Toutes communautés";
}
function renderPartyList() {
  const list = document.getElementById("partyList");
  list.innerHTML = parties.map((p) => `
    <div class="party-config-row">
      <div class="party-config">
        <span class="mini-color" style="background:${p.color}"></span>
        <strong>${escapeHtml(p.name)}</strong>
        <small>${escapeHtml(p.short)} · ${escapeHtml(familyLabel(p.family))}</small>
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
  const familyInput = document.getElementById("newPartyFamily");

  const name = nameInput.value.trim();
  const short = (shortInput.value.trim() || name.slice(0, 5)).toUpperCase();
  const color = colorInput.value;
  const family = familyInput?.value || "both";

  if (!name) {
    showToast("Donne un nom au nouveau parti.");
    return;
  }

  if (!["fr", "nl", "de", "both"].includes(family)) {
    showToast("Catégorie linguistique invalide.");
    return;
  }

  const id = slugDistrict(`${name}-${Date.now()}`);
  parties.push({ id, name, short, color, family });

  for (const district of Object.values(districts)) {
    district.percentages[id] = 0;
    district.seatsByParty[id] = 0;
  }

  nameInput.value = "";
  shortInput.value = "";
  familyInput.value = "both";
  renderAll();
  showToast(`${name} (${familyLabel(family)}) a été ajouté.`);
}

function fillEvenly() {
  const district = districts[selectedDistrictKey];
  const allowed = getAllowedParties(district);
  if (allowed.length === 0) {
    showToast("Aucun parti disponible pour cette circonscription.");
    return;
  }

  const share = 100 / allowed.length;
  for (const p of parties) district.percentages[p.id] = 0;
  for (const p of allowed) district.percentages[p.id] = Number(share.toFixed(2));

  // Correct the rounding residue on the first allowed party.
  const sum = districtTotal(district);
  district.percentages[allowed[0].id] += Number((100 - sum).toFixed(2));

  calculateDistrict(district);
  renderAll();
  showToast("Répartition égale appliquée aux partis disponibles ici.");
}

function selectDistrict(key) {
  if (!districts[key]) return;
  selectedDistrictKey = key;
  const district = districts[key];

  document.getElementById("selectedTitle").textContent = district.name;
  document.getElementById("selectedSeats").textContent = district.seats;

  const noteEl = document.getElementById("selectedNote");
  if (district.note) {
    noteEl.textContent = district.note;
    noteEl.classList.remove("hidden");
  } else {
    noteEl.classList.add("hidden");
  }

  calculateDistrict(district);
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
