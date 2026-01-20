// Deutsche Lokalisierung als Standard
const LOCALE = 'de-DE';

class VehicleManager {
  constructor() {
    this.vehicles = this.loadVehicles();
    this.currentEditId = null;
    this.pendingRestoreData = [];
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
      this.saveVehicle();
    });

    document.getElementById("cancelBtn").addEventListener("click", () => {
      this.hideModal();
    });

    document.getElementById("vehicleModal").addEventListener("click", (e) => {
      if (e.target === e.currentTarget) {
        this.hideModal();
      }
    });

    // Backup/Restore events
    document.getElementById("backupBtn").addEventListener("click", () => {
      this.showBackupModal();
    });

    document
      .getElementById("closeBackupModalBtn")
      .addEventListener("click", () => {
        this.hideBackupModal();
      });

    document.getElementById("cancelBackupBtn").addEventListener("click", () => {
      this.hideBackupModal();
    });

    document
      .getElementById("confirmRestoreBtn")
      .addEventListener("click", () => {
        this.confirmRestore();
      });

    document.getElementById("backupModal").addEventListener("click", (e) => {
      if (e.target === e.currentTarget) {
        this.hideBackupModal();
      }
    });

    // Export button
    document.getElementById("exportBtn").addEventListener("click", () => {
      this.exportBackup();
    });

    // File upload events
    const fileUploadArea = document.getElementById("fileUploadArea");
    const fileInput = document.getElementById("jsonFileInput");

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
      if (file && (file.type === "application/json" || file.name.endsWith(".json"))) {
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

  showBackupModal() {
    document.getElementById("backupModal").style.display = "block";
    document.body.style.overflow = "hidden";
    this.resetBackupModal();
  }

  hideBackupModal() {
    document.getElementById("backupModal").style.display = "none";
    document.body.style.overflow = "auto";
    this.resetBackupModal();
  }

  resetBackupModal() {
    document.getElementById("jsonFileInput").value = "";
    document.getElementById("restorePreview").style.display = "none";
    document.getElementById("confirmRestoreBtn").style.display = "none";
    this.pendingRestoreData = [];
  }

  // JSON Export Funktionalität
  exportBackup() {
    const backupData = {
      version: "1.21",
      exportDate: new Date().toISOString(),
      vehicles: this.vehicles
    };

    const dataStr = JSON.stringify(backupData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });

    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `kilometerrechner-backup-${new Date().toISOString().split('T')[0]}.json`;
    link.click();

    URL.revokeObjectURL(link.href);

    // Kurze Bestätigung anzeigen
    const exportBtn = document.getElementById("exportBtn");
    const originalText = exportBtn.innerHTML;
    exportBtn.innerHTML = '<i class="material-icons">check</i> Backup erstellt!';
    exportBtn.style.background = 'var(--accent-color)';

    setTimeout(() => {
      exportBtn.innerHTML = originalText;
      exportBtn.style.background = 'var(--primary-color)';
    }, 2000);
  }

  // JSON Import Funktionalität
  handleFileSelect(file) {
    if (!file) return;

    if (!file.name.endsWith(".json") && file.type !== "application/json") {
      alert("Bitte wählen Sie eine JSON-Datei aus.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      this.parseJSON(e.target.result);
    };
    reader.readAsText(file, "UTF-8");
  }

  parseJSON(jsonText) {
    let backupData;
    try {
      backupData = JSON.parse(jsonText);
    } catch (error) {
      alert("Fehler beim Lesen der JSON-Datei: Ungültiges Format");
      return;
    }

    // Validierung der Backup-Struktur
    if (!backupData.vehicles || !Array.isArray(backupData.vehicles)) {
      alert("Ungültiges Backup-Format: Keine Fahrzeugdaten gefunden");
      return;
    }

    const results = [];
    let hasErrors = false;

    backupData.vehicles.forEach((vehicle, index) => {
      const result = {
        index: index + 1,
        name: vehicle.name || "",
        pickupDate: vehicle.pickupDate || "",
        totalMileage: vehicle.totalMileage || 0,
        contractDuration: vehicle.contractDuration || 0,
        id: vehicle.id,
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
    });

    this.pendingRestoreData = results.filter((item) => item.errors.length === 0);
    this.showRestorePreview(results, hasErrors, backupData);
  }

  isValidDate(dateString) {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateString)) return false;

    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date);
  }

  showRestorePreview(results, hasErrors, backupData) {
    const previewDiv = document.getElementById("restorePreview");
    const previewContent = document.getElementById("previewContent");
    const confirmBtn = document.getElementById("confirmRestoreBtn");

    let html = "";

    results.forEach((item) => {
      const hasError = item.errors.length > 0;
      html += `
            <div class="preview-item ${hasError ? "error" : ""}">
                <strong>Fahrzeug ${item.index}: ${item.name || "Unbenannt"}</strong>
                <div class="preview-details">
                    Abholung: ${item.pickupDate}, Fahrleistung: ${item.totalMileage} km, Laufzeit: ${item.contractDuration} Monate
                </div>
                ${hasError ? `<div class="error-text">Fehler: ${item.errors.join(", ")}</div>` : ""}
            </div>
        `;
    });

    const validCount = results.filter((item) => item.errors.length === 0).length;
    const errorCount = results.filter((item) => item.errors.length > 0).length;

    const backupInfo = backupData.exportDate
      ? `<br>Backup vom: ${new Date(backupData.exportDate).toLocaleDateString('de-DE')}`
      : '';

    // Verwende CSS-Variablen statt fest kodierte Farben
    html = `
        <div class="restore-summary">
            <strong>Restore-Zusammenfassung:</strong><br>
            ${validCount} gültige Fahrzeuge, ${errorCount} fehlerhafte Datensätze
            ${backupInfo}
            <br><strong>Warnung:</strong> Dies überschreibt alle aktuellen Daten!
        </div>
        ${html}
    `;

    previewContent.innerHTML = html;
    previewDiv.style.display = "block";

    if (validCount > 0) {
      confirmBtn.style.display = "inline-block";
      confirmBtn.textContent = `${validCount} Fahrzeuge wiederherstellen`;
    } else {
      confirmBtn.style.display = "none";
    }
  }

  confirmRestore() {
    if (this.pendingRestoreData.length === 0) return;

    if (!confirm(`Sind Sie sicher? Dies überschreibt alle aktuellen Daten!\n\n${this.pendingRestoreData.length} Fahrzeuge werden wiederhergestellt.`)) {
      return;
    }

    try {
      // Alle aktuellen Daten löschen und neue Daten laden
      this.vehicles = this.pendingRestoreData.map(item => ({
        id: item.id || Date.now() + Math.random(),
        name: item.name,
        pickupDate: item.pickupDate,
        totalMileage: item.totalMileage,
        contractDuration: item.contractDuration,
      }));

      this.saveVehicles();
      this.renderVehicles();

      // Modal schließen BEVOR alert
      this.hideBackupModal();

      // Alert nach kurzer Verzögerung
      setTimeout(() => {
        alert(`${this.pendingRestoreData.length} Fahrzeuge erfolgreich wiederhergestellt!`);
      }, 100);

    } catch (error) {
      console.error('Fehler beim Wiederherstellen:', error);
    }
  }

  saveVehicles() {
    try {
      const dataToSave = JSON.stringify(this.vehicles);
      localStorage.setItem("leasingVehicles", dataToSave);

      // Verifikation dass Daten wirklich gespeichert wurden
      const savedData = localStorage.getItem("leasingVehicles");
      const parsedData = JSON.parse(savedData);

      console.log('SAVE: Fahrzeuge gespeichert:', parsedData.length);

      if (parsedData.length !== this.vehicles.length) {
        console.error('SAVE: Speicherfehler - Längen stimmen nicht überein!');
      }

      this.registerBackgroundSync();
    } catch (error) {
      console.error('SAVE: Fehler beim Speichern:', error);
    }
  }

  deleteVehicle(id) {
    if (confirm("Sind Sie sicher, dass Sie dieses Fahrzeug löschen möchten?")) {
      // ID als Number für korrekte Vergleiche
      const numericId = Number(id);

      this.vehicles = this.vehicles.filter((v) => Number(v.id) !== numericId);
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
                    <p>Fügen Sie Ihr erstes Fahrzeug hinzu oder stellen Sie ein Backup wieder her.</p>
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
                        <h3><i class="material-icons">directions_car</i>${vehicle.name
          }</h3>
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
                                <i class="material-icons">event</i>
                                Abholung
                            </span>
                            <span class="info-value">${new Date(
            vehicle.pickupDate
          ).toLocaleDateString(LOCALE)}</span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">
                                <i class="material-icons">speed</i>
                                Fahrleistung
                            </span>
                            <span class="info-value">${vehicle.totalMileage.toLocaleString(
            LOCALE
          )} km</span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">
                                <i class="material-icons">schedule</i>
                                Laufzeit
                            </span>
                            <span class="info-value">${vehicle.contractDuration
          } Monate</span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">
                                <i class="material-icons">today</i>
                                Vergangene Tage
                            </span>
                            <span class="info-value">${data.daysSincePickup} / ${data.contractDays
          }</span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">
                                <i class="material-icons">straighten</i>
                                km/Tag
                            </span>
                            <span class="info-value">${data.kmPerDay.toLocaleString(
            LOCALE
          )}</span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">
                                <i class="material-icons">timeline</i>
                                km bis heute
                            </span>
                            <span class="info-value ${statusClass}">${data.kmToDate.toLocaleString(
            LOCALE
          )} km</span>
                        </div>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill ${statusClass}" style="width: ${Math.min(
            data.progressPercentage,
            100
          )}%"></div>
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

// Globale Instanz erstellen
let vehicleManager;

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
      if (vehicleManager) {
        vehicleManager.hideModal();
        vehicleManager.hideBackupModal();
      }
    }
  });

  // Close button event
  document.getElementById("closeModalBtn")?.addEventListener("click", () => {
    if (vehicleManager) {
      vehicleManager.hideModal();
    }
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

  // Initialize the app nach DOM loading
  vehicleManager = new VehicleManager();

  // Observer für neue Fahrzeugkarten aktivieren
  const vehicleList = document.getElementById('vehicleList');
  if (vehicleList) {
    const vehicleObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1 && node.classList.contains('vehicle-card')) {
            observer.observe(node);
          }
        });
      });
    });

    vehicleObserver.observe(vehicleList, {
      childList: true,
      subtree: true
    });
  }
});