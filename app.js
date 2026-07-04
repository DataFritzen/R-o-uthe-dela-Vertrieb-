const STORAGE_KEY = "vertriebsapp.projects.v2";
const LEGACY_STORAGE_KEY = "vertriebsapp.projects.v1";
const statuses = ["Neu", "Angesprochen", "Interessiert", "Angebot", "Gewonnen", "Kein Bedarf"];
const termProfiles = {
  camping: {
    label: "Camping",
    tags: [
      ["tourism", "camp_site"],
      ["tourism", "caravan_site"]
    ],
    name: "camp|camping|campingplatz|wohnmobil"
  },
  campingplatz: {
    label: "Camping",
    tags: [
      ["tourism", "camp_site"],
      ["tourism", "caravan_site"]
    ],
    name: "camp|camping|campingplatz|wohnmobil"
  },
  campingplatze: {
    label: "Camping",
    tags: [
      ["tourism", "camp_site"],
      ["tourism", "caravan_site"]
    ],
    name: "camp|camping|campingplatz|wohnmobil"
  },
  wohnmobilstellplatz: {
    label: "Camping",
    tags: [
      ["tourism", "caravan_site"],
      ["tourism", "camp_site"]
    ],
    name: "wohnmobil|stellplatz|camping"
  },
  minigolf: {
    label: "Minigolf",
    tags: [
      ["leisure", "miniature_golf"],
      ["sport", "miniature_golf"]
    ],
    name: "minigolf|mini golf|adventure golf"
  },
  minigolfplatz: {
    label: "Minigolf",
    tags: [
      ["leisure", "miniature_golf"],
      ["sport", "miniature_golf"]
    ],
    name: "minigolf|mini golf|adventure golf"
  },
  geschaeft: {
    label: "Geschaeft",
    tags: [["shop"]],
    name: "laden|shop|geschaeft"
  },
  geschaefte: {
    label: "Geschaeft",
    tags: [["shop"]],
    name: "laden|shop|geschaeft"
  },
  laden: {
    label: "Geschaeft",
    tags: [["shop"]],
    name: "laden|shop|geschaeft"
  },
  shop: {
    label: "Geschaeft",
    tags: [["shop"]],
    name: "laden|shop|geschaeft"
  },
  hotel: {
    label: "Hotel",
    tags: [
      ["tourism", "hotel"],
      ["tourism", "guest_house"],
      ["tourism", "hostel"]
    ],
    name: "hotel|gaestehaus|gasthaus|pension"
  }
};

let projects = loadProjects();
let activeProjectId = projects[0]?.id;
let activeFilter = "all";
let map;
let routeLayer;
let leadLayer;
let placeLayer;
let leadMarkers = new Map();

const els = {
  projectList: document.querySelector("#projectList"),
  projectTitle: document.querySelector("#projectTitle"),
  leadCounter: document.querySelector("#leadCounter"),
  nameInput: document.querySelector("#nameInput"),
  startInput: document.querySelector("#startInput"),
  endInput: document.querySelector("#endInput"),
  stopsInput: document.querySelector("#stopsInput"),
  searchTermsInput: document.querySelector("#searchTermsInput"),
  radiusInput: document.querySelector("#radiusInput"),
  routeModeInput: document.querySelector("#routeModeInput"),
  priorityInput: document.querySelector("#priorityInput"),
  maxResultsInput: document.querySelector("#maxResultsInput"),
  nearbyPlaceInput: document.querySelector("#nearbyPlaceInput"),
  typeFilter: document.querySelector("#typeFilter"),
  routeStatus: document.querySelector("#routeStatus"),
  routeLabel: document.querySelector("#routeLabel"),
  routeMeta: document.querySelector("#routeMeta"),
  mapCanvas: document.querySelector("#mapCanvas"),
  leadRows: document.querySelector("#leadRows"),
  leadSearch: document.querySelector("#leadSearch"),
  projectDialog: document.querySelector("#projectDialog"),
  dialogName: document.querySelector("#dialogName"),
  dialogStart: document.querySelector("#dialogStart"),
  dialogEnd: document.querySelector("#dialogEnd"),
  manualLeadDialog: document.querySelector("#manualLeadDialog"),
  manualLeadName: document.querySelector("#manualLeadName"),
  manualLeadType: document.querySelector("#manualLeadType"),
  manualLeadAddress: document.querySelector("#manualLeadAddress"),
  manualLeadPhone: document.querySelector("#manualLeadPhone"),
  manualLeadWebsite: document.querySelector("#manualLeadWebsite")
};

document.querySelector("#newProjectBtn").addEventListener("click", () => {
  els.dialogName.value = "";
  els.dialogStart.value = "";
  els.dialogEnd.value = "";
  els.projectDialog.showModal();
});

document.querySelector("#createProjectConfirm").addEventListener("click", () => {
  const name = els.dialogName.value.trim() || "Neues Vertriebsprojekt";
  const start = els.dialogStart.value.trim() || "Start";
  const end = els.dialogEnd.value.trim() || "Ziel";
  const project = {
    id: crypto.randomUUID(),
    name,
    start,
    end,
    stops: [],
    searchTerms: "Minigolf, Camping",
    radius: "2000",
    routeMode: "driving",
    priority: "B",
    maxResults: "50",
    route: null,
    leads: []
  };
  projects.unshift(project);
  activeProjectId = project.id;
  persist();
  render();
  window.setTimeout(() => calculateRouteOnly(), 250);
});

document.querySelector("#saveProjectBtn").addEventListener("click", async () => {
  syncFormToProject();
  persist();
  render();
  setStatus("Projekt gespeichert.");
  await calculateRouteOnly();
});

document.querySelector("#calculateRouteBtn").addEventListener("click", async () => {
  await calculateRouteOnly();
});

document.querySelector("#searchNearbyBtn").addEventListener("click", async () => {
  await searchAroundCurrentLocation();
});

document.querySelector("#searchNearbyPlaceBtn").addEventListener("click", async () => {
  await searchAroundEnteredPlace();
});

document.querySelector("#generateLeadsBtn").addEventListener("click", async () => {
  const button = document.querySelector("#generateLeadsBtn");
  button.disabled = true;
  button.textContent = "Suche laeuft...";
  try {
    await buildRouteAndFindLeads();
  } catch (error) {
    console.error(error);
    setStatus(error.message || "Die Suche konnte nicht abgeschlossen werden.", true);
  } finally {
    button.disabled = false;
    button.textContent = "Route & Leads suchen";
  }
});

document.querySelector("#exportCsvBtn").addEventListener("click", () => {
  const project = getActiveProject();
  if (!project) return;
  const csv = toCsv(project.leads);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${slug(project.name)}-leads.csv`;
  link.click();
  URL.revokeObjectURL(url);
});

document.querySelector("#fitMapBtn").addEventListener("click", fitMapToProject);
els.leadSearch.addEventListener("input", renderLeads);
els.typeFilter.addEventListener("change", renderLeads);
setupPlaceSuggestions();
attachPlaceSuggestions(els.nearbyPlaceInput, document.querySelector("#nearbySuggestions"));

document.querySelector("#manualLeadBtn").addEventListener("click", () => {
  els.manualLeadName.value = "";
  els.manualLeadType.value = parseTerms(getActiveProject()?.searchTerms || "")[0] || "";
  els.manualLeadAddress.value = "";
  els.manualLeadPhone.value = "";
  els.manualLeadWebsite.value = "";
  els.manualLeadDialog.showModal();
});

document.querySelector("#manualLeadConfirm").addEventListener("click", async () => {
  await addManualLead();
});

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    activeFilter = tab.dataset.filter;
    document.querySelectorAll(".tab").forEach((item) => item.classList.toggle("active", item === tab));
    renderLeads();
  });
});

function loadProjects() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (Array.isArray(stored)) return stored.map(normalizeProject);

    const legacy = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY));
    if (Array.isArray(legacy) && legacy.length) return legacy.map(normalizeProject);
  } catch {
    return [];
  }
  return [];
}

function normalizeProject(project) {
  return {
    id: project.id || crypto.randomUUID(),
    name: project.name || "Vertriebsprojekt",
    start: project.start || "Start",
    end: project.end || "Ziel",
    stops: Array.isArray(project.stops) ? project.stops : [],
    searchTerms: project.searchTerms || (Array.isArray(project.categories) ? project.categories.join(", ") : "Minigolf, Camping"),
    radius: project.radius && Number(project.radius) > 100 ? String(project.radius) : "2000",
    routeMode: project.routeMode || "driving",
    priority: project.priority || "B",
    maxResults: project.maxResults || "50",
    route: project.route || null,
    leads: Array.isArray(project.leads) ? project.leads.map(normalizeLead) : []
  };
}

function normalizeLead(item) {
  return {
    id: item.id || crypto.randomUUID(),
    name: item.name || "Unbenannter Lead",
    type: item.type || "Lead",
    city: item.city || "",
    status: item.status || "Neu",
    priority: item.priority || "B",
    note: item.note || "Kontakt recherchieren",
    lat: Number(item.lat) || null,
    lon: Number(item.lon) || null,
    address: item.address || "",
    website: item.website || "",
    phone: item.phone || "",
    routeDistance: Number(item.routeDistance) || null,
    score: Number(item.score) || null,
    websiteScore: Number(item.websiteScore) || null,
    websiteSummary: item.websiteSummary || "",
    websiteCheckedAt: item.websiteCheckedAt || "",
    source: item.source || "manual",
    createdAt: item.createdAt || new Date().toISOString()
  };
}

function lead(name, type, city, status = "Neu", priority = "B", note = "", lat = null, lon = null, details = {}) {
  return {
    id: crypto.randomUUID(),
    name,
    type,
    city,
    status,
    priority,
    note,
    lat,
    lon,
    address: details.address || "",
    website: details.website || "",
    phone: details.phone || "",
    routeDistance: details.routeDistance || null,
    score: details.score || null,
    websiteScore: null,
    websiteSummary: "",
    websiteCheckedAt: "",
    source: "openstreetmap",
    createdAt: new Date().toISOString()
  };
}

function getActiveProject() {
  return projects.find((project) => project.id === activeProjectId) || projects[0];
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
}

function render() {
  const project = getActiveProject();
  initMap();
  if (!project) {
    renderProjects(null);
    renderEmptyProjectState();
    return;
  }
  renderProjects(project);
  renderForm(project);
  renderMap();
  renderLeads();
}

function renderEmptyProjectState() {
  els.projectTitle.textContent = "Kein Projekt";
  els.leadCounter.textContent = "0 Leads";
  els.nameInput.value = "";
  els.startInput.value = "";
  els.endInput.value = "";
  els.stopsInput.value = "";
  els.searchTermsInput.value = "";
  els.radiusInput.value = "2000";
  els.routeModeInput.value = "driving";
  els.priorityInput.value = "B";
  els.maxResultsInput.value = "50";
  els.nearbyPlaceInput.value = "";
  els.typeFilter.innerHTML = '<option value="all">Alle Typen</option>';
  els.routeLabel.textContent = "Kein Projekt";
  els.routeMeta.textContent = "Bitte neues Projekt anlegen";
  routeLayer?.clearLayers();
  leadLayer?.clearLayers();
  placeLayer?.clearLayers();
  els.leadRows.innerHTML = '<tr><td class="empty-state" colspan="10">Lege links ein neues Projekt an.</td></tr>';
  setStatus("Bitte neues Projekt anlegen.");
}

function initMap() {
  if (map) return;
  map = L.map(els.mapCanvas, { scrollWheelZoom: true }).setView([50.94, 7.1], 8);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap"
  }).addTo(map);
  routeLayer = L.layerGroup().addTo(map);
  leadLayer = L.layerGroup().addTo(map);
  placeLayer = L.layerGroup().addTo(map);
}

function renderProjects(activeProject) {
  els.projectList.innerHTML = "";
  projects.forEach((project) => {
    const item = document.createElement("div");
    item.className = "project-list-item";

    const button = document.createElement("button");
    button.className = `project-card${project.id === activeProject?.id ? " active" : ""}`;
    button.type = "button";
    button.innerHTML = `<strong>${escapeHtml(project.name)}</strong><span>${escapeHtml(project.start)} -> ${escapeHtml(project.end)} - ${project.leads.length} Leads</span>`;
    button.addEventListener("click", () => {
      activeProjectId = project.id;
      render();
      setStatus("Projekt geladen.");
    });

    const deleteButton = document.createElement("button");
    deleteButton.className = "project-delete";
    deleteButton.type = "button";
    deleteButton.title = "Projekt loeschen";
    deleteButton.textContent = "×";
    deleteButton.addEventListener("click", (event) => {
      event.stopPropagation();
      deleteProject(project.id);
    });

    item.append(button, deleteButton);
    els.projectList.append(item);
  });
}

function deleteProject(projectId) {
  const project = projects.find((item) => item.id === projectId);
  if (!project) return;
  const confirmed = window.confirm(`Projekt "${project.name}" wirklich loeschen?`);
  if (!confirmed) return;

  projects = projects.filter((item) => item.id !== projectId);
  activeProjectId = projects[0]?.id;
  persist();
  render();
  if (projects.length) setStatus("Projekt geloescht.");
}

function renderForm(project) {
  els.projectTitle.textContent = project.name;
  els.nameInput.value = project.name;
  els.startInput.value = project.start;
  els.endInput.value = project.end;
  els.stopsInput.value = project.stops.join(", ");
  els.searchTermsInput.value = project.searchTerms;
  els.radiusInput.value = project.radius;
  els.routeModeInput.value = project.routeMode;
  els.priorityInput.value = project.priority;
  els.maxResultsInput.value = project.maxResults;
  els.leadCounter.textContent = `${project.leads.length} Leads`;
  els.routeLabel.textContent = `${project.start} -> ${project.end}`;
  els.routeMeta.textContent = `${modeLabel(project.routeMode)} - ${project.searchTerms || "keine Suchbegriffe"}`;
  renderTypeFilter(project);
}

function renderTypeFilter(project) {
  const current = els.typeFilter.value || "all";
  const types = new Set(parseTerms(project.searchTerms).map((term) => termProfiles[normalizeSearchTerm(term)]?.label || term));
  project.leads.forEach((item) => {
    if (item.type) types.add(item.type);
  });
  els.typeFilter.innerHTML = '<option value="all">Alle Typen</option>';
  [...types].sort((a, b) => a.localeCompare(b)).forEach((type) => {
    const option = document.createElement("option");
    option.value = type;
    option.textContent = type;
    els.typeFilter.append(option);
  });
  els.typeFilter.value = [...types].includes(current) ? current : "all";
}

function syncFormToProject() {
  const project = getActiveProject();
  project.name = els.nameInput.value.trim() || project.name;
  project.start = els.startInput.value.trim() || project.start;
  project.end = els.endInput.value.trim() || project.end;
  project.stops = els.stopsInput.value.split(",").map((item) => item.trim()).filter(Boolean);
  project.searchTerms = els.searchTermsInput.value.trim();
  project.radius = els.radiusInput.value;
  project.routeMode = els.routeModeInput.value;
  project.priority = els.priorityInput.value;
  project.maxResults = els.maxResultsInput.value;
  return project;
}

async function calculateRouteOnly() {
  const project = syncFormToProject();
  if (!project.start || !project.end || project.start === "Start" || project.end === "Ziel") return;

  try {
    setStatus("Route wird berechnet...");
    const places = await geocodeProjectPlaces(project);
    const route = await fetchRoute(places, project.routeMode);
    project.route = route;
    persist();
    render();
    setStatus(`Route geladen: ${formatDistance(route.distance)}, ca. ${formatDuration(route.duration)}.`);
  } catch (error) {
    console.error(error);
    setStatus(error.message || "Route konnte nicht berechnet werden.", true);
  }
}

async function buildRouteAndFindLeads() {
  const project = syncFormToProject();
  const terms = parseTerms(project.searchTerms);
  if (!terms.length) throw new Error("Bitte mindestens einen Suchbegriff eingeben, z. B. Minigolf oder Camping.");

  setStatus("Route wird berechnet...");
  const places = await geocodeProjectPlaces(project);
  project.route = await fetchRoute(places, project.routeMode);

  setStatus("Betriebe entlang der Route werden gesucht...");
  const foundLeads = await fetchLeadsAlongRoute(project, project.route.coordinates, terms);
  const existing = new Set(project.leads.map((item) => uniqueLeadKey(item)));
  const fresh = foundLeads.filter((item) => !existing.has(uniqueLeadKey(item)));
  project.leads.push(...fresh);
  persist();
  render();
  if (!fresh.length) {
    setStatus(`0 neue Leads im ${formatDistance(Number(project.radius))}-Korridor. Teste 5-10 km oder genauere Suchbegriffe wie Campingplatz, Minigolfplatz, Geschaefte.`, true);
    return;
  }
  setStatus(`${fresh.length} neue Leads gefunden. Route: ${formatDistance(project.route.distance)}, ca. ${formatDuration(project.route.duration)}.`);
}

async function searchAroundCurrentLocation() {
  const project = getActiveProject();
  if (!project) {
    setStatus("Bitte zuerst ein Projekt anlegen.", true);
    return;
  }
  const terms = parseTerms(syncFormToProject().searchTerms);
  if (!terms.length) {
    setStatus("Bitte mindestens einen Suchbegriff eingeben.", true);
    return;
  }
  if (!navigator.geolocation) {
    setStatus("Standortsuche wird von diesem Browser nicht unterstuetzt.", true);
    return;
  }

  const button = document.querySelector("#searchNearbyBtn");
  button.disabled = true;
  button.textContent = "Standortsuche...";
  try {
    const position = await getCurrentPosition();
    const lat = position.coords.latitude;
    const lon = position.coords.longitude;
    setStatus("Betriebe um deinen Standort werden gesucht...");
    const foundLeads = await fetchLeadsAroundPoint(project, lat, lon, terms);
    const existing = new Set(project.leads.map((item) => uniqueLeadKey(item)));
    const fresh = foundLeads.filter((item) => !existing.has(uniqueLeadKey(item)));
    project.leads.push(...fresh);
    persist();
    render();
    if (fresh.length) {
      map.setView([lat, lon], 13);
      setStatus(`${fresh.length} neue Leads um deinen Standort hinzugefuegt.`);
    } else {
      setStatus("Keine neuen Leads gefunden oder alles war schon in der Liste.");
    }
  } catch (error) {
    console.error(error);
    setStatus(error.message || "Standortsuche konnte nicht ausgefuehrt werden.", true);
  } finally {
    button.disabled = false;
    button.textContent = "Mein Standort";
  }
}

async function searchAroundEnteredPlace() {
  const query = els.nearbyPlaceInput.value.trim();
  if (!query) {
    setStatus("Bitte einen Standort oder Ort eintragen.", true);
    return;
  }
  const project = getActiveProject();
  if (!project) {
    setStatus("Bitte zuerst ein Projekt anlegen.", true);
    return;
  }
  const terms = parseTerms(syncFormToProject().searchTerms);
  if (!terms.length) {
    setStatus("Bitte mindestens einen Suchbegriff eingeben.", true);
    return;
  }

  const button = document.querySelector("#searchNearbyPlaceBtn");
  button.disabled = true;
  button.textContent = "Ortssuche...";
  try {
    const place = await geocodeAny(query);
    setStatus(`Betriebe um ${query} werden gesucht...`);
    const foundLeads = await fetchLeadsAroundPoint(project, place.lat, place.lon, terms);
    const existing = new Set(project.leads.map((item) => uniqueLeadKey(item)));
    const fresh = foundLeads.filter((item) => !existing.has(uniqueLeadKey(item)));
    project.leads.push(...fresh);
    persist();
    render();
    map.setView([place.lat, place.lon], 13);
    map.invalidateSize();
    setStatus(fresh.length ? `${fresh.length} neue Leads um ${query} hinzugefuegt.` : "Keine neuen Leads gefunden oder alles war schon in der Liste.");
  } catch (error) {
    console.error(error);
    setStatus(error.message || "Ortssuche konnte nicht ausgefuehrt werden.", true);
  } finally {
    button.disabled = false;
    button.textContent = "Um Ort suchen";
  }
}

function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 12000,
      maximumAge: 60000
    });
  });
}

async function geocodeProjectPlaces(project) {
  const names = [project.start, ...project.stops, project.end].filter(Boolean);
  const places = [];
  for (const name of names) {
    const match = await geocodePlace(name);
    places.push({ ...match, label: name });
  }
  return places;
}

async function geocodePlace(query) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&countrycodes=de&q=${encodeURIComponent(query)}`;
  const results = await fetchJson(url, {
    serviceName: "OpenStreetMap-Ortssuche",
    headers: { Accept: "application/json" }
  });
  if (!results.length) throw new Error(`Ort konnte nicht gefunden werden: ${query}`);
  const result = pickBestPlaceResult(results, query);
  if (!result) {
    throw new Error(`"${query}" ist zu ungenau. Bitte einen Ort aus den Vorschlaegen waehlen oder PLZ/Bundesland ergaenzen.`);
  }
  return {
    lat: Number(result.lat),
    lon: Number(result.lon),
    displayName: result.display_name
  };
}

async function fetchRoute(places, mode) {
  const coordinates = places.map((place) => `${place.lon},${place.lat}`).join(";");
  const baseUrl = mode === "cycling"
    ? "https://routing.openstreetmap.de/routed-bike/route/v1/bike"
    : "https://router.project-osrm.org/route/v1/driving";
  const url = `${baseUrl}/${coordinates}?overview=full&geometries=geojson`;
  const data = await fetchJson(url, { serviceName: mode === "cycling" ? "Fahrrad-Routing" : "Auto-Routing" });
  if (data.code !== "Ok" || !data.routes?.length) throw new Error("Route konnte nicht berechnet werden.");
  const route = data.routes[0];
  return {
    coordinates: route.geometry.coordinates.map(([lon, lat]) => [lat, lon]),
    distance: route.distance,
    duration: route.duration,
    places
  };
}

async function fetchLeadsAlongRoute(project, coordinates, terms) {
  const radius = Number(project.radius) || 2000;
  const maxResults = Number(project.maxResults) || 50;
  const effectiveRadius = Math.min(radius, 5000);
  const exactTypeSearch = terms.every((term) => termProfiles[normalizeSearchTerm(term)]?.tags?.length);

  if (exactTypeSearch) {
    return fetchExactLeadsAlongRoute(project, coordinates, terms, radius, maxResults);
  }

  const spacingMeters = Math.max(5500, effectiveRadius * 2);
  const maxRoutePoints = 18;
  const points = sampleRoutePointsByDistance(coordinates, spacingMeters, maxRoutePoints);
  const seen = new Set();
  const leads = [];
  const pointBatches = chunk(points, 4);
  let failedBatches = 0;

  for (let batchIndex = 0; batchIndex < pointBatches.length; batchIndex += 1) {
    setStatus(`Betriebe entlang der Route werden gesucht... ${batchIndex + 1}/${pointBatches.length}`);
    const queries = pointBatches[batchIndex].flatMap(([lat, lon]) => terms.map((term) => overpassAroundQuery(term, lat, lon, effectiveRadius)));
    const body = `[out:json][timeout:12];(${queries.join("")});out tags center ${Math.min(maxResults * 4, 260)};`;
    let data;
    try {
      data = await fetchJson("/api/overpass", {
        serviceName: "OpenStreetMap-Lead-Suche",
        timeoutMs: 22000,
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ query: body })
      });
    } catch (error) {
      console.warn(error);
      failedBatches += 1;
      continue;
    }

    for (const element of data.elements || []) {
      const tags = element.tags || {};
      const name = tags.name || tags.operator;
      if (!name) continue;
      const lat = element.lat ?? element.center?.lat;
      const lon = element.lon ?? element.center?.lon;
      if (!lat || !lon) continue;
      const routeDistance = distanceToRouteMeters(lat, lon, coordinates);
      if (routeDistance > radius) continue;
      const type = classifyLead(tags, terms);
      const city = tags["addr:city"] || tags["addr:town"] || tags["addr:village"] || nearestRoutePlace(project, lat, lon);
      const details = {
        address: formatAddress(tags),
        website: tags.website || tags["contact:website"] || "",
        phone: tags.phone || tags["contact:phone"] || "",
        routeDistance: Math.round(routeDistance),
        score: estimateLeadScore(tags, routeDistance)
      };
      const item = lead(name, type, city, "Neu", project.priority, `Kontakt recherchieren - ca. ${formatDistance(routeDistance)} von Route`, lat, lon, details);
      item.routeDistance = Math.round(routeDistance);
      const key = uniqueLeadKey(item);
      if (seen.has(key)) continue;
      seen.add(key);
      leads.push(item);
      if (leads.length >= maxResults) break;
    }
    if (leads.length >= maxResults) break;
  }

  if (!leads.length && failedBatches) {
    throw new Error("OpenStreetMap-Lead-Suche braucht zu lange. Bitte mit weniger Treffern, kleinerem Korridor oder nur einem Suchbegriff erneut versuchen.");
  }
  return leads.sort((a, b) => a.routeDistance - b.routeDistance).slice(0, maxResults);
}

async function fetchExactLeadsAlongRoute(project, coordinates, terms, radius, maxResults) {
  const sections = splitRouteIntoSections(coordinates, 12000);
  const seen = new Set();
  const leads = [];
  let failedSections = 0;

  for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex += 1) {
    setStatus(`Betriebe entlang der Route werden gesucht... Abschnitt ${sectionIndex + 1}/${sections.length}`);
    const bbox = bufferedRouteBbox(sections[sectionIndex], radius);
    const queries = terms.map((term) => overpassExactBboxQuery(term, bbox));
    const body = `[out:json][timeout:12];(${queries.join("")});out tags center qt ${Math.min(Math.max(maxResults * 4, 120), 600)};`;
    let data;

    try {
      data = await fetchJson("/api/overpass", {
        serviceName: "OpenStreetMap-Lead-Suche",
        timeoutMs: 22000,
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ query: body })
      });
    } catch (error) {
      console.warn(error);
      failedSections += 1;
      continue;
    }

    addOverpassElementsToLeads(data.elements || [], {
      project,
      terms,
      coordinates,
      radius,
      leads,
      seen,
      maxResults
    });
    if (leads.length >= maxResults) break;
  }

  if (!leads.length && failedSections) {
    throw new Error("OpenStreetMap-Lead-Suche braucht zu lange. Bitte mit kleinerem Korridor oder nur einem Suchbegriff erneut versuchen.");
  }

  return leads.sort((a, b) => a.routeDistance - b.routeDistance).slice(0, maxResults);
}

async function fetchLeadsAroundPoint(project, lat, lon, terms) {
  const radius = Number(project.radius) || 2000;
  const maxResults = Number(project.maxResults) || 50;
  const queries = terms.map((term) => overpassAroundQuery(term, lat, lon, radius));
  const body = `[out:json][timeout:35];(${queries.join("")});out tags center ${maxResults * 8};`;
  const data = await fetchJson("/api/overpass", {
    serviceName: "OpenStreetMap-Standortsuche",
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ query: body })
  });
  const seen = new Set();
  const leads = [];

  for (const element of data.elements || []) {
    const tags = element.tags || {};
    const name = tags.name || tags.operator;
    if (!name) continue;
    const itemLat = element.lat ?? element.center?.lat;
    const itemLon = element.lon ?? element.center?.lon;
    if (!itemLat || !itemLon) continue;
    const distance = haversineMeters(lat, lon, itemLat, itemLon);
    const details = {
      address: formatAddress(tags),
      website: tags.website || tags["contact:website"] || "",
      phone: tags.phone || tags["contact:phone"] || "",
      routeDistance: Math.round(distance),
      score: estimateLeadScore(tags, distance)
    };
    const type = classifyLead(tags, terms);
    const city = tags["addr:city"] || tags["addr:town"] || tags["addr:village"] || "";
    const item = lead(name, type, city, "Neu", project.priority, `Kontakt recherchieren - ca. ${formatDistance(distance)} vom Standort`, itemLat, itemLon, details);
    const key = uniqueLeadKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    leads.push(item);
  }

  return leads.sort((a, b) => a.routeDistance - b.routeDistance).slice(0, maxResults);
}

function overpassAroundQuery(term, lat, lon, radius) {
  const profile = termProfiles[normalizeSearchTerm(term)];
  const safeTerm = (profile?.name || term).replace(/[\\"]/g, "");
  const around = `(around:${radius},${lat},${lon})`;
  if (profile?.tags?.length) {
    return profile.tags.map(([key, value]) => {
      const selector = value ? `["${key}"="${value}"]` : `["${key}"]`;
      return `nwr${selector}${around};`;
    }).join("");
  }

  const clauses = [
    `nwr["name"~"${safeTerm}",i]${around};`,
    `nwr["tourism"~"${safeTerm}",i]${around};`,
    `nwr["leisure"~"${safeTerm}",i]${around};`,
    `nwr["amenity"~"${safeTerm}",i]${around};`,
    `nwr["shop"~"${safeTerm}",i]${around};`
  ];

  return clauses.join("");
}

function overpassExactBboxQuery(term, bbox) {
  const profile = termProfiles[normalizeSearchTerm(term)];
  const box = `(${bbox.south},${bbox.west},${bbox.north},${bbox.east})`;
  if (!profile?.tags?.length) return overpassBboxQuery(term, bbox);

  return profile.tags.map(([key, value]) => {
    const selector = value ? `["${key}"="${value}"]` : `["${key}"]`;
    return `nwr${selector}${box};`;
  }).join("");
}

function addOverpassElementsToLeads(elements, { project, terms, coordinates, radius, leads, seen, maxResults }) {
  for (const element of elements) {
    const tags = element.tags || {};
    const name = tags.name || tags.operator;
    if (!name) continue;
    const lat = element.lat ?? element.center?.lat;
    const lon = element.lon ?? element.center?.lon;
    if (!lat || !lon) continue;

    const routeDistance = distanceToRouteMeters(lat, lon, coordinates);
    if (routeDistance > radius) continue;

    const type = classifyLead(tags, terms);
    const city = tags["addr:city"] || tags["addr:town"] || tags["addr:village"] || nearestRoutePlace(project, lat, lon);
    const details = {
      address: formatAddress(tags),
      website: tags.website || tags["contact:website"] || "",
      phone: tags.phone || tags["contact:phone"] || "",
      routeDistance: Math.round(routeDistance),
      score: estimateLeadScore(tags, routeDistance)
    };
    const item = lead(name, type, city, "Neu", project.priority, `Kontakt recherchieren - ca. ${formatDistance(routeDistance)} von Route`, lat, lon, details);
    item.routeDistance = Math.round(routeDistance);
    const key = uniqueLeadKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    leads.push(item);
    if (leads.length >= maxResults) break;
  }
}

async function addManualLead() {
  const project = getActiveProject();
  if (!project) return;
  const name = els.manualLeadName.value.trim();
  if (!name) return;

  const type = els.manualLeadType.value.trim() || "Lead";
  const address = els.manualLeadAddress.value.trim();
  const website = els.manualLeadWebsite.value.trim();
  const phone = els.manualLeadPhone.value.trim();
  let lat = null;
  let lon = null;
  let city = "";

  if (address) {
    try {
      const place = await geocodeAny(address);
      lat = place.lat;
      lon = place.lon;
      city = place.city;
    } catch {
      // Manual leads without coordinates stay in the table and CSV.
    }
  }

  const item = lead(name, type, city, "Neu", project.priority, "Manuell angelegt", lat, lon, {
    address,
    website,
    phone,
    score: website || phone ? 65 : 45
  });
  const existing = new Set(project.leads.map((leadItem) => uniqueLeadKey(leadItem)));
  if (existing.has(uniqueLeadKey(item))) {
    setStatus("Lead ist bereits vorhanden.");
    return;
  }
  project.leads.unshift(item);
  persist();
  render();
  setStatus("Lead manuell angelegt.");
}

async function geocodeAny(query) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=1&countrycodes=de&q=${encodeURIComponent(query)}`;
  const results = await fetchJson(url, {
    serviceName: "OpenStreetMap-Adresssuche",
    headers: { Accept: "application/json" }
  });
  if (!results.length) throw new Error("Adresse konnte nicht gefunden werden.");
  const address = results[0].address || {};
  return {
    lat: Number(results[0].lat),
    lon: Number(results[0].lon),
    city: address.city || address.town || address.village || address.municipality || ""
  };
}

function overpassBboxQuery(term, bbox) {
  const profile = termProfiles[normalizeSearchTerm(term)];
  const safeTerm = (profile?.name || term).replace(/[\\"]/g, "");
  const box = `(${bbox.south},${bbox.west},${bbox.north},${bbox.east})`;
  const clauses = [
    `node["name"~"${safeTerm}",i]${box};`,
    `way["name"~"${safeTerm}",i]${box};`,
    `relation["name"~"${safeTerm}",i]${box};`,
    `node["tourism"~"${safeTerm}",i]${box};`,
    `way["tourism"~"${safeTerm}",i]${box};`,
    `relation["tourism"~"${safeTerm}",i]${box};`,
    `node["leisure"~"${safeTerm}",i]${box};`,
    `way["leisure"~"${safeTerm}",i]${box};`,
    `relation["leisure"~"${safeTerm}",i]${box};`
  ];

  profile?.tags.forEach(([key, value]) => {
    const selector = value ? `["${key}"="${value}"]` : `["${key}"]`;
    clauses.push(`node${selector}${box};`);
    clauses.push(`way${selector}${box};`);
    clauses.push(`relation${selector}${box};`);
  });

  return clauses.join("");
}

function renderMap() {
  const project = getActiveProject();
  initMap();
  routeLayer.clearLayers();
  leadLayer.clearLayers();
  placeLayer.clearLayers();
  leadMarkers = new Map();

  if (project.route?.coordinates?.length) {
    L.polyline(project.route.coordinates, { color: "#0d766e", weight: 5, opacity: 0.9 }).addTo(routeLayer);
    project.route.places?.forEach((place) => {
      L.marker([place.lat, place.lon]).bindPopup(escapeHtml(place.label)).addTo(placeLayer);
    });
  }

  project.leads.forEach((item) => {
    if (!item.lat || !item.lon) return;
    const marker = L.circleMarker([item.lat, item.lon], {
      radius: 7,
      color: "#095b55",
      weight: 2,
      fillColor: statusColor(item.status),
      fillOpacity: 0.85
    })
      .bindPopup(leadPopupHtml(item))
      .addTo(leadLayer);
    leadMarkers.set(item.id, marker);
  });

  window.setTimeout(() => {
    map.invalidateSize();
    fitMapToProject();
  }, 80);
}

function fitMapToProject() {
  const project = getActiveProject();
  map.invalidateSize();
  const points = [];
  if (project.route?.coordinates?.length) points.push(...project.route.coordinates);
  project.leads.forEach((item) => {
    if (item.lat && item.lon) points.push([item.lat, item.lon]);
  });
  if (!points.length) {
    map.setView([50.94, 7.1], 8);
    return;
  }
  map.fitBounds(L.latLngBounds(points), { padding: [28, 28], maxZoom: 13 });
}

function renderLeads() {
  const project = getActiveProject();
  const query = els.leadSearch.value.trim().toLowerCase();
  const typeFilter = els.typeFilter.value || "all";
  const filtered = project.leads.filter((item) => {
    const matchesStatus = activeFilter === "all" || item.status === activeFilter;
    const matchesType = typeFilter === "all" || item.type === typeFilter;
    const matchesQuery = !query || [item.name, item.type, item.address, item.phone, item.website, item.note].join(" ").toLowerCase().includes(query);
    return matchesStatus && matchesType && matchesQuery;
  });

  els.leadRows.innerHTML = "";
  if (!filtered.length) {
    const row = document.createElement("tr");
    row.innerHTML = '<td class="empty-state" colspan="10">Keine Leads in dieser Ansicht.</td>';
    els.leadRows.append(row);
    return;
  }

  filtered.forEach((item) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><strong>${escapeHtml(item.name)}</strong></td>
      <td>${escapeHtml(item.type)}</td>
      <td>${escapeHtml(item.address || "")}</td>
      <td>${phoneCell(item.phone)}</td>
      <td>${mapsCell(item)}</td>
      <td>${websiteCell(item.website)}</td>
      <td>${websiteCheckCell(item)}</td>
      <td>${selectHtml("status-select", statuses, item.status)}</td>
      <td>${selectHtml("priority-select", ["A", "B", "C"], item.priority)}</td>
      <td><input class="comment-input" value="${escapeAttr(item.note || "")}" aria-label="Kommentar"></td>
      <td><button class="delete-btn" type="button" title="Lead entfernen">x</button></td>
    `;

    row.querySelector("strong").addEventListener("click", () => focusLeadOnMap(item.id));
    row.querySelector("strong").classList.add("lead-name");
    row.querySelector(".website-check-btn")?.addEventListener("click", () => checkLeadWebsite(item.id));
    row.querySelector(".comment-input").addEventListener("change", (event) => {
      item.note = event.target.value.trim();
      persist();
    });
    row.querySelector(".status-select").addEventListener("change", (event) => {
      item.status = event.target.value;
      persist();
      render();
    });
    row.querySelector(".priority-select").addEventListener("change", (event) => {
      item.priority = event.target.value;
      persist();
      renderLeads();
    });
    row.querySelector(".delete-btn").addEventListener("click", () => {
      project.leads = project.leads.filter((leadItem) => leadItem.id !== item.id);
      persist();
      render();
    });
    els.leadRows.append(row);
  });
}

function parseTerms(value) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function classifyLead(tags, terms) {
  const text = [tags.name, tags.tourism, tags.leisure, tags.amenity, tags.shop].filter(Boolean).join(" ").toLowerCase();
  const direct = terms.find((term) => text.includes(term.toLowerCase()));
  if (direct) return termProfiles[normalizeSearchTerm(direct)]?.label || direct;
  if (tags.tourism === "camp_site" || tags.tourism === "caravan_site") return "Camping";
  if (tags.leisure === "miniature_golf" || tags.sport === "miniature_golf") return "Minigolf";
  return tags.tourism || tags.leisure || "Lead";
}

function focusLeadOnMap(leadId) {
  const marker = leadMarkers.get(leadId);
  if (!marker) return;
  map.invalidateSize();
  map.setView(marker.getLatLng(), 15, { animate: true });
  marker.openPopup();
  window.setTimeout(() => map.invalidateSize(), 150);
}

function leadPopupHtml(item) {
  const website = item.website
    ? `<br><a href="${escapeAttr(normalizeUrl(item.website))}" target="_blank" rel="noreferrer">Webseite oeffnen</a>`
    : "";
  return `<strong>${escapeHtml(item.name)}</strong><br>${escapeHtml(item.type)}<br>${escapeHtml(item.address || item.city)}<br>${escapeHtml(item.status)}<br><a href="${escapeAttr(googleMapsUrl(item))}" target="_blank" rel="noreferrer">In Google Maps oeffnen</a>${website}`;
}

function websiteCell(value) {
  if (!value) return "";
  return `<a href="${escapeAttr(normalizeUrl(value))}" target="_blank" rel="noreferrer">Webseite</a>`;
}

function phoneCell(value) {
  if (!value) return "";
  const clean = String(value).trim();
  return `<a href="tel:${escapeAttr(clean.replace(/\s+/g, ""))}">${escapeHtml(clean)}</a>`;
}

function websiteCheckCell(item) {
  if (!item.website) return "";
  const result = item.websiteScore ? `<span class="website-score">${item.websiteScore}/100 · ${escapeHtml(item.websiteSummary)}</span>` : "";
  return `${result}<button class="ghost-button compact website-check-btn" type="button">${item.websiteScore ? "Neu pruefen" : "Pruefen"}</button>`;
}

async function checkLeadWebsite(leadId) {
  const project = getActiveProject();
  const item = project?.leads.find((leadItem) => leadItem.id === leadId);
  if (!item?.website) return;

  setStatus(`Webseite wird geprueft: ${item.name}`);
  try {
    const result = await fetchJson("/api/check-website", {
      serviceName: "Websitepruefung",
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: item.website })
    });
    item.websiteScore = result.score || 0;
    item.websiteSummary = result.summary || "Keine Bewertung";
    item.websiteCheckedAt = new Date().toISOString();
    item.note = mergeWebsiteNote(item.note, result);
    persist();
    renderLeads();
    setStatus(`Website-Check fertig: ${item.name} - ${item.websiteScore}/100 (${item.websiteSummary}).`);
  } catch (error) {
    console.error(error);
    setStatus("Website konnte nicht geprueft werden.", true);
  }
}

function mergeWebsiteNote(note, result) {
  const cleanNote = String(note || "").replace(/\s*\| Website:.*$/i, "");
  return `${cleanNote} | Website: ${result.score || 0}/100 ${result.summary || ""}`.trim();
}

function mapsCell(item) {
  return `<a href="${escapeAttr(googleMapsUrl(item))}" target="_blank" rel="noreferrer">Maps</a>`;
}

function googleMapsUrl(item) {
  if (item.lat && item.lon) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${item.lat},${item.lon}`)}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([item.name, item.address, item.city].filter(Boolean).join(", "))}`;
}

function normalizeUrl(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function formatAddress(tags) {
  const street = [tags["addr:street"], tags["addr:housenumber"]].filter(Boolean).join(" ");
  const cityLine = [tags["addr:postcode"], tags["addr:city"] || tags["addr:town"] || tags["addr:village"]].filter(Boolean).join(" ");
  return [street, cityLine].filter(Boolean).join(", ");
}

function estimateLeadScore(tags, routeDistance) {
  let score = 50;
  if (tags.website || tags["contact:website"]) score += 15;
  if (tags.phone || tags["contact:phone"]) score += 10;
  if (tags.email || tags["contact:email"]) score += 8;
  if (tags.opening_hours) score += 5;
  if (routeDistance < 1000) score += 12;
  else if (routeDistance < 3000) score += 8;
  else if (routeDistance < 8000) score += 3;
  return Math.min(100, score);
}

function setupPlaceSuggestions() {
  attachPlaceSuggestions(els.startInput, document.querySelector("#startSuggestions"));
  attachPlaceSuggestions(els.endInput, document.querySelector("#endSuggestions"));
  attachPlaceSuggestions(els.stopsInput, document.querySelector("#stopSuggestions"), true);
  attachPlaceSuggestions(els.dialogStart, document.querySelector("#dialogStartSuggestions"));
  attachPlaceSuggestions(els.dialogEnd, document.querySelector("#dialogEndSuggestions"));
}

function attachPlaceSuggestions(input, datalist, useLastSegment = false) {
  let timer;
  input.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const raw = input.value.trim();
      const query = useLastSegment ? raw.split(",").pop().trim() : raw;
      if (query.length < 3) {
        datalist.innerHTML = "";
        return;
      }
      try {
        const suggestions = await fetchPlaceSuggestions(query);
        const prefix = useLastSegment ? raw.slice(0, raw.lastIndexOf(",") + 1).trimStart() : "";
        datalist.innerHTML = suggestions.map((item) => {
          const value = prefix ? `${prefix} ${item.display_name}` : item.display_name;
          return `<option value="${escapeAttr(value)}">${escapeHtml(item.typeLabel)}</option>`;
        }).join("");
      } catch {
        datalist.innerHTML = "";
      }
    }, 350);
  });
}

async function fetchPlaceSuggestions(query) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=6&countrycodes=de&q=${encodeURIComponent(query)}`;
  const results = await fetchJson(url, {
    serviceName: "OpenStreetMap-Ortsvorschlaege",
    headers: { Accept: "application/json" },
    quiet: true
  }).catch(() => []);
  return results
    .filter((item) => isLikelyRoutePlace(item) || query.trim().includes(" "))
    .map((item) => ({
      ...item,
      typeLabel: [item.addresstype || item.type, item.class].filter(Boolean).join(" - ")
    }));
}

function pickBestPlaceResult(results, query) {
  const preferred = results.find(isLikelyRoutePlace);
  if (preferred) return preferred;
  return query.trim().includes(" ") ? results[0] : null;
}

function isLikelyRoutePlace(item) {
  const addressType = item.addresstype || "";
  return item.class === "place"
    || item.class === "boundary"
    || ["city", "town", "village", "municipality", "hamlet", "suburb", "quarter"].includes(addressType);
}

function normalizeSearchTerm(value) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u00e4/g, "ae")
    .replace(/\u00f6/g, "oe")
    .replace(/\u00fc/g, "ue")
    .replace(/\u00df/g, "ss")
    .replace(/[^a-z0-9]+/g, "");
}

function nearestRoutePlace(project, lat, lon) {
  const routePlaces = project.route?.places || [];
  if (!routePlaces.length) return "";
  return routePlaces
    .map((place) => ({ place, distance: Math.hypot(place.lat - lat, place.lon - lon) }))
    .sort((a, b) => a.distance - b.distance)[0].place.label;
}

function bufferedRouteBbox(coordinates, bufferMeters) {
  const lats = coordinates.map(([lat]) => lat);
  const lons = coordinates.map(([, lon]) => lon);
  const midLat = lats.reduce((sum, lat) => sum + lat, 0) / lats.length;
  const latBuffer = bufferMeters / 111320;
  const lonBuffer = bufferMeters / (111320 * Math.max(0.25, Math.cos(toRad(midLat))));
  return {
    south: Math.min(...lats) - latBuffer,
    west: Math.min(...lons) - lonBuffer,
    north: Math.max(...lats) + latBuffer,
    east: Math.max(...lons) + lonBuffer
  };
}

function splitRouteIntoSections(coordinates, sectionMeters) {
  if (coordinates.length <= 2) return [coordinates];

  const sections = [];
  let current = [coordinates[0]];
  let sectionDistance = 0;

  for (let index = 1; index < coordinates.length; index += 1) {
    const previous = coordinates[index - 1];
    const point = coordinates[index];
    sectionDistance += haversineMeters(previous[0], previous[1], point[0], point[1]);
    current.push(point);

    if (sectionDistance >= sectionMeters && current.length > 1) {
      sections.push(current);
      current = [point];
      sectionDistance = 0;
    }
  }

  if (current.length > 1) sections.push(current);
  return sections;
}

function sampleRoutePointsByDistance(coordinates, spacingMeters, maxPoints) {
  if (!coordinates.length) return [];
  const points = [coordinates[0]];
  let distanceSinceLast = 0;

  for (let index = 1; index < coordinates.length; index += 1) {
    const previous = coordinates[index - 1];
    const current = coordinates[index];
    distanceSinceLast += haversineMeters(previous[0], previous[1], current[0], current[1]);
    if (distanceSinceLast >= spacingMeters) {
      points.push(current);
      distanceSinceLast = 0;
    }
  }

  const last = coordinates[coordinates.length - 1];
  const alreadyHasLast = points[points.length - 1]?.[0] === last[0] && points[points.length - 1]?.[1] === last[1];
  if (!alreadyHasLast) points.push(last);

  if (points.length <= maxPoints) return points;
  const step = (points.length - 1) / (maxPoints - 1);
  return Array.from({ length: maxPoints }, (_, index) => points[Math.round(index * step)]);
}

function chunk(items, size) {
  const groups = [];
  for (let index = 0; index < items.length; index += size) {
    groups.push(items.slice(index, index + size));
  }
  return groups;
}

function distanceToRouteMeters(lat, lon, coordinates) {
  let shortest = Infinity;
  for (let index = 0; index < coordinates.length - 1; index += 1) {
    const distance = distanceToSegmentMeters(
      lat,
      lon,
      coordinates[index][0],
      coordinates[index][1],
      coordinates[index + 1][0],
      coordinates[index + 1][1]
    );
    if (distance < shortest) shortest = distance;
  }
  return shortest;
}

function haversineMeters(startLat, startLon, endLat, endLon) {
  const earthRadius = 6371000;
  const dLat = toRad(endLat - startLat);
  const dLon = toRad(endLon - startLon);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(startLat)) * Math.cos(toRad(endLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * earthRadius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function distanceToSegmentMeters(lat, lon, startLat, startLon, endLat, endLon) {
  const originLat = toRad((lat + startLat + endLat) / 3);
  const point = projectPoint(lat, lon, originLat);
  const start = projectPoint(startLat, startLon, originLat);
  const end = projectPoint(endLat, endLon, originLat);
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (!lengthSquared) return Math.hypot(point.x - start.x, point.y - start.y);
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
  const closest = { x: start.x + t * dx, y: start.y + t * dy };
  return Math.hypot(point.x - closest.x, point.y - closest.y);
}

function projectPoint(lat, lon, originLat) {
  const earthRadius = 6371000;
  return {
    x: toRad(lon) * earthRadius * Math.cos(originLat),
    y: toRad(lat) * earthRadius
  };
}

function toRad(value) {
  return value * Math.PI / 180;
}

function uniqueLeadKey(item) {
  if (item.lat && item.lon) {
    return `${item.name}|${Number(item.lat).toFixed(5)}|${Number(item.lon).toFixed(5)}`.toLowerCase();
  }
  return `${item.name}|${item.address || ""}|${item.phone || ""}`.toLowerCase();
}

function statusColor(status) {
  if (status === "Gewonnen") return "#1f7a4d";
  if (status === "Interessiert" || status === "Angebot") return "#2563a7";
  if (status === "Kein Bedarf") return "#8b2f1f";
  return "#f0b84f";
}

function modeLabel(mode) {
  return mode === "cycling" ? "Fahrrad" : "Auto";
}

function formatDistance(meters) {
  return `${(meters / 1000).toFixed(1)} km`;
}

function formatDuration(seconds) {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

function setStatus(message, isError = false) {
  els.routeStatus.textContent = message;
  els.routeStatus.classList.toggle("error", isError);
}

function toCsv(rows) {
  const headers = ["Name", "Typ", "Adresse", "Google Maps", "Webseite", "Telefon", "Lead Score", "Website Score", "Website Bewertung", "Status", "Prioritaet", "Route Abstand m", "Latitude", "Longitude", "Quelle", "Angelegt am"];
  const body = rows.map((item) => [
    item.name,
    item.type,
    item.address,
    googleMapsUrl(item),
    item.website,
    item.phone,
    item.score,
    item.websiteScore,
    item.websiteSummary,
    item.status,
    item.priority,
    item.routeDistance,
    item.lat,
    item.lon,
    item.source,
    item.createdAt
  ]);
  return [headers, ...body].map((row) => row.map(csvCell).join(";")).join("\n");
}

function csvCell(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function selectHtml(className, options, value) {
  return `<select class="${className}">${options.map((option) => `<option value="${escapeAttr(option)}"${option === value ? " selected" : ""}>${escapeHtml(option)}</option>`).join("")}</select>`;
}

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "projekt";
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function escapeAttr(value) {
  return escapeHtml(value);
}

async function fetchJson(url, options = {}) {
  const {
    serviceName = "Dienst",
    timeoutMs = 20000,
    quiet = false,
    ...fetchOptions
  } = options;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal
    });
    if (!response.ok) {
      throw new Error(`${serviceName} antwortet mit HTTP ${response.status}.`);
    }
    return await response.json();
  } catch (error) {
    if (quiet) throw error;
    if (error.name === "AbortError") {
      throw new Error(`${serviceName} braucht zu lange. Bitte gleich nochmal versuchen.`);
    }
    if (String(error.message || "").includes("Failed to fetch")) {
      throw new Error(`${serviceName} ist gerade nicht erreichbar. Pruefe Internet/VPN/Adblocker oder versuche es erneut.`);
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

render();
