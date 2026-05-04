const map = L.map('map').setView([51.1657, 10.4515], 5);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

const destinationInput = document.getElementById('destination-input');
const suggestionsList = document.getElementById('destination-suggestions');
const addDestinationBtn = document.getElementById('add-destination-btn');
const resetRouteBtn = document.getElementById('reset-route-btn');
const saveRouteBtn = document.getElementById('save-route-btn');
const routeNameInput = document.getElementById('route-name');
const destinationList = document.getElementById('destination-list');
const savedRoutes = document.getElementById('saved-routes');
const statusBox = document.getElementById('status');
const authStatus = document.getElementById('auth-status');
const logoutBtn = document.getElementById('logout-btn');

const markers = [];
const points = [];
let routeLine = null;

function setStatus(msg, isError = false) {
  statusBox.textContent = msg;
  statusBox.classList.toggle('error', isError);
}

async function geocode(query, limit = 1) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=${limit}&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error('Geocoding fehlgeschlagen');
  return res.json();
}

function redrawRoute() {
  if (routeLine) map.removeLayer(routeLine);
  if (points.length > 1) {
    routeLine = L.polyline(points.map((p) => [p.lat, p.lon]), { color: '#2563eb', weight: 4, dashArray: '10,8' }).addTo(map);
  }
  const items = [...markers];
  if (routeLine) items.push(routeLine);
  if (items.length) map.fitBounds(L.featureGroup(items).getBounds().pad(0.2));
}

function renderPoints() {
  destinationList.innerHTML = '';
  points.forEach((p, i) => {
    const li = document.createElement('li');
    li.textContent = `${i + 1}. ${p.label}`;
    destinationList.appendChild(li);
  });
}

async function addDestination() {
  const q = destinationInput.value.trim();
  if (!q) return;
  try {
    const [res] = await geocode(q, 1);
    if (!res) throw new Error('Kein Ergebnis gefunden');
    const point = { lat: Number(res.lat), lon: Number(res.lon), label: res.display_name };
    points.push(point);
    markers.push(L.marker([point.lat, point.lon]).addTo(map).bindPopup(`${points.length}. ${point.label}`));
    renderPoints();
    redrawRoute();
    destinationInput.value = '';
    setStatus('Ziel hinzugefügt');
  } catch (e) {
    setStatus(e.message, true);
  }
}

function resetRoute() {
  markers.forEach((m) => map.removeLayer(m));
  markers.length = 0;
  points.length = 0;
  if (routeLine) map.removeLayer(routeLine);
  routeLine = null;
  renderPoints();
  setStatus('Route gelöscht');
}

async function updateSuggestions() {
  const q = destinationInput.value.trim();
  if (q.length < 2) return;
  try {
    const results = await geocode(q, 5);
    suggestionsList.innerHTML = '';
    results.forEach((r) => {
      const opt = document.createElement('option');
      opt.value = r.display_name;
      suggestionsList.appendChild(opt);
    });
  } catch {
    // ignore suggestion errors
  }
}

async function api(path, method = 'GET', body = null) {
  const res = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : null,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'API Fehler');
  return data;
}

async function loadSessionAndRoutes() {
  try {
    const sessionData = await api('/api/session');
    if (!sessionData.authenticated) {
      authStatus.textContent = 'Nicht eingeloggt';
      logoutBtn.classList.add('hidden');
      savedRoutes.innerHTML = '';
      return;
    }
    authStatus.textContent = `Eingeloggt als ${sessionData.user.name}`;
    logoutBtn.classList.remove('hidden');
    const routeData = await api('/api/routes');
    savedRoutes.innerHTML = '';
    routeData.routes.forEach((r) => {
      const li = document.createElement('li');
      li.textContent = `${r.route_name} (${new Date(r.created_at).toLocaleString('de-DE')})`;
      savedRoutes.appendChild(li);
    });
  } catch (e) {
    authStatus.textContent = e.message;
  }
}

document.getElementById('register-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = new FormData(e.target);
  try {
    await api('/api/register', 'POST', Object.fromEntries(form.entries()));
    authStatus.textContent = 'Registrierung erfolgreich';
    await loadSessionAndRoutes();
  } catch (err) {
    authStatus.textContent = err.message;
  }
});

document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = new FormData(e.target);
  try {
    await api('/api/login', 'POST', Object.fromEntries(form.entries()));
    authStatus.textContent = 'Login erfolgreich';
    await loadSessionAndRoutes();
  } catch (err) {
    authStatus.textContent = err.message;
  }
});

logoutBtn.addEventListener('click', async () => {
  await api('/api/logout', 'POST');
  await loadSessionAndRoutes();
});

saveRouteBtn.addEventListener('click', async () => {
  if (!points.length) return setStatus('Keine Ziele zum Speichern', true);
  try {
    await api('/api/routes', 'POST', {
      route_name: routeNameInput.value.trim() || 'Meine Route',
      points_json: JSON.stringify(points),
    });
    setStatus('Route gespeichert');
    await loadSessionAndRoutes();
  } catch (e) {
    setStatus(e.message, true);
  }
});

destinationInput.addEventListener('input', updateSuggestions);
addDestinationBtn.addEventListener('click', addDestination);
resetRouteBtn.addEventListener('click', resetRoute);
destinationInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    addDestination();
  }
});

loadSessionAndRoutes();
