const CONFIG = {
  geojsonPath: "data/be.json",
  geojsonFallbackPath: "be.json",
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
let map;
let geoJsonLayer;
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
  const eligible = Object.entries(percentages)
    .map(([partyId, pct]) => [partyId, Number(pct) || 0])
    .filter(([, pct]) => pct >= threshold && pct > 0);

  const allocations = Object.fromEntries(Object.keys(percentages).map(id => [id, 0]));
  const quotients = [];

  for (const [partyId, votes] of eligible) {
    for (let divisor = 1; divisor <= seatCount; divisor++) {
      quotients.push({ partyId, value: votes / divisor });
    }
  }

  // The official system works with vote figures and quotients.
  // Percentages are valid here because all parties share the same total.
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
  const total = Object.values(district.percentages).reduce((a, b) => a + Number(b || 0), 0);

  if (Math.abs(total - 100) > 0.01) {
    district.seatsByParty = makeBlankResult();
    district.winner = getWinner(district.percentages);
    return false;
  }

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
  let valid = true;
  for (const district of Object.values(districts)) {
    valid = calculateDistrict(district) && valid;
  }
  renderAll();
  if (!valid) {
    showToast("Certaines circonscriptions ne totalisent pas 100 %.");
  } else {
    showToast("Répartition calculée avec le seuil de 5 % et D'Hondt.");
  }
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

function fetchGeoJson() {
  return fetch(CONFIG.geojsonPath)
    .then(response => {
      if (!response.ok) throw new Error(`HTTP ${response.status} sur ${CONFIG.geojsonPath}`);
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

function buildMap() {
  map = L.map("map", {
    zoomControl: true,
    attributionControl: true,
    minZoom: 7,
    maxZoom: 10
  }).setView([50.65, 4.55], 8);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  fetchGeoJson()
    .then(geojson => {
      geoJsonLayer = L.geoJSON(geojson, {
        style: featureStyle,
        onEachFeature: (feature, layer) => {
          const key = getDistrictFromFeature(feature);
          if (!key) return;

          featureByKey.set(key, layer);
          layer.options.className = "province-path";

          layer.on({
            click: () => selectDistrict(key),
            mouseover: e => {
              e.target.setStyle({ weight: 2.5, fillOpacity: 0.9 });
              e.target.bringToFront();
            },
            mouseout: e => {
              geoJsonLayer.resetStyle(e.target);
            }
          });

          layer.bindTooltip(CONFIG.districts[key].name, {
            sticky: true,
            direction: "center",
            className: "province-tooltip"
          });
        }
      }).addTo(map);

      map.fitBounds(geoJsonLayer.getBounds(), { padding: [18, 18] });
      renderMap();
      selectDistrict("Antwerp");
    })
    .catch(error => {
      console.error(error);
      showToast(`Impossible de charger le fichier de carte (${error.message}).`);
    });
}

function featureStyle(feature) {
  const key = getDistrictFromFeature(feature);
  const district = key ? districts[key] : null;
  return {
    color: "#ffffff",
    weight: 1.25,
    fillColor: district ? dominantPartyColor(district) : "#cbd5e1",
    fillOpacity: 0.75
  };
}

function renderMap() {
  if (!geoJsonLayer) return;

  geoJsonLayer.eachLayer(layer => {
    const feature = layer.feature;
    const key = getDistrictFromFeature(feature);
    const district = districts[key];

    layer.setStyle({
      color: key === selectedDistrictKey ? "#0f172a" : "#ffffff",
      weight: key === selectedDistrictKey ? 3 : 1.25,
      fillColor: dominantPartyColor(district),
      fillOpacity: key === selectedDistrictKey ? 0.92 : 0.75
    });

    const status = districtTotal(district);
    layer.setTooltipContent(
      `<strong>${district.name}</strong><br>${district.seats} sièges<br>${status.toFixed(1)} % saisi`
    );
  });

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

  const layer = featureByKey.get(key);
  if (layer && map) map.fitBounds(layer.getBounds(), { maxZoom: 9, padding: [24, 24], animate: true });
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
