const config = {
  appId: "a21e03b2-d854-4032-b5a1-1ccb977d5174",
  accessKey: "V2-yJyGv-op8Wx-M6eIW-bWctY-W4zb1-2zNXK-4761o-JzZDZ",
  backendBaseUrl: "",
  tables: {
    postulaciones: "Postulaciones",
    baseDatos: "Base de Datos",
  },
};

const elements = {
  form: document.getElementById("postulacionForm"),
  submitBtn: document.getElementById("submitBtn"),
  alert: document.getElementById("alert"),
  alertText: document.getElementById("alertText"),
  success: document.getElementById("success"),
  extraFields: document.getElementById("extraFields"),
  nombre: document.getElementById("nombre"),
  apellido: document.getElementById("apellido"),
  dni: document.getElementById("dni"),
  fechaNacimiento: document.getElementById("fechaNacimiento"),
  edad: document.getElementById("edad"),
  correo: document.getElementById("correo"),
  telefono: document.getElementById("telefono"),
  provincia: document.getElementById("provincia"),
  ciudad: document.getElementById("ciudad"),
  direccion: document.getElementById("direccion"),
  secundario: document.getElementById("secundario"),
  empleo: document.getElementById("empleo"),
  empleoTitle: document.getElementById("empleoTitle"),
  empleoDescription: document.getElementById("empleoDescription"),
  cv: document.getElementById("cv"),
  estadoCandidato: document.getElementById("estadoCandidato"),
  notas: document.getElementById("notas"),
  estadoPostulacion: document.getElementById("estadoPostulacion"),
  fechaCreacion: document.getElementById("fechaCreacion"),
  id: document.getElementById("id"),
  idCandidato: document.getElementById("idCandidato"),
};

const state = {
  empleo: "",
  dniVerified: false,
  existingPostulation: false,
  baseDataFound: false,
  baseData: null,
  dniLookupInProgress: false,
  lastDniDigits: "",
  lastCheckedDni: "",
};

const cityOptions = {
  "Río Negro": ["Cipolletti", "Fernández Oro", "Ferri", "General Roca"],
  "Neuquén": ["Neuquén", "Plottier"],
};

const defaultCity = {
  "Río Negro": "Cipolletti",
  "Neuquén": "Neuquén",
};

const tableHeaders = {
  ApplicationAccessKey: config.accessKey,
  "Content-Type": "application/json",
};

const baseUrl = `https://api.appsheet.com/api/v2/apps/${config.appId}/tables`;

function showAlert(message, type = "info") {
  if (!message) {
    if (elements.alertText) {
      elements.alertText.textContent = "";
    } else {
      elements.alert.textContent = "";
    }
    elements.alert.className = "alert";
    elements.alert.style.display = "none";
    return;
  }
  if (elements.alertText) {
    elements.alertText.textContent = message;
  } else {
    elements.alert.textContent = message;
  }
  elements.alert.className = `alert ${type === "error" ? "error" : ""}`.trim();
  elements.alert.style.display = "block";
}

function showExtraFields(show) {
  elements.extraFields.classList.toggle("hidden", !show);
  elements.submitBtn.disabled = !show;
  document.querySelectorAll("[data-extra-field]").forEach((field) => {
    field.classList.toggle("hidden", !show);
  });
  if (show) {
    ensureDefaultProvinceCity();
  }
}

function ensureDefaultProvinceCity() {
  if (!elements.provincia.value) {
    elements.provincia.value = "Río Negro";
  }
  updateCityOptions();
  if (!elements.ciudad.value) {
    elements.ciudad.value = "Cipolletti";
  }
}

function normalizeEmpleo(value) {
  return value ? value.trim() : "";
}

function candidateIdFor(dni, empleo) {
  if (!dni || !empleo) return "";
  return `${dni}-${empleo.trim().toUpperCase()}`;
}

function buildDniSelectors(dni) {
  const digits = getDniDigits(dni);
  if (!digits) return [];
  return [`[DNI] = ${digits}`, `[DNI] = "${digits}"`];
}

function normalizeDniValue(dni) {
  const digits = getDniDigits(dni);
  if (!digits) return "";
  return Number(digits);
}

function getDniDigits(dni) {
  return (dni || "").replace(/[^0-9]/g, "");
}

function setInitialValues() {
  const params = new URLSearchParams(window.location.search);
  const empleo = params.get("empleo") || params.get("Empleo") || "";
  const debug = params.get("debug") === "1";
  const debugAll = params.get("debug") === "all";
  state.empleo = normalizeEmpleo(empleo);
  if (state.empleo) {
    elements.empleo.value = state.empleo;
    elements.empleo.readOnly = true;
  }
  if (elements.empleoTitle) {
    elements.empleoTitle.textContent = state.empleo || "este empleo";
  }
  if (elements.empleoDescription) {
    elements.empleoDescription.textContent = "";
    elements.empleoDescription.classList.add("hidden");
  }

  const today = new Date();
  elements.fechaCreacion.value = today.toISOString().split("T")[0];
  elements.id.value = generateUniqueId();

  if (!elements.provincia.value) {
    elements.provincia.value = "Río Negro";
  }
  updateCityOptions();
  if (!elements.ciudad.value) {
    elements.ciudad.value = "Cipolletti";
  }

  if (debug) {
    debugBaseDataAccess();
  }
  if (debugAll) {
    debugReadAllBaseData();
  }

  if (state.empleo) {
    loadEmpleoDescription(state.empleo);
  }
}
function getBackendBaseUrl() {
  if (config.backendBaseUrl) return config.backendBaseUrl;
  const host = window.location.hostname;
  if (host === "localhost" || host === "127.0.0.1") {
    return "http://localhost:3001";
  }
  return "";
}

async function loadEmpleoDescription(empleo) {
  try {
    const baseUrl = getBackendBaseUrl();
    const response = await fetch(`${baseUrl}/api/empleos?empleo=${encodeURIComponent(empleo)}`);
    const data = await response.json();
    const descripcion = data?.descripcion || "";
    if (elements.empleoTitle) {
      elements.empleoTitle.textContent = empleo || "este empleo";
    }
    if (elements.empleoDescription) {
      elements.empleoDescription.textContent = descripcion;
      elements.empleoDescription.classList.toggle("hidden", !descripcion);
    }
  } catch (error) {
    if (elements.empleoTitle) {
      elements.empleoTitle.textContent = empleo || "este empleo";
    }
    if (elements.empleoDescription) {
      elements.empleoDescription.textContent = "";
      elements.empleoDescription.classList.add("hidden");
    }
  }
}

function generateUniqueId() {
  if (crypto?.randomUUID) {
    return crypto.randomUUID();
  }
  return `ID-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function updateCityOptions() {
  const provincia = elements.provincia.value || "";
  const options = cityOptions[provincia] || [];
  elements.ciudad.innerHTML = "";

  if (!provincia) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "Seleccionar";
    elements.ciudad.appendChild(option);
    return;
  }

  options.forEach((city) => {
    const option = document.createElement("option");
    option.value = city;
    option.textContent = city;
    elements.ciudad.appendChild(option);
  });

  const defaultValue = defaultCity[provincia];
  if (defaultValue) {
    elements.ciudad.value = defaultValue;
  }
}

function calculateAge(birthDate) {
  if (!birthDate) return "";
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

function normalizeDateToInput(value) {
  if (!value) return "";
  const raw = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }
  const match = raw.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (!match) return "";
  const part1 = Number(match[1]);
  const part2 = Number(match[2]);
  let year = Number(match[3]);
  if (year < 100) year += 2000;
  let day = part2;
  let month = part1;
  if (part1 > 12 && part2 <= 12) {
    day = part1;
    month = part2;
  } else if (part2 > 12 && part1 <= 12) {
    day = part2;
    month = part1;
  }
  const pad = (n) => String(n).padStart(2, "0");
  return `${year}-${pad(month)}-${pad(day)}`;
}

async function appsheetRequest(tableName, action, properties = {}, rows = [], options = {}) {
  const response = await fetch(`${baseUrl}/${encodeURIComponent(tableName)}/Action`, {
    method: "POST",
    headers: tableHeaders,
    body: JSON.stringify({
      Action: action,
      Properties: properties,
      Rows: rows,
    }),
  });

  const rawText = await response.text();
  if (!response.ok) {
    if (!options.silent) {
      console.error("AppSheet error", response.status, rawText);
    }
    throw new Error(rawText || "Error en AppSheet");
  }

  try {
    return JSON.parse(rawText || "{}");
  } catch (error) {
    return rawText;
  }
}

async function findByFilter(tableName, filter) {
  console.log("AppSheet Find", { tableName, filter });
  const result = await appsheetRequest(tableName, "Find", {
    Filter: filter,
  });
  const rows = Array.isArray(result) ? result : result?.Rows || [];
  console.log("AppSheet Find result", { tableName, count: rows.length, rows });
  return rows;
}

async function readRows(tableName) {
  console.log("AppSheet Read", { tableName });
  const result = await appsheetRequest(tableName, "Read", {}, []);
  const rows = Array.isArray(result) ? result : result?.Rows || [];
  console.log("AppSheet Read result", { tableName, count: rows.length });
  return rows;
}

async function checkExistingPostulation(dni, empleo) {
  const idCandidato = candidateIdFor(dni, empleo);
  if (!idCandidato) return false;
  try {
    const baseUrl = getBackendBaseUrl();
    const response = await fetch(
      `${baseUrl}/api/postulaciones/exists?dni=${encodeURIComponent(dni)}&empleo=${encodeURIComponent(empleo)}`
    );
    const data = await response.json();
    return Boolean(data?.exists);
  } catch (error) {
    console.warn("Backend postulation check failed", error);
    return false;
  }
}

async function lookupBaseData(dni) {
  if (!dni) return null;
  const digits = getDniDigits(dni);
  if (!digits) return null;
  try {
    const baseUrl = getBackendBaseUrl();
    const response = await fetch(`${baseUrl}/api/base-datos?dni=${encodeURIComponent(digits)}`);
    const data = await response.json();
    if (data?.found) {
      const rowDni = getDniDigits(String(data?.row?.DNI ?? data?.row?.["DNI"] ?? ""));
      if (rowDni && rowDni === digits) {
        return data.row || null;
      }
      return null;
    }
    return null;
  } catch (error) {
    console.warn("Backend base data lookup failed", error);
    return null;
  }
}

async function debugBaseDataAccess() {
  try {
    console.log("Debug: checking Base de Datos access with selector TRUE");
    const rows = await findByFilter(config.tables.baseDatos, "TRUE");
    console.log("Debug: Base de Datos rows", rows.slice(0, 3));
  } catch (error) {
    console.error("Debug: Base de Datos access failed", error);
  }
}

async function debugReadAllBaseData() {
  try {
    console.log("Debug: reading all Base de Datos rows via backend");
    const baseUrl = getBackendBaseUrl();
    const response = await fetch(`${baseUrl}/api/base-datos/all?limit=5`);
    const data = await response.json();
    console.log("Debug: Base de Datos total rows", data?.count || 0);
    console.log("Debug: Base de Datos sample", data?.rows || []);
  } catch (error) {
    console.error("Debug: Read all Base de Datos failed", error);
  }
}

function fillBaseData(row) {
  if (!row) return;
  const normalizedBirthDate = normalizeDateToInput(row["Fecha de Nacimiento"] || "");
  elements.fechaNacimiento.value = normalizedBirthDate;
  elements.edad.value = row["Edad"] || calculateAge(normalizedBirthDate);
  elements.correo.value = row["Correo Electrónico"] || "";
  elements.telefono.value = row["Teléfono"] || "";
  elements.provincia.value = row["Provincia"] || "";
  updateCityOptions();
  elements.ciudad.value = row["Ciudad"] || elements.ciudad.value;
  elements.direccion.value = row["Dirección"] || "";
  elements.secundario.value = row["Tipo de Secundario"] || "";

  const terciarioValue = row["Terciario o Universidad"] || "";
  const selected = terciarioValue
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  document
    .querySelectorAll('input[name="Terciario o Universidad"]')
    .forEach((checkbox) => {
      checkbox.checked = selected.includes(checkbox.value);
    });
}

function getTerciarioValues() {
  const values = [];
  document
    .querySelectorAll('input[name="Terciario o Universidad"]:checked')
    .forEach((checkbox) => {
      values.push(checkbox.value);
    });
  return values.join(", ");
}

function clearExtraFields() {
  elements.fechaNacimiento.value = "";
  elements.edad.value = "";
  elements.correo.value = "";
  elements.telefono.value = "";
  elements.provincia.value = "";
  updateCityOptions();
  elements.ciudad.value = "";
  elements.direccion.value = "";
  elements.secundario.value = "";
  elements.cv.value = "";
  document
    .querySelectorAll('input[name="Terciario o Universidad"]')
    .forEach((checkbox) => {
      checkbox.checked = false;
    });
}

function clearAllFields() {
  elements.nombre.value = "";
  elements.apellido.value = "";
  clearExtraFields();
}

function setLoading(isLoading) {
  elements.submitBtn.disabled = isLoading;
  elements.submitBtn.textContent = isLoading ? "Enviando..." : "Enviar postulación";
}

async function handleDniLookup(force = false) {
  if (state.dniLookupInProgress) return;
  const dni = elements.dni.value.trim();
  const empleo = normalizeEmpleo(elements.empleo.value || state.empleo);
  const dniDigits = getDniDigits(dni);

  if (dniDigits) {
    elements.dni.value = dniDigits;
  }

  console.log("DNI lookup", { dni, empleo, fromUrl: state.empleo });

  if (!empleo) {
    showAlert("No se encontró el empleo. Usá el link del empleo correspondiente.", "error");
    showExtraFields(false);
    return;
  }

  if (!elements.nombre.value.trim() || !elements.apellido.value.trim()) {
    showAlert("Completá Nombre y Apellido para continuar.", "error");
    showExtraFields(false);
    return;
  }

  if (!dniDigits || dniDigits.length < 7) {
    showAlert("Ingresá un DNI válido para continuar.", "error");
    showExtraFields(false);
    return;
  }

  if (!force && dniDigits === state.lastCheckedDni) {
    return;
  }

  state.lastCheckedDni = dniDigits;

  state.dniLookupInProgress = true;
  showAlert("Verificando datos...", "info");

  try {
    console.log("Checking existing postulation");
    const alreadyApplied = await checkExistingPostulation(dniDigits, empleo || state.empleo);
    if (alreadyApplied) {
      state.existingPostulation = true;
      state.dniVerified = false;
      showAlert(
        `Ya te postulaste para ${empleo || state.empleo}, agradecemos tu interés por este puesto, ya estamos evaluando tu perfil.`,
        "error"
      );
      showExtraFields(false);
      clearAllFields();
      return;
    }

    state.existingPostulation = false;
    console.log("Looking up base data");
    const baseRow = await lookupBaseData(dniDigits);
    if (baseRow) {
      state.baseDataFound = true;
      state.baseData = baseRow;
      fillBaseData(baseRow);
      showAlert("Encontramos tus datos y los completamos automáticamente.", "info");
    } else {
      state.baseDataFound = false;
      state.baseData = null;
      clearExtraFields();
      ensureDefaultProvinceCity();
      showAlert("Continuá completando el formulario.", "info");
    }

    showExtraFields(true);
    state.dniVerified = true;
    state.lastDniDigits = dniDigits;
  } catch (error) {
    console.error("DNI lookup error", error);
    showAlert("No pudimos verificar el DNI. Intentá nuevamente.", "error");
    showExtraFields(false);
  } finally {
    state.dniLookupInProgress = false;
  }
}

async function encodeFile(file) {
  if (!file) return null;
  return {
    fileName: file.name,
  };
}

async function submitPostulation(payload) {
  return appsheetRequest(config.tables.postulaciones, "Add", {}, [payload]);
}

async function submitBaseData(payload, options = {}) {
  return appsheetRequest(config.tables.baseDatos, "Add", {}, [payload], options);
}

function buildPostulationPayload(cvFile) {
  const dniRaw = elements.dni.value.trim();
  const dniDigits = getDniDigits(dniRaw);
  const dniValue = normalizeDniValue(dniRaw);
  const empleo = normalizeEmpleo(elements.empleo.value || state.empleo);
  const idCandidato = candidateIdFor(dniDigits, empleo);
  elements.idCandidato.value = idCandidato;

  const payload = {
    Nombre: elements.nombre.value.trim(),
    Apellido: elements.apellido.value.trim(),
    "Estado del candidato": elements.estadoCandidato.value,
    "Carga tu CV": cvFile?.fileName || "",
    Notas: elements.notas.value,
    "Fecha de Nacimiento": elements.fechaNacimiento.value,
    Edad: elements.edad.value,
    DNI: dniValue,
    "Correo Electrónico": elements.correo.value.trim(),
    Teléfono: elements.telefono.value.trim(),
    Provincia: elements.provincia.value,
    Ciudad: elements.ciudad.value,
    Dirección: elements.direccion.value.trim(),
    "Tipo de Secundario": elements.secundario.value,
    "Terciario o Universidad": getTerciarioValues(),
    Empleo: empleo,
    ID: elements.id.value,
    "Fecha de Creación": elements.fechaCreacion.value,
    "Estado de la Postulación": elements.estadoPostulacion.value,
    "ID Candidato": idCandidato,
  };

  if (cvFile?.fileName) {
    payload["Carga tu CV"] = `${dniDigits}-${empleo}-${cvFile.fileName}`;
  }

  return payload;
}

function buildBaseDataPayload(cvFile) {
  const dniRaw = elements.dni.value.trim();
  const dniDigits = getDniDigits(dniRaw);
  const dniValue = normalizeDniValue(dniRaw);
  const empleo = normalizeEmpleo(elements.empleo.value || state.empleo);

  return {
    Nombre: elements.nombre.value.trim(),
    Apellido: elements.apellido.value.trim(),
    CV: cvFile?.fileName ? `${dniDigits}-${empleo}-${cvFile.fileName}` : "",
    "Fecha de Nacimiento": elements.fechaNacimiento.value,
    Edad: elements.edad.value,
    DNI: dniValue,
    "Correo Electrónico": elements.correo.value.trim(),
    Teléfono: elements.telefono.value.trim(),
    Provincia: elements.provincia.value,
    Ciudad: elements.ciudad.value,
    Dirección: elements.direccion.value.trim(),
    "Tipo de Secundario": elements.secundario.value,
    "Terciario o Universidad": getTerciarioValues(),
  };
}

function showSuccess() {
  elements.form.classList.add("hidden");
  elements.success.classList.remove("hidden");
  showAlert("");
}

function isDuplicateDniError(error, dni) {
  const message = error?.message || "";
  if (!dni) return false;
  return (
    message.includes("Invalid value for column DNI") &&
    message.includes(`Row ID to correct: ${dni}`)
  );
}

function updateEdad() {
  const edad = calculateAge(elements.fechaNacimiento.value);
  elements.edad.value = edad || "";
}

function attachEvents() {
  elements.provincia.addEventListener("change", updateCityOptions);
  elements.fechaNacimiento.addEventListener("blur", updateEdad);
  elements.dni.addEventListener("input", () => {
    const digits = getDniDigits(elements.dni.value);
    elements.dni.value = digits;
    if (digits !== state.lastCheckedDni) {
      state.lastCheckedDni = "";
    }
    if ((state.dniVerified || state.baseDataFound) && digits !== state.lastDniDigits) {
      state.dniVerified = false;
      state.existingPostulation = false;
      state.baseDataFound = false;
      state.baseData = null;
      showExtraFields(false);
      clearAllFields();
      state.lastDniDigits = "";
      showAlert("DNI modificado. Volvé a validar para continuar.", "info");
    }
  });
  elements.dni.addEventListener("blur", () => handleDniLookup(false));
  elements.dni.addEventListener("change", () => handleDniLookup(false));
  elements.dni.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleDniLookup(true);
    }
  });
  elements.empleo.addEventListener("change", () => {
    state.empleo = normalizeEmpleo(elements.empleo.value);
  });

  elements.form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!state.dniVerified || state.existingPostulation) {
      showAlert("Necesitás validar el DNI para continuar.", "error");
      return;
    }

    try {
      setLoading(true);
      const cvFile = await encodeFile(elements.cv.files[0]);
      const payload = buildPostulationPayload(cvFile);
      await submitPostulation(payload);

      if (!state.baseDataFound) {
        const basePayload = buildBaseDataPayload(cvFile);
        try {
          await submitBaseData(basePayload, { silent: true });
        } catch (error) {
          if (!isDuplicateDniError(error, elements.dni.value.trim())) {
            throw error;
          }
        }
      }

      showSuccess();
    } catch (error) {
      showAlert(
        `No pudimos enviar la postulación. ${error?.message || "Intentá nuevamente."}`,
        "error"
      );
    } finally {
      setLoading(false);
    }
  });
}

setInitialValues();
attachEvents();
showExtraFields(false);
showAlert("Completá Nombre, Apellido y DNI para comenzar.", "info");
