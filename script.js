// Deutsche Lokalisierung als Standard
const LOCALE = 'de-DE';

class VehicleManager {
  constructor() {
    this.vehicles = this.loadVehicles();
    this.currentEditId = null;
    this.pendingRestoreData = [];
    this.renderedVehicles = new Set(); // Performance-Tracking
    this.batchSize = 10; // Batch-Verarbeitung
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

  // WICHTIG: Alle Event-Listener
  bindEvents() {
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
    document.getElementById("addVehicleBtn").addEventListener("click", () => {
      this.showModal();
    });

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
  }

  // SAVE VEHICLE FUNKTION - Das war das Problem!
  saveVehicle() {
    try {
      const name = document.getElementById("vehicleName").value.trim();
      const pickupDate = document.getElementById("pickupDate").value;
      const totalMileage = parseInt(document.getElementById("totalMileage").value);
      const contractDuration = parseInt(document.getElementById("contractDuration").value);

      // Validation
      if (!name) {
        alert("Bitte geben Sie einen Fahrzeugnamen ein.");
        return;
      }

      if (!pickupDate) {
        alert("Bitte geben Sie das Abholung-Datum ein.");
        return;
      }

      if (!totalMileage || totalMileage <= 0) {
        alert("Bitte geben Sie eine gültige Fahrleistung ein.");
        return;
      }

      if (!contractDuration || contractDuration <= 0) {
        alert("Bitte geben Sie eine gültige Vertragslaufzeit ein.");
        return;
      }

      console.log('SAVE VEHICLE: Processing...', { name, pickupDate, totalMileage, contractDuration });

      const vehicleData = {
        id: this.currentEditId || Date.now() + Math.random(),
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

      // Save to localStorage
      this.saveVehicles();

      // Update UI efficiently
      if (this.currentEditId) {
        // For editing, do a full re-render to be safe
        this.renderVehicles();
      } else {
        // For new vehicles, add the element directly for better UX
        this.addVehicleElement(vehicleData);
      }

      // Close modal
      this.hideModal();

      console.log('SAVE VEHICLE: Successfully completed');

    } catch (error) {
      console.error('SAVE VEHICLE: Error occurred:', error);
      alert('Fehler beim Speichern: ' + error.message);
    }
  }

  // SAVE VEHICLES FUNKTION - Das ist die fehlende Funktion!
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
      throw error; // Re-throw für Error-Handling in aufrufender Funktion
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

  // Optimized function to add single vehicle element
  addVehicleElement(vehicle) {
    const container = document.getElementById("vehicleList");
    
    // Check if we need to replace the empty state
    const emptyState = container.querySelector('.empty-state');
    if (emptyState) {
      container.innerHTML = '';
    }

    // Create and append new vehicle element
    const vehicleElement = this.createVehicleElement(vehicle);
    container.appendChild(vehicleElement);

    // Add animation
    vehicleElement.style.opacity = '0';
    vehicleElement.style.transform = 'translateY(20px)';
    
    requestAnimationFrame(() => {
      vehicleElement.style.transition = 'all 0.3s ease';
      vehicleElement.style.opacity = '1';
      vehicleElement.style.transform = 'translateY(0)';
    });
  }

  // MODAL FUNKTIONEN
  showModal(vehicle = null) {
    const modal = document.getElementById("vehicleModal");
    const form = document.getElementById("vehicleForm");
    const title = document.getElementById("modalTitle");

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

    // Performance-optimiertes Rendering mit DocumentFragment
    this.renderVehiclesBatched(container);
    
    console.log(`[PERFORMANCE] Rendering ${this.vehicles.length} vehicles took ${performance.now() - startTime}ms`);
  }

  // Batch-Rendering für bessere Performance
  async renderVehiclesBatched(container) {
    container.innerHTML = ''; // Clear once
    const fragment = document.createDocumentFragment();

    // Verarbeitung in Batches
    for (let i = 0; i < this.vehicles.length; i += this.batchSize) {
      const batch = this.vehicles.slice(i, i + this.batchSize);
      
      batch.forEach(vehicle => {
        const vehicleElement = this.createVehicleElement(vehicle);
        fragment.appendChild(vehicleElement);
      });

      // Yield to main thread nach jedem Batch
      if (i + this.batchSize < this.vehicles.length) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    container.appendChild(fragment);
  }

  // Erstelle einzelnes Fahrzeug-Element (optimiert)
  createVehicleElement(vehicle) {
    const data = this.calculateVehicleData(vehicle);
    const statusClass = this.getStatusClass(data);

    const vehicleCard = document.createElement('div');
    vehicleCard.className = 'vehicle-card';
    vehicleCard.dataset.vehicleId = vehicle.id;

    vehicleCard.innerHTML = `
      <div class="vehicle-header">
        <h3><i class="material-icons">directions_car</i>${this.escapeHtml(vehicle.name)}</h3>
        <div class="vehicle-actions">
          <button class="icon-btn edit-btn" data-vehicle-id="${vehicle.id}">
            <i class="material-icons">edit</i>
          </button>
          <button class="icon-btn delete-btn" data-vehicle-id="${vehicle.id}">
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
          <span class="info-value">${new Date(vehicle.pickupDate).toLocaleDateString(LOCALE)}</span>
        </div>
        <div class="info-row">
          <span class="info-label">
            <i class="material-icons">speed</i>
            Fahrleistung
          </span>
          <span class="info-value">${vehicle.totalMileage.toLocaleString(LOCALE)} km</span>
        </div>
        <div class="info-row">
          <span class="info-label">
            <i class="material-icons">schedule</i>
            Laufzeit
          </span>
          <span class="info-value">${vehicle.contractDuration} Monate</span>
        </div>
        <div class="info-row">
          <span class="info-label">
            <i class="material-icons">today</i>
            Vergangene Tage
          </span>
          <span class="info-value">${data.daysSincePickup} / ${data.contractDays}</span>
        </div>
        <div class="info-row">
          <span class="info-label">
            <i class="material-icons">straighten</i>
            km/Tag
          </span>
          <span class="info-value">${data.kmPerDay.toLocaleString(LOCALE)}</span>
        </div>
        <div class="info-row">
          <span class="info-label">
            <i class="material-icons">timeline</i>
            km bis heute
          </span>
          <span class="info-value ${statusClass}">${data.kmToDate.toLocaleString(LOCALE)} km</span>
        </div>
      </div>
      <div class="progress-bar">
        <div class="progress-fill ${statusClass}" style="width: ${Math.min(data.progressPercentage, 100)}%"></div>
      </div>
    `;

    return vehicleCard;
  }

  // DELETE VEHICLE FUNKTION
  deleteVehicle(id) {
    if (!confirm("Sind Sie sicher, dass Sie dieses Fahrzeug löschen möchten?")) {
      return;
    }

    const startTime = performance.now();
    
    // Verwende String-Vergleich für robustes ID-Handling
    const targetId = String(id);
    const originalLength = this.vehicles.length;
    
    this.vehicles = this.vehicles.filter(v => String(v.id) !== targetId);

    if (this.vehicles.length === originalLength) {
      console.error('DELETE: Fahrzeug nicht gefunden, ID:', targetId);
      alert('Fehler beim Löschen: Fahrzeug nicht gefunden');
      return;
    }

    this.saveVehicles();
    
    // Optimiertes Rendering - nur das gelöschte Element entfernen
    this.removeVehicleElement(targetId);
    
    console.log(`[PERFORMANCE] Delete operation took ${performance.now() - startTime}ms`);
  }

  // DOM-Element direkt entfernen ohne komplettes Re-Rendering
  removeVehicleElement(vehicleId) {
    const element = document.querySelector(`[data-vehicle-id="${vehicleId}"]`);
    if (element) {
      element.remove();
      
      // Wenn keine Fahrzeuge mehr vorhanden, Empty State anzeigen
      const container = document.getElementById("vehicleList");
      if (container.children.length === 0) {
        this.renderVehicles(); // Zeigt Empty State
      }
    } else {
      // Fallback: komplettes Re-Rendering
      console.warn('Element not found, falling back to full re-render');
      this.renderVehicles();
    }
  }

  // BERECHNUNGS-FUNKTIONEN
  calculateVehicleData(vehicle) {
    const today = new Date();
    const pickup = new Date(vehicle.pickupDate);
    const daysSincePickup = Math.floor((today - pickup) / (1000 * 60 * 60 * 24));
    const contractDays = vehicle.contractDuration * 30;
    const kmPerDay = Math.round((vehicle.totalMileage / contractDays) * 100) / 100;
    const kmToDate = Math.round(daysSincePickup * kmPerDay);
    const progressPercentage = Math.min((daysSincePickup / contractDays) * 100, 100);

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

  // HTML-Escaping für Sicherheit
  escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return String(text).replace(/[&<>"']/g, m => map[m]);
  }

  // BACKUP/EXPORT FUNKTIONEN
  exportBackup() {
    const backupData = {
      version: "1.24",
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

    // Visual feedback
    const exportBtn = document.getElementById("exportBtn");
    const originalText = exportBtn.innerHTML;
    exportBtn.innerHTML = '<i class="material-icons">check</i> Backup erstellt!';
    exportBtn.style.background = 'var(--accent-color)';

    setTimeout(() => {
      exportBtn.innerHTML = originalText;
      exportBtn.style.background = 'var(--primary-color)';
    }, 2000);
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

      // Validation
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
      // ID-Generierung mit besserer Eindeutigkeit
      let idCounter = Date.now();
      
      this.vehicles = this.pendingRestoreData.map(item => ({
        id: item.id || (idCounter++),
        name: item.name,
        pickupDate: item.pickupDate,
        totalMileage: item.totalMileage,
        contractDuration: item.contractDuration,
      }));

      this.saveVehicles();
      this.renderVehicles();

      this.hideBackupModal();

      /*setTimeout(() => {
        alert(`${this.pendingRestoreData.length} Fahrzeuge erfolgreich wiederhergestellt!`);
      }, 100);*/

    } catch (error) {
      console.error('Fehler beim Wiederherstellen:', error);
      alert('Fehler beim Wiederherstellen der Daten. Bitte versuchen Sie es erneut.');
    }
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

  registerBackgroundSync() {
    if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
      navigator.serviceWorker.ready.then((registration) => {
        registration.sync.register('background-sync-vehicles');
      }).catch(err => console.log('Background sync not supported'));
    }
  }
}

// Globale Instanz mit verbesserter Initialisierung
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

// App-Initialisierung
document.addEventListener("DOMContentLoaded", function () {
  // Escape-Key Handler
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && vehicleManager) {
      vehicleManager.hideModal();
      vehicleManager.hideBackupModal();
    }
  });

  // Initialize app
  vehicleManager = new VehicleManager();
});