const STORAGE_KEY = "glowData_v2_clean";
const DEFAULT_BUSINESS = {
  name: "Cooperativa",
  category: "Comercio",
  whatsapp: "5491122334455"
};
const DEFAULT_OFFERS = [
  { name: "Combo Auricular + Funda", note: "Stock limitado", price: "$29.900", image: "" },
  { name: "Cargador rapido 25W", note: "Promo de la semana", price: "$16.500", image: "" }
];
const DEFAULT_RAFFLE = {
  id: "raffle-default",
  title: "Sorteo diario",
  prize: "Premio sorpresa",
  closing: "Hoy 20:00",
  participants: [],
  winner: null
};
const DEFAULT_BASES = [
  "Sorteo diario.",
  "1 participacion por persona.",
  "Comunicamos el ganador por mensaje.",
  "Premio sujeto a disponibilidad."
];

const actions = document.getElementById("actions");
const initialActionsHtml = actions ? actions.innerHTML : "";
const imageViewerState = {
  scale: 1,
  translateX: 0,
  translateY: 0,
  isPanning: false,
  startX: 0,
  startY: 0,
  initialDistance: 0,
  initialScale: 1
};

function createRaffleId() {
  return `raffle-${Date.now()}`;
}

function cloneDefaultData() {
  return {
    business: { ...DEFAULT_BUSINESS },
    offers: DEFAULT_OFFERS.map((offer) => ({ ...offer })),
    raffles: [{ ...DEFAULT_RAFFLE, participants: [], winner: null }],
    currentRaffleId: DEFAULT_RAFFLE.id,
    bases: [...DEFAULT_BASES]
  };
}

function normalizeParticipants(value) {
  return Array.isArray(value)
    ? value.map((participant) => ({
      name: participant?.name || "",
      whatsapp: participant?.whatsapp || ""
    }))
    : [];
}

function normalizeRaffles(value) {
  if (!Array.isArray(value) || !value.length) {
    return [{ ...DEFAULT_RAFFLE, participants: [], winner: null }];
  }

  return value.map((raffle, index) => ({
    id: raffle?.id || `raffle-${index}`,
    title: raffle?.title || DEFAULT_RAFFLE.title,
    prize: raffle?.prize || DEFAULT_RAFFLE.prize,
    closing: raffle?.closing || DEFAULT_RAFFLE.closing,
    participants: normalizeParticipants(raffle?.participants),
    winner: raffle?.winner || null
  }));
}

function normalizeOffers(value) {
  return Array.isArray(value)
    ? value.map((offer) => ({
      name: offer?.name || "",
      note: offer?.note || "",
      price: offer?.price || "",
      image: offer?.image || ""
    }))
    : DEFAULT_OFFERS.map((offer) => ({ ...offer }));
}

function migrateLegacyData(parsed) {
  if (!parsed || typeof parsed !== "object") {
    return cloneDefaultData();
  }

  if (parsed.business || parsed.raffles || parsed.bases) {
    const data = cloneDefaultData();
    data.business = {
      name: parsed.business?.name || DEFAULT_BUSINESS.name,
      category: parsed.business?.category || DEFAULT_BUSINESS.category,
      whatsapp: parsed.business?.whatsapp || DEFAULT_BUSINESS.whatsapp
    };
    data.offers = normalizeOffers(parsed.offers);
    data.raffles = normalizeRaffles(parsed.raffles);
    data.currentRaffleId = data.raffles.some((raffle) => raffle.id === parsed.currentRaffleId)
      ? parsed.currentRaffleId
      : data.raffles[0].id;
    data.bases = Array.isArray(parsed.bases) && parsed.bases.length ? parsed.bases : [...DEFAULT_BASES];
    return data;
  }

  if (Array.isArray(parsed.businesses) || Array.isArray(parsed.basesByBusiness)) {
    const businesses = Array.isArray(parsed.businesses) && parsed.businesses.length
      ? parsed.businesses
      : [{ ...DEFAULT_BUSINESS, id: "business-default" }];
    const currentBusiness = businesses.find((business) => business.id === parsed.currentBusinessId) || businesses[0];
    const currentBusinessId = currentBusiness?.id;
    const offers = Array.isArray(parsed.offers)
      ? parsed.offers
        .filter((offer) => offer.businessId === currentBusinessId)
        .map((offer) => ({
          name: offer?.name || "",
          note: offer?.note || "",
          price: offer?.price || "",
          image: offer?.image || ""
        }))
      : cloneDefaultData().offers;
    const raffles = normalizeRaffles(
      Array.isArray(parsed.raffles)
        ? parsed.raffles.filter((raffle) => raffle.businessId === currentBusinessId)
        : []
    );
    const basesEntry = Array.isArray(parsed.basesByBusiness)
      ? parsed.basesByBusiness.find((entry) => entry.businessId === currentBusinessId)
      : null;

    return {
      business: {
        name: currentBusiness?.name || DEFAULT_BUSINESS.name,
        category: currentBusiness?.category || DEFAULT_BUSINESS.category,
        whatsapp: currentBusiness?.whatsapp || DEFAULT_BUSINESS.whatsapp
      },
      offers: offers.length ? offers : [],
      raffles,
      currentRaffleId: raffles.some((raffle) => raffle.id === parsed.currentRaffleId)
        ? parsed.currentRaffleId
        : raffles[0]?.id || DEFAULT_RAFFLE.id,
      bases: Array.isArray(basesEntry?.lines) && basesEntry.lines.length ? basesEntry.lines : [...DEFAULT_BASES]
    };
  }

  return cloneDefaultData();
}

let currentAppData = null;

async function initData() {
  try {
    const res = await fetch("/api/data");
    if (res.ok) {
      const json = await res.json();
      if (json.data) {
        currentAppData = syncCurrentContext(migrateLegacyData(json.data));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(currentAppData));
        return;
      }
    }
  } catch(e) {
    console.error("Error fetching from remote database:", e);
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      currentAppData = cloneDefaultData();
    } else {
      currentAppData = syncCurrentContext(migrateLegacyData(JSON.parse(raw)));
    }
  } catch (_error) {
    currentAppData = cloneDefaultData();
  }
}

function getStoredData() {
  if (!currentAppData) {
    return cloneDefaultData();
  }
  return syncCurrentContext(JSON.parse(JSON.stringify(currentAppData)));
}

function setStoredData(data) {
  const syncedData = syncCurrentContext(data);
  currentAppData = JSON.parse(JSON.stringify(syncedData));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(syncedData));

  fetch("/api/data", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ data: syncedData })
  }).catch(e => console.error("Error saving to remote database:", e));
}

function syncCurrentContext(data) {
  if (!data.business) {
    data.business = { ...DEFAULT_BUSINESS };
  }

  if (!Array.isArray(data.offers)) {
    data.offers = [];
  } else {
    data.offers = normalizeOffers(data.offers);
  }

  if (!Array.isArray(data.raffles) || !data.raffles.length) {
    data.raffles = [{ ...DEFAULT_RAFFLE, participants: [], winner: null }];
  } else {
    data.raffles = normalizeRaffles(data.raffles);
  }

  if (!Array.isArray(data.bases) || !data.bases.length) {
    data.bases = [...DEFAULT_BASES];
  }

  if (!data.raffles.some((raffle) => raffle.id === data.currentRaffleId)) {
    data.currentRaffleId = data.raffles[0]?.id || DEFAULT_RAFFLE.id;
  }

  return data;
}

function getCurrentRaffle(data) {
  const safeData = syncCurrentContext(data);
  return safeData.raffles.find((raffle) => raffle.id === safeData.currentRaffleId) || safeData.raffles[0] || null;
}

function formatBasesLines(lines) {
  return lines.map((line) => `* ${line}`).join("<br>");
}

function renderOfferMedia(offer) {
  return offer.image
    ? `<button class="offer-image-button" type="button" onclick="openImageViewer(${JSON.stringify(offer.image)}, ${JSON.stringify(offer.name)})" ondblclick="openImageViewerZoomed(${JSON.stringify(offer.image)}, ${JSON.stringify(offer.name)}); return false;"><img class="offer-image" src="${offer.image}" alt="${offer.name}"></button>`
    : "";
}

function readImageAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve("");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error("image_read_error"));
    reader.readAsDataURL(file);
  });
}

function ensureImageViewer() {
  if (document.getElementById("image-viewer")) return;

  const viewer = document.createElement("div");
  viewer.id = "image-viewer";
  viewer.className = "image-viewer";
  viewer.hidden = true;
  viewer.innerHTML = `
    <div class="image-viewer-backdrop" data-image-close></div>
    <div class="image-viewer-shell">
      <button class="image-viewer-close" type="button" data-image-close>Cerrar</button>
      <div class="image-viewer-stage" id="image-viewer-stage">
        <img class="image-viewer-image" id="image-viewer-image" alt="">
      </div>
    </div>
  `;
  document.body.appendChild(viewer);

  viewer.querySelectorAll("[data-image-close]").forEach((node) => {
    node.addEventListener("click", closeImageViewer);
  });

  const stage = document.getElementById("image-viewer-stage");
  stage?.addEventListener("wheel", handleImageWheel, { passive: false });
  stage?.addEventListener("dblclick", handleImageDoubleClick);
  stage?.addEventListener("pointerdown", handleImagePointerDown);
  stage?.addEventListener("pointermove", handleImagePointerMove);
  stage?.addEventListener("pointerup", handleImagePointerUp);
  stage?.addEventListener("pointercancel", handleImagePointerUp);
  stage?.addEventListener("touchstart", handleImageTouchStart, { passive: false });
  stage?.addEventListener("touchmove", handleImageTouchMove, { passive: false });
  stage?.addEventListener("touchend", handleImageTouchEnd);
}

function getViewerImage() {
  return document.getElementById("image-viewer-image");
}

function applyImageTransform() {
  const image = getViewerImage();
  if (!image) return;
  image.style.transform = `translate(${imageViewerState.translateX}px, ${imageViewerState.translateY}px) scale(${imageViewerState.scale})`;
}

function resetImageTransform() {
  imageViewerState.scale = 1;
  imageViewerState.translateX = 0;
  imageViewerState.translateY = 0;
  imageViewerState.isPanning = false;
  imageViewerState.initialDistance = 0;
  imageViewerState.initialScale = 1;
  applyImageTransform();
}

function clampImageScale(nextScale) {
  return Math.min(4, Math.max(1, nextScale));
}

function openImageViewer(src, alt) {
  ensureImageViewer();
  const viewer = document.getElementById("image-viewer");
  const image = getViewerImage();
  if (!viewer || !image) return;
  image.src = src;
  image.alt = alt || "Oferta";
  viewer.hidden = false;
  document.body.classList.add("image-viewer-open");
  resetImageTransform();
}

function openImageViewerZoomed(src, alt) {
  openImageViewer(src, alt);
  imageViewerState.scale = 2.2;
  applyImageTransform();
}

function closeImageViewer() {
  const viewer = document.getElementById("image-viewer");
  if (!viewer) return;
  viewer.hidden = true;
  document.body.classList.remove("image-viewer-open");
  resetImageTransform();
}

function handleImageWheel(event) {
  event.preventDefault();
  const delta = event.deltaY < 0 ? 0.2 : -0.2;
  imageViewerState.scale = clampImageScale(imageViewerState.scale + delta);
  applyImageTransform();
}

function handleImageDoubleClick(event) {
  event.preventDefault();
  if (imageViewerState.scale > 1) {
    imageViewerState.scale = 1;
    imageViewerState.translateX = 0;
    imageViewerState.translateY = 0;
  } else {
    imageViewerState.scale = 2.2;
  }
  applyImageTransform();
}

function handleImagePointerDown(event) {
  if (imageViewerState.scale <= 1) return;
  imageViewerState.isPanning = true;
  imageViewerState.startX = event.clientX - imageViewerState.translateX;
  imageViewerState.startY = event.clientY - imageViewerState.translateY;
}

function handleImagePointerMove(event) {
  if (!imageViewerState.isPanning) return;
  imageViewerState.translateX = event.clientX - imageViewerState.startX;
  imageViewerState.translateY = event.clientY - imageViewerState.startY;
  applyImageTransform();
}

function handleImagePointerUp() {
  imageViewerState.isPanning = false;
}

function getTouchDistance(touches) {
  const [first, second] = touches;
  if (!first || !second) return 0;
  const dx = second.clientX - first.clientX;
  const dy = second.clientY - first.clientY;
  return Math.hypot(dx, dy);
}

function handleImageTouchStart(event) {
  if (event.touches.length === 2) {
    event.preventDefault();
    imageViewerState.initialDistance = getTouchDistance(event.touches);
    imageViewerState.initialScale = imageViewerState.scale;
    return;
  }

  if (event.touches.length === 1 && imageViewerState.scale > 1) {
    const touch = event.touches[0];
    imageViewerState.isPanning = true;
    imageViewerState.startX = touch.clientX - imageViewerState.translateX;
    imageViewerState.startY = touch.clientY - imageViewerState.translateY;
  }
}

function handleImageTouchMove(event) {
  if (event.touches.length === 2) {
    event.preventDefault();
    const distance = getTouchDistance(event.touches);
    if (!imageViewerState.initialDistance) return;
    const ratio = distance / imageViewerState.initialDistance;
    imageViewerState.scale = clampImageScale(imageViewerState.initialScale * ratio);
    applyImageTransform();
    return;
  }

  if (event.touches.length === 1 && imageViewerState.isPanning) {
    event.preventDefault();
    const touch = event.touches[0];
    imageViewerState.translateX = touch.clientX - imageViewerState.startX;
    imageViewerState.translateY = touch.clientY - imageViewerState.startY;
    applyImageTransform();
  }
}

function handleImageTouchEnd() {
  if (imageViewerState.scale <= 1) {
    imageViewerState.translateX = 0;
    imageViewerState.translateY = 0;
  }
  imageViewerState.isPanning = false;
  imageViewerState.initialDistance = 0;
  applyImageTransform();
}

function normalizeWhatsapp(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";

  let normalized = digits;
  if (normalized.startsWith("549") && normalized.length >= 12) {
    normalized = normalized.slice(3);
  } else if (normalized.startsWith("54") && normalized.length >= 11) {
    normalized = normalized.slice(2);
  }

  if (normalized.startsWith("9") && normalized.length > 10) {
    normalized = normalized.slice(1);
  }

  return normalized;
}

function updateClientSummaries() {
  const data = getStoredData();
  const currentRaffle = getCurrentRaffle(data);
  const offersSummary = document.getElementById("offers-summary");
  const raffleSummary = document.getElementById("raffle-summary");
  const basesSummary = document.getElementById("bases-summary");

  if (offersSummary) {
    offersSummary.textContent = `${data.offers.length} productos destacados`;
  }

  if (raffleSummary && currentRaffle) {
    raffleSummary.textContent = `${currentRaffle.title} - ${currentRaffle.prize}`;
  } else if (raffleSummary) {
    raffleSummary.textContent = "sin sorteo activo";
  }

  if (basesSummary) {
    basesSummary.textContent = `${data.bases.length} condiciones publicadas`;
  }
}

function restoreActions() {
  if (!actions) return;
  actions.classList.remove("view-mode");
  actions.innerHTML = initialActionsHtml;
  updateClientSummaries();
}

function saveParticipant(form) {
  const data = getStoredData();
  const currentRaffle = getCurrentRaffle(data);
  if (!currentRaffle) {
    return { ok: false, reason: "missing_raffle" };
  }
  const formData = new FormData(form);
  const whatsapp = String(formData.get("whatsapp") || "").trim();
  const normalizedWhatsapp = normalizeWhatsapp(whatsapp);
  if (!normalizedWhatsapp) {
    return { ok: false, reason: "invalid_whatsapp" };
  }
  const alreadyRegistered = currentRaffle.participants.some(
    (participant) => normalizeWhatsapp(participant.whatsapp) === normalizedWhatsapp
  );

  if (alreadyRegistered) {
    return { ok: false, reason: "duplicate_whatsapp" };
  }

  currentRaffle.participants.unshift({
    name: String(formData.get("name") || "").trim(),
    whatsapp
  });
  setStoredData(data);
  return { ok: true };
}

function showView(which) {
  if (!actions) return;
  const data = getStoredData();
  const currentRaffle = getCurrentRaffle(data);
  actions.classList.add("view-mode");

  if (which === "ofertas") {
    actions.innerHTML = `
      ${data.offers.length ? data.offers.map((offer) => `
        <div class="offer">
          <div class="offer-main">
            ${renderOfferMedia(offer)}
            <div class="offer-copy"><b>${offer.name}</b><div class="small">${offer.note}</div></div>
          </div>
          <div class="price">${offer.price}</div>
        </div>
      `).join("") : `<div class="box">No hay ofertas cargadas.</div>`}
      <button class="btn" type="button" onclick="restoreActions()"><strong>Volver</strong><span>menu principal</span></button>
    `;
    return;
  }

  if (which === "participar") {
    if (!currentRaffle) {
      actions.innerHTML = `
        <div class="box form-intro"><b>No hay sorteo activo</b><br>Este negocio todavia no tiene un sorteo cargado.</div>
        <button class="btn" type="button" onclick="restoreActions()"><strong>Volver</strong><span>menu principal</span></button>
      `;
      return;
    }

    actions.innerHTML = `
      <div class="box form-intro"><b>Para participar del sorteo</b><br>Completa nombre y Wasap.</div>
      <form class="stack-form client-form" id="participation-form">
        <label class="field-label">
          <span>Nombre</span>
          <input type="text" name="name" placeholder="Tu nombre" required />
        </label>
        <label class="field-label">
          <span>WhatsApp</span>
          <input type="text" name="whatsapp" placeholder="Tu numero de WhatsApp" required />
        </label>
        <button class="btn primary" type="submit"><strong>Registrar participacion</strong><span>${currentRaffle.title}</span></button>
      </form>
      <div class="inline-message" id="participation-success" hidden>Gracias por participar.</div>
      <div class="inline-message" id="participation-error" hidden>Ese numero de WhatsApp ya fue registrado en este sorteo.</div>
      <div class="inline-message" id="participation-invalid" hidden>Ingresa un numero de WhatsApp valido.</div>
      <button class="btn" type="button" onclick="restoreActions()"><strong>Volver</strong><span>menu principal</span></button>
    `;

    const form = document.getElementById("participation-form");
    const success = document.getElementById("participation-success");
    const error = document.getElementById("participation-error");
    const invalid = document.getElementById("participation-invalid");
    form?.addEventListener("submit", (event) => {
      event.preventDefault();
      const result = saveParticipant(form);
      if (result.ok) {
        form.hidden = true;
        if (error) error.hidden = true;
        if (invalid) invalid.hidden = true;
        if (success) success.hidden = false;
        renderAdminView();
        renderBusinessView();
      } else if (result.reason === "invalid_whatsapp") {
        if (success) success.hidden = true;
        if (error) error.hidden = true;
        if (invalid) invalid.hidden = false;
      } else {
        if (success) success.hidden = true;
        if (invalid) invalid.hidden = true;
        if (error) error.hidden = false;
      }
    });
    return;
  }

  if (which === "bases") {
    actions.innerHTML = `
      <div class="box">${currentRaffle ? `<b>${currentRaffle.title}</b><br>${currentRaffle.prize} - ${currentRaffle.closing}<br><br>` : ""}${formatBasesLines(data.bases)}</div>
      <button class="btn" type="button" onclick="restoreActions()"><strong>Volver</strong><span>menu principal</span></button>
    `;
  }
}

function deleteOffer(index) {
  const data = getStoredData();
  data.offers.splice(index, 1);
  setStoredData(data);
  renderBusinessView();
  renderAdminView();
  updateClientSummaries();
  flashMessage("[data-delete-message]");
}

function selectRaffle(raffleId) {
  const data = getStoredData();
  data.currentRaffleId = raffleId;
  setStoredData(data);
  renderBusinessView();
  renderAdminView();
  updateClientSummaries();
}

function renderBusinessHeader() {
  const data = getStoredData();
  const nameNode = document.querySelector("[data-business-name]");
  const metaNode = document.querySelector("[data-business-meta]");
  const summaryNode = document.querySelector("[data-business-summary]");

  if (nameNode) {
    nameNode.textContent = data.business.name;
  }

  if (metaNode) {
    metaNode.textContent = `${data.business.category} - WhatsApp ${data.business.whatsapp}`;
  }

  if (summaryNode) {
    summaryNode.innerHTML = `
      <div class="item">
        <strong>Nombre</strong>
        <span>${data.business.name}</span>
      </div>
      <div class="item">
        <strong>Rubro</strong>
        <span>${data.business.category}</span>
      </div>
      <div class="item">
        <strong>WhatsApp</strong>
        <span>${data.business.whatsapp}</span>
      </div>
    `;
  }
}

function renderAdminView() {
  const data = getStoredData();
  const currentRaffle = getCurrentRaffle(data);
  const offersNode = document.querySelector("[data-admin-offers]");
  const participantsNode = document.querySelector("[data-admin-participants]");
  const basesNode = document.querySelector("[data-admin-bases]");
  const businessNode = document.querySelector("[data-admin-business]");
  const offersCountNode = document.querySelector("[data-admin-offers-count]");
  const participantsCountNode = document.querySelector("[data-admin-participants-count]");

  if (businessNode) {
    businessNode.innerHTML = `
      <div class="list">
        <div class="item">
          <strong>Negocio</strong>
          <span>${data.business.name}</span>
        </div>
        <div class="item">
          <strong>Rubro</strong>
          <span>${data.business.category}</span>
        </div>
        <div class="item">
          <strong>WhatsApp</strong>
          <span>${data.business.whatsapp}</span>
        </div>
        <div class="item">
          <strong>Sorteo actual</strong>
          <span>${currentRaffle ? currentRaffle.title : "Sin sorteo activo"}</span>
        </div>
      </div>
    `;
  }

  if (offersNode) {
    offersNode.innerHTML = data.offers.length
      ? data.offers.map((offer) => `
        <div class="offer">
          <div class="offer-main">
            ${renderOfferMedia(offer)}
            <div class="offer-copy"><b>${offer.name}</b><div class="small">${offer.note}</div></div>
          </div>
          <div class="price">${offer.price}</div>
        </div>
      `).join("")
      : `<div class="box">No hay ofertas publicadas.</div>`;
  }

  if (participantsNode) {
    participantsNode.innerHTML = currentRaffle && currentRaffle.participants.length
      ? `
        <table class="table">
          <thead>
            <tr><th>Nombre</th><th>WhatsApp</th><th>Estado</th></tr>
          </thead>
          <tbody>
            ${currentRaffle.participants.map((participant) => `
              <tr><td>${participant.name}</td><td>${participant.whatsapp}</td><td>Anotado</td></tr>
            `).join("")}
          </tbody>
        </table>
      `
      : `<div class="box">${currentRaffle ? "Todavia no hay participantes registrados." : "No hay sorteo activo."}</div>`;
  }

  if (basesNode) {
    basesNode.innerHTML = formatBasesLines(data.bases);
  }

  if (offersCountNode) {
    offersCountNode.textContent = String(data.offers.length);
  }

  if (participantsCountNode) {
    participantsCountNode.textContent = String(currentRaffle ? currentRaffle.participants.length : 0);
  }
}

function renderBusinessView() {
  const data = getStoredData();
  const currentRaffle = getCurrentRaffle(data);
  const offersList = document.querySelector("[data-offers-list]");
  const raffleBox = document.querySelector("[data-raffle-box]");
  const basesBox = document.querySelector("[data-bases-box]");
  const participantsList = document.querySelector("[data-participants-list]");
  const rafflesList = document.querySelector("[data-raffles-list]");
  const offersCount = document.querySelector("[data-offers-count]");
  const raffleTitle = document.querySelector("[data-raffle-title]");
  const status = document.querySelector("[data-status]");
  const basesForm = document.querySelector("[data-bases-form]");

  renderBusinessHeader();

  if (offersList) {
    offersList.innerHTML = data.offers.length
      ? data.offers.map((offer, index) => `
        <div class="offer offer-admin">
          <div class="offer-main">
            ${renderOfferMedia(offer)}
            <div class="offer-copy"><b>${offer.name}</b><div class="small">${offer.note}</div></div>
          </div>
          <div class="offer-actions">
            <div class="price">${offer.price}</div>
            <button class="btn btn-inline btn-danger" type="button" onclick="deleteOffer(${index})">Eliminar</button>
          </div>
        </div>
      `).join("")
      : `<div class="box">No hay ofertas cargadas.</div>`;
  }

  if (raffleBox) {
    raffleBox.innerHTML = currentRaffle
      ? `<b>${currentRaffle.title}</b><br>${currentRaffle.prize}<br>Cierre: ${currentRaffle.closing}`
      : `No hay sorteo activo.`;
  }

  if (basesBox) {
    basesBox.innerHTML = formatBasesLines(data.bases);
  }

  if (rafflesList) {
    rafflesList.innerHTML = data.raffles.length ? data.raffles.map((raffle) => `
      <button class="btn ${raffle.id === data.currentRaffleId ? "primary" : ""}" type="button" onclick="selectRaffle('${raffle.id}')">
        <strong>${raffle.title}</strong>
        <span>${raffle.participants.length} registrados</span>
      </button>
    `).join("") : `<div class="box">No hay sorteos cargados.</div>`;
  }

  if (participantsList) {
    participantsList.innerHTML = currentRaffle && currentRaffle.participants.length
      ? `
        <table class="table">
          <thead>
            <tr><th>Nombre</th><th>WhatsApp</th><th>Sorteo</th></tr>
          </thead>
          <tbody>
            ${currentRaffle.participants.map((participant) => `
              <tr>
                <td>${participant.name}</td>
                <td>${participant.whatsapp}</td>
                <td>${currentRaffle.title}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      `
      : `<div class="box">${currentRaffle ? "Todavia no hay registrados para este sorteo." : "No hay sorteo activo."}</div>`;
  }

  if (offersCount) {
    offersCount.textContent = String(data.offers.length);
  }

  if (raffleTitle) {
    raffleTitle.textContent = currentRaffle ? currentRaffle.title : "Sin sorteo";
  }

  if (status) {
    status.textContent = "Sincronizado";
  }

  if (basesForm) {
    basesForm.elements.bases.value = data.bases.join("\n");
  }
}

function flashMessage(selector) {
  const node = document.querySelector(selector);
  if (!node) return;
  node.hidden = false;
  window.setTimeout(() => {
    node.hidden = true;
  }, 2500);
}

function exportParticipants() {
  const data = getStoredData();
  const currentRaffle = getCurrentRaffle(data);
  const rows = [
    ["nombre", "whatsapp", "sorteo"],
    ...(currentRaffle ? currentRaffle.participants.map((participant) => [participant.name, participant.whatsapp, currentRaffle.title]) : [])
  ];
  const csv = rows
    .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `registrados_${currentRaffle ? currentRaffle.title.replace(/\s+/g, "_").toLowerCase() : "sin_sorteo"}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function drawWinner() {
  const data = getStoredData();
  const currentRaffle = getCurrentRaffle(data);
  const drawMessage = document.querySelector("[data-draw-message]");
  if (!drawMessage) return;

  if (!currentRaffle) {
    drawMessage.textContent = "No hay sorteo activo.";
    drawMessage.hidden = false;
    return;
  }

  if (!currentRaffle.participants.length) {
    drawMessage.textContent = "No hay participantes para sortear en este sorteo.";
    drawMessage.hidden = false;
    return;
  }

  const winner = currentRaffle.participants[Math.floor(Math.random() * currentRaffle.participants.length)];
  currentRaffle.winner = winner;
  setStoredData(data);
  drawMessage.textContent = `Ganador de ${currentRaffle.title}: ${winner.name} - ${winner.whatsapp}`;
  drawMessage.hidden = false;
  renderAdminView();
}

function initBusinessPanel() {
  const offerForm = document.querySelector("[data-offer-form]");
  const raffleForm = document.querySelector("[data-raffle-form]");
  const basesForm = document.querySelector("[data-bases-form]");
  const exportButton = document.querySelector("[data-export-participants]");
  const drawButton = document.querySelector("[data-draw-winner]");

  if (!offerForm && !raffleForm && !basesForm) return;

  renderBusinessView();

  offerForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(offerForm);
    const imageFile = offerForm.elements.image?.files?.[0] || null;
    const image = await readImageAsDataUrl(imageFile);
    const data = getStoredData();
    data.offers.unshift({
      name: String(formData.get("name") || "").trim(),
      note: String(formData.get("note") || "").trim(),
      price: String(formData.get("price") || "").trim(),
      image
    });
    setStoredData(data);
    offerForm.reset();
    renderBusinessView();
    renderAdminView();
    updateClientSummaries();
    flashMessage("[data-offer-message]");
  });

  raffleForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(raffleForm);
    const data = getStoredData();
    const newRaffle = {
      id: createRaffleId(),
      title: String(formData.get("title") || "").trim(),
      prize: String(formData.get("prize") || "").trim(),
      closing: String(formData.get("closing") || "").trim(),
      participants: [],
      winner: null
    };
    data.raffles.unshift(newRaffle);
    data.currentRaffleId = newRaffle.id;
    setStoredData(data);
    raffleForm.reset();
    renderBusinessView();
    renderAdminView();
    updateClientSummaries();
    flashMessage("[data-raffle-message]");
  });

  basesForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(basesForm);
    const lines = String(formData.get("bases") || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const data = getStoredData();
    data.bases = lines.length ? lines : [...DEFAULT_BASES];
    setStoredData(data);
    renderBusinessView();
    renderAdminView();
    updateClientSummaries();
    flashMessage("[data-bases-message]");
  });

  exportButton?.addEventListener("click", exportParticipants);
  drawButton?.addEventListener("click", drawWinner);
}

document.addEventListener("DOMContentLoaded", async () => {
  ensureImageViewer();
  await initData();
  const data = getStoredData();
  setStoredData(data);
  updateClientSummaries();
  renderBusinessHeader();
  renderBusinessView();
  renderAdminView();
  initBusinessPanel();
});

window.addEventListener("storage", async () => {
  await initData();
  updateClientSummaries();
  renderBusinessHeader();
  renderBusinessView();
  renderAdminView();
});

window.showView = showView;
window.restoreActions = restoreActions;
window.deleteOffer = deleteOffer;
window.selectRaffle = selectRaffle;
window.openImageViewer = openImageViewer;
window.openImageViewerZoomed = openImageViewerZoomed;
window.closeImageViewer = closeImageViewer;
window.initData = initData;
