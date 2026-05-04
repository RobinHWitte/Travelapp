const map = L.map('map').setView([51.1657, 10.4515], 5);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap-Mitwirkende',
}).addTo(map);

const destinationInput = document.getElementById('destination-input');
const addDestinationBtn = document.getElementById('add-destination-btn');
const resetRouteBtn = document.getElementById('reset-route-btn');
const destinationList = document.getElementById('destination-list');
const statusBox = document.getElementById('status');

const markers = [];
const points = [];
let routeLine = null;

function setStatus(message, isError = false) {
  statusBox.textContent = message;
  statusBox.classList.toggle('error', isError);
}

function renderList() {
  destinationList.innerHTML = '';
  points.forEach((point, index) => {
    const li = document.createElement('li');
    li.textContent = `${index + 1}. ${point.label}`;
    destinationList.appendChild(li);
  });
}

function redrawRoute() {
  if (routeLine) {
    map.removeLayer(routeLine);
    routeLine = null;
  }

  if (points.length > 1) {
    routeLine = L.polyline(points.map((p) => [p.lat, p.lon]), {
      color: '#2563eb',
      weight: 4,
      dashArray: '10, 8',
    }).addTo(map);
  }

  const groupItems = [...markers];
  if (routeLine) {
    groupItems.push(routeLine);
  }

  if (groupItems.length > 0) {
    const bounds = L.featureGroup(groupItems).getBounds().pad(0.2);
    map.fitBounds(bounds);
  }
}

async function geocodeDestination(query) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`;
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Fehler bei der Geocoding-Anfrage.');
  }

  const data = await response.json();
  if (!data.length) {
    throw new Error('Kein Ziel gefunden. Bitte Eingabe präzisieren.');
  }

  return data[0];
}

async function addDestination() {
  const query = destinationInput.value.trim();
  if (!query) {
    setStatus('Bitte zuerst ein Reiseziel eingeben.', true);
    return;
  }

  addDestinationBtn.disabled = true;
  setStatus('Suche Reiseziel ...');

  try {
    const result = await geocodeDestination(query);
    const lat = Number(result.lat);
    const lon = Number(result.lon);
    const label = result.display_name;

    const marker = L.marker([lat, lon]).addTo(map).bindPopup(`${points.length + 1}. ${label}`);
    markers.push(marker);
    points.push({ lat, lon, label });

    redrawRoute();
    renderList();

    destinationInput.value = '';
    setStatus(`Ziel hinzugefügt: ${label}`);
  } catch (error) {
    setStatus(error.message || 'Unbekannter Fehler.', true);
  } finally {
    addDestinationBtn.disabled = false;
  }
}

function resetRoute() {
  markers.forEach((marker) => map.removeLayer(marker));
  markers.length = 0;
  points.length = 0;

  if (routeLine) {
    map.removeLayer(routeLine);
    routeLine = null;
  }

  renderList();
  map.setView([51.1657, 10.4515], 5);
  setStatus('Route wurde gelöscht.');
}

addDestinationBtn.addEventListener('click', addDestination);
resetRouteBtn.addEventListener('click', resetRoute);
destinationInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    addDestination();
  }
});
