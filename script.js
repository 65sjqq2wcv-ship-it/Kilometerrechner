// Deutsche Lokalisierung als Standard
const LOCALE = 'de-DE';

class VehicleManager {
  constructor() {
    this.vehicles = this.loadVehicles();
    this.currentEditId = null;
    this.pendingRestoreData = [];
    this.renderedVehicles = new Set();
    this.batchSize = 10;
    this.isSaving = false;
    this._syncRegistered = false;
    this.init();
  }

  init() {
    this.bindEvents();
    this.renderVehicles();
    this.updateVehiclesDaily();
    this.initOfflineSupport();
    this.initServiceWorkerUpdates();
  }

  bindEvents() {
    console.log('BIND EVENTS: Starting...');

    try {
      // Form submission
      document.getElementById("vehicleForm").addEventListener("submit", (e) => {
        e.preventDefault();
        this.saveVehicle();
      });

      // Cancel button
      document.getElementById("cancelBtn").addEventListener("click", () => {
        this.hideModal();
      });

      // Close button (X)
      document.getElementById("closeModalBtn").addEventListener("click", () => {
        this.hideModal();
      });

      // Modal overlay click
      document.getElementById("vehicleModal").addEventListener("click", (e) => {
        if (e.target === e.currentTarget) {
          this.hideModal();
        }
      });

      // Add Vehicle Button
      const addBtn = document.getElementById("addVehicleBtn");
      if (addBtn) {
        addBtn.addEventListener("click", () => {
          console.log('ADD BUTTON CLICKED!');
          this.showModal();
        });
        console.log('BIND EVENTS: Add button bound');
      } else {
        console.error('BIND EVENTS: addVehicleBtn not found!');
      }

      // EVENT DELEGATION für Fahrzeug-Aktionen
      document.getElementById("vehicleList").addEventListener("click", (e) => {
        const button = e.target.closest('.icon-btn');
        if (!button) return;

        const vehicleId = button.dataset.vehicleId;

        if (button.classList.contains('edit-btn')) {
          const vehicle = this.vehicles.find(v => String(v.id) === String(vehicleId));
          if (vehicle) this.showModal(vehicle);
        } else if (button.classList.contains('delete-btn')) {
          this.deleteVehicle(vehicleId);
        }
      });

      // Backup/Restore events
      document.getElementById("backupBtn").addEventListener("click", () => {
        this.showBackupModal();
      });

      document.getElementById("closeBackupModalBtn").addEventListener("click", () => {
        this.hideBackupModal();
      });

      document.getElementById("cancelBackupBtn").addEventListener("click", () => {
        this.hideBackupModal();
      });

      document.getElementById("confirmRestoreBtn").addEventListener("click", () => {
        this.confirmRestore();
      });

      document.getElementById("backupModal").addEventListener("click", (e) => {
        if (e.target === e.currentTarget) {
          this.hideBackupModal();
        }
      });

      // Export and file handling
      document.getElementById("exportBtn").addEventListener("click", () => {
        this.exportBackup();
      });

      const fileUploadArea = document.getElementById("fileUploadArea");
      const fileInput = document.getElementById("jsonFileInput");

      fileUploadArea.addEventListener("click", () => {
        fileInput.click();
      });

      fileInput.addEventListener("change", (e) => {
        this.handleFileSelect(e.target.files[0]);
      });

      // Drag and drop
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

      // **NEUE LÖSUNG**: Heute als Standard-Datum für pickupDate setzen (wie in app.js)
      document.getElementById("pickupDate").valueAsDate = new Date();

      // **DROPDOWN MENU EVENTS** - Neue Ergänzung
      const menuToggle = document.getElementById("menuToggleBtn");
      const dropdownMenu = document.querySelector(".dropdown-menu");

      if (menuToggle) {
        menuToggle.addEventListener("click", (e) => {
          e.stopPropagation();
          dropdownMenu.classList.toggle("open");
        });

        // Schließen bei Klick außerhalb
        document.addEventListener("click", (e) => {
          if (!dropdownMenu.contains(e.target)) {
            dropdownMenu.classList.remove("open");
          }
        });

        // Schließen nach Klick auf Dropdown-Item
        document.querySelectorAll('.dropdown-item').forEach(item => {
          item.addEventListener('click', () => {
            dropdownMenu.classList.remove('open');
          });
        });

        console.log('BIND EVENTS: Dropdown menu bound');
      } else {
        console.error('BIND EVENTS: menuToggleBtn not found!');
      }

      console.log('BIND EVENTS: All events bound successfully');
    } catch (error) {
      console.error('BIND EVENTS: Error occurred:', error);
    }
  }

  // SAVE VEHICLE - Einzige Version ohne Rekursion
  saveVehicle() {
    try {
      const name = document.getElementById("vehicleName").value.trim();
      const pickupDate = document.getElementById("pickupDate").value;
      const totalMileage = parseInt(document.getElementById("totalMileage").value);
      const contractDuration = parseInt(document.getElementById("contractDuration").value);

      // Validation
      if (!name || !pickupDate || !totalMileage || totalMileage <= 0 || !contractDuration || contractDuration <= 0) {
        alert("Bitte füllen Sie alle Felder korrekt aus.");
        return;
      }

      console.log('SAVE VEHICLE: Processing...', { name, pickupDate, totalMileage, contractDuration });

      const vehicleData = {
        id: this.currentEditId || Date.now(),
        name,
        pickupDate,
        totalMileage,
        contractDuration
      };

      if (this.currentEditId) {
        // Edit existing vehicle
        const index = this.vehicles.findIndex(v => String(v.id) === String(this.currentEditId));
        if (index !== -1) {
          this.vehicles[index] = vehicleData;
          console.log('SAVE VEHICLE: Updated existing vehicle at index', index);
        } else {
          console.error('SAVE VEHICLE: Vehicle not found for editing, ID:', this.currentEditId);
          alert('Fehler: Fahrzeug zum Bearbeiten nicht gefunden.');
          return;
        }
      } else {
        // Add new vehicle
        this.vehicles.push(vehicleData);
        console.log('SAVE VEHICLE: Added new vehicle, total count:', this.vehicles.length);
      }

      // DIREKTES Speichern ohne saveVehicles() Aufruf
      localStorage.setItem("leasingVehicles", JSON.stringify(this.vehicles));

      // UI Update
      this.renderVehicles();
      this.hideModal();

      console.log('SAVE VEHICLE: Erfolgreich!');

    } catch (error) {
      console.error('SAVE VEHICLE: Fehler:', error);
      alert('Fehler beim Speichern: ' + error.message);
    }
  }

  // SAVE VEHICLES - Einzige einfache Version
  saveVehicles() {
    if (this.isSaving) {
      console.log('SAVE: Bereits am Speichern - überspringe');
      return;
    }

    try {
      this.isSaving = true;
      localStorage.setItem("leasingVehicles", JSON.stringify(this.vehicles));
      console.log('SAVE: Fahrzeuge gespeichert:', this.vehicles.length);
    } catch (error) {
      console.error('SAVE: Fehler beim Speichern:', error);
    } finally {
      this.isSaving = false;
    }
  }

  // LOAD VEHICLES
  loadVehicles() {
    try {
      const saved = localStorage.getItem("leasingVehicles");
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.error('LOAD: Fehler beim Laden:', error);
      return [];
    }
  }

  // MODAL FUNKTIONEN
  showModal(vehicle = null) {
    console.log('SHOW MODAL: Called with vehicle:', vehicle);

    const modal = document.getElementById("vehicleModal");
    const form = document.getElementById("vehicleForm");
    const title = document.getElementById("modalTitle");

    if (!modal) {
      console.error('SHOW MODAL: vehicleModal not found!');
      return;
    }

    if (!form) {
      console.error('SHOW MODAL: vehicleForm not found!');
      return;
    }

    console.log('SHOW MODAL: All elements found, proceeding...');

    if (vehicle) {
      title.textContent = "Fahrzeug bearbeiten";
      document.getElementById("vehicleName").value = vehicle.name;
      document.getElementById("pickupDate").value = vehicle.pickupDate;
      document.getElementById("totalMileage").value = vehicle.totalMileage;
      document.getElementById("contractDuration").value = vehicle.contractDuration;
      this.currentEditId = vehicle.id;
    } else {
      title.textContent = "Fahrzeug hinzufügen";
      form.reset();
      // **NEUE LÖSUNG**: Standard-Datum setzen nach dem Reset (wie in app.js)
      document.getElementById("pickupDate").valueAsDate = new Date();
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

  // RENDER FUNKTIONEN
  renderVehicles() {
    const container = document.getElementById("vehicleList");
    const startTime = performance.now();

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

    this.renderVehiclesBatched(container);
    console.log(`[PERFORMANCE] Rendering ${this.vehicles.length} vehicles took ${performance.now() - startTime}ms`);
  }

  async renderVehiclesBatched(container) {
    container.innerHTML = '';
    const fragment = document.createDocumentFragment();

    for (let i = 0; i < this.vehicles.length; i += this.batchSize) {
      const batch = this.vehicles.slice(i, i + this.batchSize);
      
      batch.forEach(vehicle => {
        const vehicleCard = this.createVehicleCard(vehicle);
        fragment.appendChild(vehicleCard);
      });

      // Batch in DOM einfügen
      if (i === 0) {
        container.appendChild(fragment);
      }

      // Kurze Pause für bessere Performance
      if (i + this.batchSize < this.vehicles.length) {
        await new Promise(resolve => setTimeout(resolve, 5));
      }
    }
  }

  createVehicleCard(vehicle) {
    const data = this.calculateVehicleData(vehicle);
    const statusClass = this.getStatusClass(data);
    
    const vehicleCard = document.createElement('div');
    vehicleCard.className = 'vehicle-card';
    vehicleCard.innerHTML = `
      <div class="vehicle-header">
        <h3>
          <i class="material-icons">directions_car</i>
          ${this.escapeHtml(vehicle.name)}
        </h3>
        <div class="vehicle-actions">
          <button class="icon-btn edit-btn" data-vehicle-id="${vehicle.id}" title="Bearbeiten">
            <i class="material-icons">edit</i>
          </button>
          <button class="icon-btn delete-btn" data-vehicle-id="${vehicle.id}" title="Löschen">
            <i class="material-icons">delete</i>
          </button>
        </div>
      </div>
      <div class="vehicle-info">
        <div class="info-row">
          <div class="info-label">
            <i class="material-icons">event</i>
            Abholungsdatum
          </div>
          <div class="info-value">${new Date(vehicle.pickupDate).toLocaleDateString(LOCALE)}</div>
        </div>
        <div class="info-row">
          <div class="info-label">
            <i class="material-icons">schedule</i>
            Laufzeit
          </div>
          <div class="info-value">${vehicle.contractDuration} Monate</div>
        </div>
        <div class="info-row">
          <div class="info-label">
            <i class="material-icons">speed</i>
            Fahrleistung
          </div>
          <div class="info-value">${vehicle.totalMileage.toLocaleString(LOCALE)} km</div>
        </div>
        <div class="info-row">
          <div class="info-label">
            <i class="material-icons">today</i>
            Tage seit Abholung
          </div>
          <div class="info-value">${data.daysSincePickup}</div>
        </div>
        <div class="info-row">
          <div class="info-label">
            <i class="material-icons">trending_up</i>
            km/Tag
          </div>
          <div class="info-value">${data.kmPerDay}</div>
        </div>
        <div class="info-row">
          <div class="info-label">
            <i class="material-icons">location_on</i>
            Sollstand heute
          </div>
          <div class="info-value ${statusClass}">${data.kmToDate.toLocaleString(LOCALE)} km</div>
        </div>
      </div>
      <div class="progress-bar">
        <div class="progress-fill ${statusClass}" style="width: ${Math.min(data.progressPercentage, 100)}%"></div>
      </div>
    `;

    return vehicleCard;
  }

  calculateVehicleData(vehicle) {
    const pickupDate = new Date(vehicle.pickupDate);
    const today = new Date();
    const contractEndDate = new Date(pickupDate);
    contractEndDate.setMonth(contractEndDate.getMonth() + vehicle.contractDuration);

    const daysSincePickup = Math.max(0, Math.floor((today - pickupDate) / (1000 * 60 * 60 * 24)));
    const contractDays = Math.floor((contractEndDate - pickupDate) / (1000 * 60 * 60 * 24));

    // **KORREKTE FORMEL**: Mit exakten Werten rechnen
    const kmPerDayExact = vehicle.totalMileage / 365;
    const kmPerDay = Math.round(kmPerDayExact); // Nur für die Anzeige gerundet
    const kmToDate = Math.round(kmPerDayExact * daysSincePickup); // Mit exaktem Wert rechnen
    const progressPercentage = contractDays > 0 ? (daysSincePickup / contractDays) * 100 : 0;

    return {
      daysSincePickup,
      contractDays,
      kmPerDay,
      kmToDate,
      progressPercentage
    };
  }

  getStatusClass(data) {
    if (data.progressPercentage > 100) return 'danger';
    if (data.progressPercentage > 90) return 'warning';
    return 'highlight';
  }

  // DELETE VEHICLE
  deleteVehicle(id) {
    if (!confirm("Sind Sie sicher, dass Sie dieses Fahrzeug löschen möchten?")) {
      return;
    }

    const targetId = String(id);
    const originalLength = this.vehicles.length;

    this.vehicles = this.vehicles.filter(v => String(v.id) !== targetId);

    if (this.vehicles.length === originalLength) {
      console.error('DELETE: Fahrzeug nicht gefunden, ID:', targetId);
      alert('Fehler beim Löschen: Fahrzeug nicht gefunden');
      return;
    }

    localStorage.setItem("leasingVehicles", JSON.stringify(this.vehicles));
    this.renderVehicles();
  }

  // BACKUP/EXPORT FUNKTIONEN
  exportBackup() {
    const exportData = {
      version: "1.27",
      exportDate: new Date().toISOString(),
      vehicles: this.vehicles,
      appInfo: {
        name: "Kilometerrechner",
        version: "1.27"
      }
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const filename = `kilometerrechner-backup-${new Date().toISOString().split('T')[0]}.json`;
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

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

      if (!result.name) result.errors.push("Fahrzeugname fehlt");
      if (!result.pickupDate || !this.isValidDate(result.pickupDate)) {
        result.errors.push("Ungültiges Datum (Format: YYYY-MM-DD)");
      }
      if (result.totalMileage <= 0) result.errors.push("Ungültige Fahrleistung");
      if (result.contractDuration <= 0) result.errors.push("Ungültige Vertragslaufzeit");

      if (result.errors.length > 0) hasErrors = true;
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
          <strong>Fahrzeug ${item.index}: ${this.escapeHtml(item.name || "Unbenannt")}</strong>
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
      let idCounter = Date.now();

      this.vehicles = this.pendingRestoreData.map(item => ({
        id: item.id || (idCounter++),
        name: item.name,
        pickupDate: item.pickupDate,
        totalMileage: item.totalMileage,
        contractDuration: item.contractDuration,
      }));

      localStorage.setItem("leasingVehicles", JSON.stringify(this.vehicles));
      this.renderVehicles();
      this.hideBackupModal();

    } catch (error) {
      console.error('Fehler beim Wiederherstellen:', error);
      alert('Fehler beim Wiederherstellen der Daten. Bitte versuchen Sie es erneut.');
    }
  }

  escapeHtml(unsafe) {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // UTILITY FUNKTIONEN
  updateVehiclesDaily() {
    setInterval(() => {
      this.renderVehicles();
    }, 3600000);
  }

  initOfflineSupport() {
    window.addEventListener('online', () => this.handleOnlineStatus(true));
    window.addEventListener('offline', () => this.handleOnlineStatus(false));

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        this.handleServiceWorkerMessage(event.data);
      });
    }

    this.handleOnlineStatus(navigator.onLine);
  }

  handleOnlineStatus(isOnline) {
    const statusIndicator = this.createStatusIndicator();

    if (isOnline) {
      statusIndicator.textContent = '';
      statusIndicator.className = 'online-status';
    } else {
      statusIndicator.textContent = '📱 Offline-Modus';
      statusIndicator.className = 'offline-status';
    }
  }

  createStatusIndicator() {
    let indicator = document.getElementById('connection-status');
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.id = 'connection-status';
      const heroSection = document.querySelector('.hero-section');
      if (heroSection) {
        heroSection.appendChild(indicator);
      }
    }
    return indicator;
  }

  handleServiceWorkerMessage(data) {
    console.log('[APP] Service Worker Message erhalten:', data.type);

    switch (data.type) {
      case 'ONLINE':
        this.handleOnlineStatus(true);
        break;
      case 'OFFLINE':
        this.handleOnlineStatus(false);
        break;
      case 'DATA_SYNCED':
        console.log('[APP] Daten synchronisiert - keine weitere Aktion');
        break;
    }
  }

  initServiceWorkerUpdates() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((registration) => {
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

  // Background Sync deaktiviert
  registerBackgroundSync() {
    console.log('Background Sync deaktiviert');
  }
}

// Globale Instanz
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

// App-Initialisierung - Erweitert um Dropdown-Schließen
document.addEventListener("DOMContentLoaded", function () {
  // Escape-Key Handler - ERWEITERT
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && vehicleManager) {
      vehicleManager.hideModal();
      vehicleManager.hideBackupModal();
      
      // Dropdown schließen
      const dropdownMenu = document.querySelector(".dropdown-menu");
      if (dropdownMenu) {
        dropdownMenu.classList.remove("open");
      }
    }
  });

  // Initialize app
  vehicleManager = new VehicleManager();
});