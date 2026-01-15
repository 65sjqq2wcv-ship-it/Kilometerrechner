// Deutsche Lokalisierung als Standard
const LOCALE = 'de-DE';

class VehicleManager {
  constructor() {
    this.vehicles = this.loadVehicles();
    this.currentEditId = null;
    this.pendingImportData = [];
    this.init();
    this.setGermanLocale();
  }

  init() {
    this.bindEvents();
    this.renderVehicles();
    this.updateVehiclesDaily();
    this.initOfflineSupport();
    this.initServiceWorkerUpdates();
  }

  setGermanLocale() {
    // Für alle Zahlenformatierungen deutsche Einstellungen verwenden
    Number.prototype.toLocaleString = function (locales, options) {
      return Number.prototype.toLocaleString.call(this, LOCALE, options);
    };
  }

  bindEvents() {
    // Existing events
    document.getElementById("addVehicleBtn").addEventListener("click", () => {
      this.showModal();
    });

    document.getElementById("vehicleForm").addEventListener("submit", (e) => {
      e.preventDefault();
      this.saveVehicle(); f
    });

    document.getElementById("cancelBtn").addEventListener("click", () => {
      this.hideModal();
    });

    document.getElementById("vehicleModal").addEventListener("click", (e) => {
      if (e.target === e.currentTarget) {
        this.hideModal();
      }
    });

    // Import events
    document.getElementById("importBtn").addEventListener("click", () => {
      this.showImportModal();
    });

    document
      .getElementById("closeImportModalBtn")
      .addEventListener("click", () => {
        this.hideImportModal();
      });

    document.getElementById("cancelImportBtn").addEventListener("click", () => {
      this.hideImportModal();
    });

    document
      .getElementById("confirmImportBtn")
      .addEventListener("click", () => {
        this.confirmImport();
      });

    document.getElementById("importModal").addEventListener("click", (e) => {
      if (e.target === e.currentTarget) {
        this.hideImportModal();
      }
    });

    // File upload events
    const fileUploadArea = document.getElementById("fileUploadArea");
    const fileInput = document.getElementById("csvFileInput");

    fileUploadArea.addEventListener("click", () => {
      fileInput.click();
    });

    fileInput.addEventListener("change", (e) => {
      this.handleFileSelect(e.target.files[0]);
    });

    // Drag and drop events
    fileUploadArea.addEventListener("dragover", (e) => {
      e.preventDefault();
      fileUploadArea.classList.add("dragover");
    });

    fileUploadArea.addEventListener("dragleave", () => {
      fileUploadArea.classList.remove("dragover");
    });

    fileUploadArea.addEventListener("drop", (e) => {
      e.preventDefault();
      fileUploadArea.classList.remove("dragover");
      const file = e.dataTransfer.files[0];
      if (file && (file.type === "text/csv" || file.name.endsWith(".csv"))) {
        this.handleFileSelect(file);
      }
    });
  }

  showModal(vehicle = null) {
    const modal = document.getElementById("vehicleModal");
    const form = document.getElementById("vehicleForm");
    const title = document.getElementById("modalTitle");

    if (vehicle) {
      title.textContent = "Fahrzeug bearbeiten";
      document.getElementById("vehicleName").value = vehicle.name;
      document.getElementById("pickupDate").value = vehicle.pickupDate;
      document.getElementById("totalMileage").value = vehicle.totalMileage;
      document.getElementById("contractDuration").value =
        vehicle.contractDuration;
      this.currentEditId = vehicle.id;
    } else {
      title.textContent = "Fahrzeug hinzufügen";
      form.reset();
      this.currentEditId = null;
    }

    modal.style.display = "block";
    document.body.style.overflow = "hidden";
  }

  hideModal() {
    document.getElementById("vehicleModal").style.display = "none";
    document.body.style.overflow = "auto";
    this.currentEditId = null;
  }

  showImportModal() {
    document.getElementById("importModal").style.display = "block";
    document.body.style.overflow = "hidden";
    this.resetImportModal();
  }

  hideImportModal() {
    document.getElementById("importModal").style.display = "none";
    document.body.style.overflow = "auto";
    this.resetImportModal();
  }

  resetImportModal() {
    document.getElementById("csvFileInput").value = "";
    document.getElementById("importPreview").style.display = "none";
    document.getElementById("confirmImportBtn").style.display = "none";
    this.pendingImportData = [];
  }

  handleFileSelect(file) {
    if (!file) return;

    if (!file.name.endsWith(".csv") && file.type !== "text/csv") {
      alert("Bitte wählen Sie eine CSV-Datei aus.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      this.parseCSV(e.target.result);
    };
    reader.readAsText(file, "UTF-8");
  }

  parseCSV(csvText) {
    const lines = csvText.split("\n").filter((line) => line.trim() !== "");
    const results = [];
    let hasErrors = false;

    lines.forEach((line, index) => {
      const parts = line.split(";").map((part) => part.trim());

      if (parts.length >= 4) {
        const [name, pickupDate, totalMileage, contractDuration] = parts;

        const result = {
          originalLine: index + 1,
          name: name || "",
          pickupDate: pickupDate || "",
          totalMileage: parseInt(totalMileage) || 0,
          contractDuration: parseInt(contractDuration) || 0,
          errors: [],
        };

        // Validation
        if (!result.name) {
          result.errors.push("Fahrzeugname fehlt");
        }
        if (!result.pickupDate || !this.isValidDate(result.pickupDate)) {
          result.errors.push("Ungültiges Datum (Format: YYYY-MM-DD)");
        }
        if (result.totalMileage <= 0) {
          result.errors.push("Ungültige Fahrleistung");
        }
        if (result.contractDuration <= 0) {
          result.errors.push("Ungültige Vertragslaufzeit");
        }

        if (result.errors.length > 0) {
          hasErrors = true;
        }

        results.push(result);
      } else if (line.trim() !== "") {
        hasErrors = true;
        results.push({
          originalLine: index + 1,
          name: "",
          pickupDate: "",
          totalMileage: 0,
          contractDuration: 0,
          errors: [
            "Unvollständige Datenzeile - benötigt 4 Felder getrennt durch Semikolon",
          ],
        });
      }
    });

    this.pendingImportData = results.filter((item) => item.errors.length === 0);
    this.showImportPreview(results, hasErrors);
  }

  isValidDate(dateString) {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateString)) return false;

    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date);
  }

  showImportPreview(results, hasErrors) {
    const previewDiv = document.getElementById("importPreview");
    const previewContent = document.getElementById("previewContent");
    const confirmBtn = document.getElementById("confirmImportBtn");

    let html = "";

    results.forEach((item) => {
      const hasError = item.errors.length > 0;
      html += `
                <div class="preview-item ${hasError ? "error" : ""}">
                    <strong>Zeile ${item.originalLine}: ${item.name || "Unbenannt"
        }</strong>
                    <div class="preview-details">
                        Abholung: ${item.pickupDate}, Fahrleistung: ${item.totalMileage
        } km, Laufzeit: ${item.contractDuration} Monate
                    </div>
                    ${hasError
          ? `<div class="error-text">Fehler: ${item.errors.join(
            ", "
          )}</div>`
          : ""
        }
                </div>
            `;
    });

    const validCount = results.filter(
      (item) => item.errors.length === 0
    ).length;
    const errorCount = results.filter((item) => item.errors.length > 0).length;

    html = `
            <div style="margin-bottom: 20px; padding: 15px; background: #e3f2fd; border-radius: 8px;">
                <strong>Import-Zusammenfassung:</strong><br>
                ${validCount} gültige Datensätze, ${errorCount} fehlerhafte Datensätze
            </div>
            ${html}
        `;

    previewContent.innerHTML = html;
    previewDiv.style.display = "block";

    if (validCount > 0) {
      confirmBtn.style.display = "inline-block";
      confirmBtn.textContent = `${validCount} Fahrzeuge importieren`;
    } else {
      confirmBtn.style.display = "none";
    }
  }

  confirmImport() {
    if (this.pendingImportData.length === 0) return;

    this.pendingImportData.forEach((item) => {
      const vehicle = {
        id: Date.now() + Math.random(),
        name: item.name,
        pickupDate: item.pickupDate,
        totalMileage: item.totalMileage,
        contractDuration: item.contractDuration,
      };
      this.vehicles.push(vehicle);
    });

    this.saveVehicles();
    this.renderVehicles();
    this.hideImportModal();

    alert(`${this.pendingImportData.length} Fahrzeuge erfolgreich importiert!`);
  }

  saveVehicle() {
    const name = document.getElementById("vehicleName").value;
    const pickupDate = document.getElementById("pickupDate").value;
    const totalMileage = parseInt(
      document.getElementById("totalMileage").value
    );
    const contractDuration = parseInt(
      document.getElementById("contractDuration").value
    );

    if (this.currentEditId) {
      // Bearbeiten
      const index = this.vehicles.findIndex((v) => v.id === this.currentEditId);
      if (index !== -1) {
        this.vehicles[index] = {
          ...this.vehicles[index],
          name,
          pickupDate,
          totalMileage,
          contractDuration,
        };
      }
    } else {
      // Neu hinzufügen
      const vehicle = {
        id: Date.now(),
        name,
        pickupDate,
        totalMileage,
        contractDuration,
      };
      this.vehicles.push(vehicle);
    }

    this.saveVehicles();
    this.renderVehicles();
    this.hideModal();
  }

  deleteVehicle(id) {
    if (confirm("Sind Sie sicher, dass Sie dieses Fahrzeug löschen möchten?")) {
      this.vehicles = this.vehicles.filter((v) => v.id !== id);
      this.saveVehicles();
      this.renderVehicles();
    }
  }

  calculateVehicleData(vehicle) {
    const today = new Date();
    const pickup = new Date(vehicle.pickupDate);
    const daysSincePickup = Math.floor(
      (today - pickup) / (1000 * 60 * 60 * 24)
    );
    const contractDays = vehicle.contractDuration * 30; // Approximation: 30 Tage pro Monat
    const kmPerDay =
      Math.round((vehicle.totalMileage / contractDays) * 100) / 100;
    const kmToDate = Math.round(daysSincePickup * kmPerDay);
    const progressPercentage = Math.min(
      (daysSincePickup / contractDays) * 100,
      100
    );

    return {
      daysSincePickup: Math.max(0, daysSincePickup),
      contractDays,
      kmPerDay,
      kmToDate: Math.max(0, kmToDate),
      progressPercentage,
      isOverdue: daysSincePickup > contractDays,
    };
  }

  getStatusClass(data) {
    if (data.isOverdue) return "danger";
    if (data.progressPercentage > 80) return "warning";
    return "highlight";
  }

  renderVehicles() {
    const container = document.getElementById("vehicleList");

    if (this.vehicles.length === 0) {
      container.innerHTML = `
                <div class="empty-state">
                    <i class="material-icons">directions_car</i>
                    <h3>Keine Fahrzeuge vorhanden</h3>
                    <p>Fügen Sie Ihr erstes Fahrzeug hinzu oder importieren Sie eine CSV-Datei.</p>
                </div>
            `;
      return;
    }

    container.innerHTML = this.vehicles
      .map((vehicle) => {
        const data = this.calculateVehicleData(vehicle);
        const statusClass = this.getStatusClass(data);

        return `
                <div class="vehicle-card">
                    <div class="vehicle-header">
                        <h3>
                            <i class="material-icons">directions_car</i>
                            ${vehicle.name}
                        </h3>
                        <div class="vehicle-actions">
                            <button class="icon-btn" onclick="vehicleManager.showModal(${JSON.stringify(
          vehicle
        ).replace(/"/g, "&quot;")})">
                                <i class="material-icons">edit</i>
                            </button>
                            <button class="icon-btn" onclick="vehicleManager.deleteVehicle(${vehicle.id
          })">
                                <i class="material-icons">delete</i>
                            </button>
                        </div>
                    </div>
                    <div class="vehicle-info">
                        <div class="info-row">
                            <span class="info-label">
                                <i class="material-icons">today</i>
                                Abholung
                            </span>
                            <span class="info-value">${new Date(
            vehicle.pickupDate
          ).toLocaleDateString("de-DE")}</span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">
                                <i class="material-icons">speed</i>
                                Tage seit Abholung
                            </span>
                            <span class="info-value">${data.daysSincePickup
          } Tage</span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">
                                <i class="material-icons">straighten</i>
                                Gesamtlaufleistung
                            </span>
                            <span class="info-value">${vehicle.totalMileage.toLocaleString()} km</span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">
                                <i class="material-icons">calculate</i>
                                km pro Tag
                            </span>
                           <span class="info-value">${Number(data.kmPerDay).toLocaleString('de-DE', { maximumFractionDigits: 2 })} km</span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">
                                <i class="material-icons">timeline</i>
                                km bis heute
                            </span>
                            <span class="info-value ${statusClass}">${data.kmToDate.toLocaleString()} km</span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">
                                <i class="material-icons">schedule</i>
                                Vertragslaufzeit
                            </span>
                            <span class="info-value">${vehicle.contractDuration
          } Monate</span>
                        </div>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill ${statusClass}" style="width: ${data.progressPercentage
          }%"></div>
                    </div>
                </div>
            `;
      })
      .join("");
  }

  updateVehiclesDaily() {
    // Update every hour to keep data fresh
    setInterval(() => {
      this.renderVehicles();
    }, 3600000);
  }

  loadVehicles() {
    const saved = localStorage.getItem("leasingVehicles");
    return saved ? JSON.parse(saved) : [];
  }

  saveVehicles() {
    localStorage.setItem("leasingVehicles", JSON.stringify(this.vehicles));
    this.registerBackgroundSync();
  }

  // Offline Support Funktionen
  initOfflineSupport() {
    // Online/Offline Status überwachen
    window.addEventListener('online', () => this.handleOnlineStatus(true));
    window.addEventListener('offline', () => this.handleOnlineStatus(false));

    // Service Worker Messages
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        this.handleServiceWorkerMessage(event.data);
      });
    }

    // Initial Status setzen
    this.handleOnlineStatus(navigator.onLine);
  }

  handleOnlineStatus(isOnline) {
    const statusIndicator = this.createStatusIndicator();

    if (isOnline) {
      statusIndicator.textContent = '';
      statusIndicator.className = 'online-status';
      console.log('[APP] Online-Modus');
    } else {
      statusIndicator.textContent = '📱 Offline-Modus';
      statusIndicator.className = 'offline-status';
      console.log('[APP] Offline-Modus - Daten werden lokal gespeichert');
    }
  }

  createStatusIndicator() {
    let indicator = document.getElementById('connection-status');
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.id = 'connection-status';
      document.querySelector('.hero-section').appendChild(indicator);
    }
    return indicator;
  }

  handleServiceWorkerMessage(data) {
    switch (data.type) {
      case 'ONLINE':
        this.handleOnlineStatus(true);
        break;
      case 'OFFLINE':
        this.handleOnlineStatus(false);
        break;
      case 'DATA_SYNCED':
        console.log('[APP] Daten synchronisiert');
        break;
    }
  }

  // Service Worker Update-Handler
  initServiceWorkerUpdates() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((registration) => {
        // Auf Updates prüfen
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              this.showUpdateNotification();
            }
          });
        });
      });
    }
  }

  showUpdateNotification() {
    const updateBar = document.createElement('div');
    updateBar.className = 'update-notification';
    updateBar.innerHTML = `
      <span>Neue Version verfügbar!</span>
      <button onclick="window.location.reload()">Aktualisieren</button>
      <button onclick="this.parentElement.remove()">×</button>
    `;
    document.body.insertBefore(updateBar, document.body.firstChild);
  }

  // Background Sync registrieren
  registerBackgroundSync() {
    if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
      navigator.serviceWorker.ready.then((registration) => {
        registration.sync.register('background-sync-vehicles');
      }).catch(err => console.log('Background sync not supported'));
    }
  }
}

// Service Worker für PWA
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("sw.js")
      .then((registration) => {
        console.log("SW registered: ", registration);
      })
      .catch((registrationError) => {
        console.log("SW registration failed: ", registrationError);
      });
  });
}

// Zusätzlich zum bestehenden Code in script.js:

// Smooth scroll und moderne Interaktionen
document.addEventListener("DOMContentLoaded", function () {
  // Close modal mit Escape-Taste
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      vehicleManager.hideModal();
      vehicleManager.hideImportModal();
    }
  });

  // Close button event
  document.getElementById("closeModalBtn")?.addEventListener("click", () => {
    vehicleManager.hideModal();
  });

  // Smooth animations für Fahrzeugkarten
  const observerOptions = {
    threshold: 0.1,
    rootMargin: "0px 0px -50px 0px",
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.style.animationDelay = Math.random() * 0.3 + "s";
        entry.target.classList.add("animate-in");
      }
    });
  }, observerOptions);

  // Animation CSS
  const animationCSS = `
        @keyframes slideInUp {
            from {
                opacity: 0;
                transform: translateY(30px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        
        .animate-in {
            animation: slideInUp 0.6s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }
    `;

  const style = document.createElement("style");
  style.textContent = animationCSS;
  document.head.appendChild(style);
});

// Initialize the app
const vehicleManager = new VehicleManager();