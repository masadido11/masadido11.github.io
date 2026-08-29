const CONFIG = {
  geojsonPath: "data/be.json",
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
    "Namur": { id: "namur", name: "Namur", seats: 7, language: "fr" }
  }
};

// Political position: exg (extrême gauche) → exd (extrême droite). Used to place
// the party correctly in the hemicycle and to let custom parties self-classify.
const DEFAULT_PARTIES = [
  { id: "mr", name: "MR", short: "MR", color: "#0B3D91", family: "fr", position: "droite" },
  { id: "ps", name: "PS", short: "PS", color: "#E4032E", family: "fr", position: "gauche" },
  { id: "le", name: "Les Engagés", short: "LE", color: "#35FCDB", family: "fr", position: "centre" },
  { id: "ecolo", name: "Ecolo", short: "ECOLO", color: "#3C8E3C", family: "fr", position: "gauche" },
  { id: "defi", name: "Défi", short: "DÉFI", color: "#EC008C", family: "fr", position: "centre" },
  { id: "ptb", name: "PTB/PVDA", short: "PTB", color: "#8B1E3F", family: "both", position: "exg" },
  { id: "openvld", name: "Open Vld", short: "VLD", color: "#1CADE4", family: "nl", position: "droite" },
  { id: "cdv", name: "CD&V", short: "CD&V", color: "#FF7F00", family: "nl", position: "centre" },
  { id: "vooruit", name: "Vooruit", short: "VRT", color: "#C9184A", family: "nl", position: "gauche" },
  { id: "nva", name: "N-VA", short: "N-VA", color: "#FFD200", family: "nl", position: "droite" },
  { id: "vb", name: "Vlaams Belang", short: "VB", color: "#5C1A1A", family: "nl", position: "exd" },
  { id: "groen", name: "Groen", short: "GROEN", color: "#4CAF50", family: "nl", position: "gauche" }
];

// Political left-to-right seating order used by the hemicycle visual, and the
// bucket order used to place custom parties by their declared position.
const HEMICYCLE_ORDER = ["ptb", "ps", "vooruit", "groen", "ecolo", "defi", "le", "cdv", "openvld", "mr", "nva", "vb"];
const POSITION_ORDER = { exg: 0, gauche: 1, centre: 2, droite: 3, exd: 4 };
const POSITION_LABELS = { exg: "Extrême gauche", gauche: "Gauche", centre: "Centre", droite: "Droite", exd: "Extrême droite" };

// Résultats réels des élections fédérales du 9 juin 2024, par circonscription (en % des voix).
// Sources : pages Wikipédia (EN/FR) de chaque circonscription + résultats officiels SPF Intérieur.
// Chiffres arrondis ; les petites listes locales (Team Fouad Ahidar, Voor U, etc.) ne sont pas
// incluses car elles ne font pas partie des partis par défaut du simulateur.
const RESULTS_2024 = {
  "Antwerp": { nva: 30.97, vb: 20.97, vooruit: 10.74, cdv: 10.57, ptb: 10.52, groen: 7.59, openvld: 6.0 },
  "Limburg": { vb: 24.62, nva: 23.68, cdv: 15.73, vooruit: 13.04, ptb: 9.07, openvld: 7.11, groen: 3.0 },
  "East Flanders": { vb: 22.61, nva: 22.29, vooruit: 12.30, cdv: 12.12, openvld: 11.28, groen: 10.0, ptb: 8.0 },
  "Flemish Brabant": { nva: 25.52, vb: 16.65, vooruit: 13.69, cdv: 13.04, openvld: 11.68, ptb: 8.04, groen: 8.01 },
  "West Flanders": { vb: 24.52, nva: 23.22, vooruit: 16.62, cdv: 14.0, openvld: 8.0, groen: 6.0, ptb: 5.5 },
  "Brussels": { mr: 23.15, ptb: 16.75, ps: 18.6, le: 9.5, ecolo: 11.3, defi: 6.58, groen: 3.3, vooruit: 3.6, nva: 2.8, vb: 2.5, cdv: 1.0, openvld: 1.0 },
  "Walloon Brabant": { mr: 35.31, le: 22.66, ps: 12.39, ptb: 7.89, ecolo: 9.2, defi: 3.41 },
  "Hainaut": { ps: 28.9, mr: 26.1, le: 15.5, ptb: 14.0, ecolo: 4.0, defi: 2.0 },
  "Liege": { mr: 28.4, ps: 21.8, le: 16.4, ptb: 14.4, ecolo: 7.9, defi: 2.0 },
  "Luxembourg": { le: 32.09, mr: 30.90, ps: 16.81, ptb: 7.70, defi: 3.36, ecolo: 2.27 },
  "Namur": { le: 29.1, mr: 25.6, ps: 16.9, ptb: 10.1, ecolo: 7.1, defi: 2.0 }
};

let parties = [...DEFAULT_PARTIES];
let districts = {};
let selectedDistrictKey = "Antwerp";
let coalitionParties = new Set();
let map;
let geoJsonLayer;
let featureByKey = new Map();

function initTheme() {
  const btn = document.getElementById("themeToggleBtn");
  const applyLabel = () => {
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    btn.textContent = isDark ? "☀️ Clair" : "🌙 Sombre";
  };
  applyLabel();

  btn.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme");
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("bes-theme", next);
    applyLabel();
  });
}

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
  const lang = district.language || "both";
  if (lang === "both") return parties;
  return parties.filter(p => (p.family || "both") === "both" || p.family === lang);
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

// Belgium's area, with a little breathing room around the edges — panning
// beyond this box is blocked so the map can never wander off to another country.
const BELGIUM_BOUNDS = L.latLngBounds([49.15, 2.2], [51.75, 6.75]);

function buildMap() {
  map = L.map("map", {
    zoomControl: true,
    attributionControl: true,
    minZoom: 7,
    maxZoom: 10,
    maxBounds: BELGIUM_BOUNDS,
    maxBoundsViscosity: 1.0
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
  const allowed = getAllowedParties(district);

  container.innerHTML = allowed.map(p => {
    const value = Number(district.percentages[p.id] || 0);
    const preview = Number(district.seatsByParty[p.id] || 0);
    return `
      <div class="party-row">
        <div class="party-row-top">
          <label class="party-label" for="pct-${p.id}">
            <span class="party-dot" style="background:${p.color}"></span>
            <span>${escapeHtml(p.name)}</span>
          </label>
          <span class="party-seat-preview" id="seat-${p.id}">${preview} sièges</span>
        </div>
        <div class="party-row-controls">
          <input class="percent-slider" id="slider-${p.id}" data-party-id="${p.id}"
                 type="range" min="0" max="100" step="0.1" value="${value}"
                 style="color:${p.color}">
          <input class="percent-input" id="pct-${p.id}" data-party-id="${p.id}"
                 type="number" min="0" max="100" step="0.1" value="${value}">
        </div>
      </div>
    `;
  }).join("");

  function applyPercent(id, value) {
    district.percentages[id] = sanitizePercent(value);
    calculateDistrict(district);
    updateInputSummary(false);
    updateSeatPreviews(district);
    renderNationalResults();
    renderMap();
  }

  container.querySelectorAll(".percent-input").forEach(input => {
    input.addEventListener("input", () => {
      const id = input.dataset.partyId;
      applyPercent(id, input.value);
      const slider = document.getElementById(`slider-${id}`);
      if (slider) slider.value = district.percentages[id];
    });
  });

  container.querySelectorAll(".percent-slider").forEach(slider => {
    slider.addEventListener("input", () => {
      const id = slider.dataset.partyId;
      applyPercent(id, slider.value);
      const numberInput = document.getElementById(`pct-${id}`);
      if (numberInput) numberInput.value = district.percentages[id];
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

function renderPartyList() {
  const list = document.getElementById("partyList");
  list.innerHTML = parties.map(p => `
    <div class="party-config-row">
      <div class="party-config-top">
        <span class="mini-color" style="background:${p.color}"></span>
        <strong>${escapeHtml(p.name)}</strong>
        <small>${escapeHtml(p.short)}</small>
        <button class="delete-party" data-delete-id="${p.id}" title="Supprimer ${escapeHtml(p.name)}" ${parties.length <= 1 ? "disabled" : ""}>×</button>
      </div>
      <div class="party-config-controls">
        <select data-family-id="${p.id}" aria-label="Camp linguistique de ${escapeHtml(p.name)}">
          <option value="fr" ${p.family === "fr" ? "selected" : ""}>FR</option>
          <option value="nl" ${p.family === "nl" ? "selected" : ""}>NL</option>
          <option value="both" ${!p.family || p.family === "both" ? "selected" : ""}>National</option>
        </select>
        <select data-position-id="${p.id}" aria-label="Orientation politique de ${escapeHtml(p.name)}">
          ${Object.entries(POSITION_LABELS).map(([value, label]) =>
            `<option value="${value}" ${p.position === value ? "selected" : ""}>${label}</option>`
          ).join("")}
        </select>
        <input type="color" value="${p.color}" data-color-id="${p.id}" aria-label="Couleur ${escapeHtml(p.name)}">
      </div>
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

  list.querySelectorAll("[data-family-id]").forEach(select => {
    select.addEventListener("change", () => {
      const party = parties.find(p => p.id === select.dataset.familyId);
      if (!party) return;
      party.family = select.value;
      renderAll();
    });
  });

  list.querySelectorAll("[data-position-id]").forEach(select => {
    select.addEventListener("change", () => {
      const party = parties.find(p => p.id === select.dataset.positionId);
      if (!party) return;
      party.position = select.value;
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
  coalitionParties.delete(id);

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
  const familyInput = document.getElementById("newPartyFamily");
  const positionInput = document.getElementById("newPartyPosition");
  const colorInput = document.getElementById("newPartyColor");

  const name = nameInput.value.trim();
  const short = (shortInput.value.trim() || name.slice(0, 5)).toUpperCase();
  const family = familyInput.value || "both";
  const position = positionInput.value || "centre";
  const color = colorInput.value;

  if (!name) {
    showToast("Donne un nom au nouveau parti.");
    return;
  }

  const id = slugDistrict(`${name}-${Date.now()}`);
  parties.push({ id, name, short, color, family, position });

  for (const district of Object.values(districts)) {
    district.percentages[id] = 0;
    district.seatsByParty[id] = 0;
  }

  nameInput.value = "";
  shortInput.value = "";
  familyInput.value = "both";
  positionInput.value = "centre";
  renderAll();
  showToast(`${name} a été ajouté (${familyLabel(family)}, ${POSITION_LABELS[position].toLowerCase()}).`);
}

function familyLabel(family) {
  if (family === "fr") return "francophone";
  if (family === "nl") return "flamand";
  return "national";
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

function loadAllResults2024() {
  let filled = 0;

  for (const [key, district] of Object.entries(districts)) {
    const data = RESULTS_2024[key];
    if (!data) continue;

    for (const party of parties) {
      district.percentages[party.id] = data[party.id] || 0;
    }
    calculateDistrict(district);
    filled += 1;
  }

  renderAll();
  showToast(`Résultats 2024 chargés pour ${filled} circonscriptions. Modifie-les librement pour construire ton scénario 2029.`);
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

  const layer = featureByKey.get(key);
  if (layer && map) {
    if (typeof layer.getBounds === "function") {
      map.fitBounds(layer.getBounds(), { maxZoom: 9, padding: [24, 24], animate: true });
    } else if (typeof layer.getLatLng === "function") {
      map.setView(layer.getLatLng(), 9, { animate: true });
    }
  }
}

function resetSimulation() {
  initializeDistricts();
  calculateAll();
  selectDistrict("Antwerp");
  showToast("Nouveau simulateur 2029 vierge — à toi de jouer.");
}

function computeHemicycleRows(total, rowCount) {
  const minR = 62;
  const maxR = 230;
  const step = rowCount > 1 ? (maxR - minR) / (rowCount - 1) : 0;
  const radii = Array.from({ length: rowCount }, (_, i) => minR + step * i);

  const rawSum = radii.reduce((a, b) => a + b, 0);
  const seatsPerRow = radii.map(r => Math.max(1, Math.round((total * r) / rawSum)));

  let diff = total - seatsPerRow.reduce((a, b) => a + b, 0);
  let idx = rowCount - 1;
  let guard = 0;
  while (diff !== 0 && guard < 10000) {
    if (diff > 0) {
      seatsPerRow[idx] += 1;
      diff -= 1;
    } else if (seatsPerRow[idx] > 1) {
      seatsPerRow[idx] -= 1;
      diff += 1;
    }
    idx = (idx - 1 + rowCount) % rowCount;
    guard += 1;
  }

  return { radii, seatsPerRow };
}

// Left-to-right ideological ordering used to build the wedge of seats.
// Custom/user-added parties fall back to a position based on their language family.
function orderedSeatSequence() {
  const totals = nationalSeats();

  const scored = parties.map(p => {
    const bucket = POSITION_ORDER[p.position] ?? POSITION_ORDER.centre;
    const knownIndex = HEMICYCLE_ORDER.indexOf(p.id);
    // Within the same left-right bucket, classic parties keep their historical
    // relative order; custom parties settle at the end of their bucket, sorted by name.
    const tie = knownIndex !== -1 ? knownIndex : 50;
    return { party: p, score: bucket * 100 + tie };
  });

  scored.sort((a, b) => a.score - b.score || a.party.name.localeCompare(b.party.name));

  const sequence = [];
  for (const { party } of scored) {
    const seatCount = totals[party.id] || 0;
    for (let i = 0; i < seatCount; i++) sequence.push(party);
  }
  return sequence;
}

function renderHemicycle() {
  const svg = document.getElementById("hemicycleSvg");
  if (!svg) return;

  const total = CONFIG.totalSeats;
  const rowCount = 9;
  const { radii, seatsPerRow } = computeHemicycleRows(total, rowCount);

  const cx = 300;
  const cy = 300;

  // Generate every seat's (x, y, angle), regardless of row.
  const points = [];
  radii.forEach((r, rowIndex) => {
    const count = seatsPerRow[rowIndex];
    for (let i = 0; i < count; i++) {
      const angle = Math.PI - (Math.PI * (i + 0.5)) / count;
      points.push({
        x: cx + r * Math.cos(angle),
        y: cy - r * Math.sin(angle),
        angle
      });
    }
  });

  // Sort seats left-to-right by angle so parties form contiguous wedges,
  // then paint them in political left-to-right order — the standard technique
  // behind real parliament diagrams.
  points.sort((a, b) => b.angle - a.angle);

  const sequence = orderedSeatSequence();
  const hasSelection = coalitionParties.size > 0;

  const circles = points.map((pt, i) => {
    const party = sequence[i];
    const color = party ? party.color : "#e2e8f0";
    const label = party ? escapeHtml(party.name) : "Siège non attribué";
    const inCoalition = party && coalitionParties.has(party.id);
    const stroke = inCoalition ? "#0f172a" : "#ffffff";
    const strokeWidth = inCoalition ? 2.2 : 1;
    const opacity = hasSelection && !inCoalition ? 0.35 : 1;
    return `<circle cx="${pt.x.toFixed(1)}" cy="${pt.y.toFixed(1)}" r="6.4" fill="${color}" stroke="${stroke}" stroke-width="${strokeWidth}" opacity="${opacity}"><title>${label}</title></circle>`;
  }).join("");

  const used = sequence.length;
  svg.innerHTML = `
    ${circles}
    <text x="300" y="316" text-anchor="middle" font-size="15" font-weight="700" fill="#152033">${used} / ${total} sièges attribués</text>
  `;
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

const MAJORITY_SEATS = 76;

function toggleCoalitionParty(id) {
  if (coalitionParties.has(id)) {
    coalitionParties.delete(id);
  } else {
    coalitionParties.add(id);
  }
  renderCoalition();
  renderHemicycle();
}

function renderCoalition() {
  const list = document.getElementById("coalitionList");
  if (!list) return;

  const totals = nationalSeats();
  const rows = parties
    .map(p => ({ ...p, seats: totals[p.id] || 0 }))
    .sort((a, b) => b.seats - a.seats || a.name.localeCompare(b.name));

  list.innerHTML = rows.map(p => `
    <div class="coalition-row ${coalitionParties.has(p.id) ? "selected" : ""}" data-coalition-id="${p.id}">
      <span class="coalition-dot" style="background:${p.color}"></span>
      <span class="coalition-name">${escapeHtml(p.name)}</span>
      <span class="coalition-seats">${p.seats}</span>
    </div>
  `).join("");

  list.querySelectorAll("[data-coalition-id]").forEach(row => {
    row.addEventListener("click", () => toggleCoalitionParty(row.dataset.coalitionId));
  });

  const coalitionSeats = [...coalitionParties].reduce((sum, id) => sum + (totals[id] || 0), 0);
  const badge = document.getElementById("coalitionBadge");
  const status = document.getElementById("coalitionStatus");
  badge.textContent = `${coalitionSeats} / ${MAJORITY_SEATS}`;

  if (coalitionParties.size === 0) {
    status.textContent = "Sélectionne des partis pour composer une coalition.";
    status.className = "coalition-status";
  } else if (coalitionSeats >= MAJORITY_SEATS) {
    status.textContent = `Coalition validée — majorité absolue (${coalitionSeats} sièges).`;
    status.className = "coalition-status ok";
  } else {
    status.textContent = `Coalition insuffisante — il manque ${MAJORITY_SEATS - coalitionSeats} siège(s).`;
    status.className = "coalition-status short";
  }
}

function renderAll() {
  renderPartyList();
  renderPartyInputs();
  renderNationalResults();
  renderHemicycle();
  renderCoalition();
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
document.getElementById("loadAll2024Btn").addEventListener("click", loadAllResults2024);
document.getElementById("fillEvenBtn").addEventListener("click", fillEvenly);
document.getElementById("addPartyBtn").addEventListener("click", addParty);

document.getElementById("newPartyName").addEventListener("keydown", e => {
  if (e.key === "Enter") addParty();
});
document.getElementById("newPartyShort").addEventListener("keydown", e => {
  if (e.key === "Enter") addParty();
});

window.addEventListener("resize", () => {
  if (map) map.invalidateSize();
});

initializeDistricts();
initTheme();
buildMap();
renderAll();
