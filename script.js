class VehicleManager {
    constructor() {
        this.vehicles = this.loadVehicles();
        this.currentEditId = null;
        this.init();
    }

    init() {
        this.bindEvents();
        this.renderVehicles();
        this.updateVehiclesDaily();
    }

    bindEvents() {
        document.getElementById('addVehicleBtn').addEventListener('click', () => {
            this.showModal();
        });

        document.getElementById('vehicleForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveVehicle();
        });

        document.getElementById('cancelBtn').addEventListener('click', () => {
            this.hideModal();
        });

        document.getElementById('vehicleModal').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) {
                this.hideModal();
            }
        });
    }

    showModal(vehicle = null) {
        const modal = document.getElementById('vehicleModal');
        const form = document.getElementById('vehicleForm');
        const title = document.getElementById('modalTitle');

        if (vehicle) {
            title.textContent = 'Fahrzeug bearbeiten';
            document.getElementById('vehicleName').value = vehicle.name;
            document.getElementById('pickupDate').value = vehicle.pickupDate;
            document.getElementById('totalMileage').value = vehicle.totalMileage;
            document.getElementById('contractDuration').value = vehicle.contractDuration;
            this.currentEditId = vehicle.id;
        } else {
            title.textContent = 'Fahrzeug hinzufügen';
            form.reset();
            this.currentEditId = null;
        }

        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
    }

    hideModal() {
        document.getElementById('vehicleModal').style.display = 'none';
        document.body.style.overflow = 'auto';
        this.currentEditId = null;
    }

    saveVehicle() {
        const name = document.getElementById('vehicleName').value;
        const pickupDate = document.getElementById('pickupDate').value;
        const totalMileage = parseInt(document.getElementById('totalMileage').value);
        const contractDuration = parseInt(document.getElementById('contractDuration').value);

        if (this.currentEditId) {
            // Bearbeiten
            const index = this.vehicles.findIndex(v => v.id === this.currentEditId);
            if (index !== -1) {
                this.vehicles[index] = {
                    ...this.vehicles[index],
                    name,
                    pickupDate,
                    totalMileage,
                    contractDuration
                };
            }
        } else {
            // Neu hinzufügen
            const vehicle = {
                id: Date.now(),
                name,
                pickupDate,
                totalMileage,
                contractDuration
            };
            this.vehicles.push(vehicle);
        }

        this.saveVehicles();
        this.renderVehicles();
        this.hideModal();
    }

    deleteVehicle(id) {
        if (confirm('Sind Sie sicher, dass Sie dieses Fahrzeug löschen möchten?')) {
            this.vehicles = this.vehicles.filter(v => v.id !== id);
            this.saveVehicles();
            this.renderVehicles();
        }
    }

    calculateVehicleData(vehicle) {
        const today = new Date();
        const pickup = new Date(vehicle.pickupDate);
        const daysSincePickup = Math.floor((today - pickup) / (1000 * 60 * 60 * 24));
        const contractDays = vehicle.contractDuration * 30; // Approximation: 30 Tage pro Monat
        const kmPerDay = Math.round((vehicle.totalMileage / contractDays) * 100) / 100;
        const kmToDate = Math.round(daysSincePickup * kmPerDay);
        const progressPercentage = Math.min((daysSincePickup / contractDays) * 100, 100);

        return {
            daysSincePickup: Math.max(0, daysSincePickup),
            contractDays,
            kmPerDay,
            kmToDate: Math.max(0, kmToDate),
            progressPercentage,
            isOverdue: daysSincePickup > contractDays
        };
    }

    getStatusClass(data) {
        if (data.isOverdue) return 'danger';
        if (data.progressPercentage > 80) return 'warning';
        return 'highlight';
    }

    renderVehicles() {
        const container = document.getElementById('vehicleList');
        
        if (this.vehicles.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="material-icons">directions_car</i>
                    <h3>Keine Fahrzeuge vorhanden</h3>
                    <p>Fügen Sie Ihr erstes Fahrzeug hinzu, um mit der Kilometerverfolgung zu beginnen.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.vehicles.map(vehicle => {
            const data = this.calculateVehicleData(vehicle);
            const statusClass = this.getStatusClass(data);
            
            return `
                <div class="vehicle-card">
                    <div class="vehicle-header">
                        <h3><i class="material-icons">directions_car</i>${vehicle.name}</h3>
                        <div class="vehicle-actions">
                            <button class="icon-btn" onclick="vehicleManager.showModal(${JSON.stringify(vehicle).replace(/"/g, '&quot;')})">
                                <i class="material-icons">edit</i>
                            </button>
                            <button class="icon-btn" onclick="vehicleManager.deleteVehicle(${vehicle.id})">
                                <i class="material-icons">delete</i>
                            </button>
                        </div>
                    </div>
                    <div class="vehicle-info">
                        <div class="info-row">
                            <div class="info-label">
                                <i class="material-icons">event</i>
                                Tag der Abholung
                            </div>
                            <div class="info-value">
                                ${new Date(vehicle.pickupDate).toLocaleDateString('de-DE')}
                            </div>
                        </div>
                        <div class="info-row">
                            <div class="info-label">
                                <i class="material-icons">today</i>
                                Tage bis heute
                            </div>
                            <div class="info-value">
                                ${data.daysSincePickup}
                            </div>
                        </div>
                        <div class="info-row">
                            <div class="info-label">
                                <i class="material-icons">straighten</i>
                                Gesamte Fahrleistung
                            </div>
                            <div class="info-value">
                                ${vehicle.totalMileage.toLocaleString('de-DE') + " KM"}
                            </div>
                        </div>
                        <div class="info-row">
                            <div class="info-label">
                                <i class="material-icons">speed</i>
                                km pro Tag
                            </div>
                            <div class="info-value">
                                ${data.kmPerDay}
                            </div>
                        </div>
                        <div class="info-row">
                            <div class="info-label">
                                <i class="material-icons">timeline</i>
                                bis heute
                            </div>
                            <div class="info-value">
                                ${data.kmToDate.toLocaleString('de-DE') + " KM"}
                            </div>
                        </div>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill ${statusClass}" style="width: ${Math.min(data.progressPercentage, 100)}%"></div>
                    </div>
                </div>
            `;
        }).join('');
    }

    updateVehiclesDaily() {
        // Update every hour to keep data fresh
        setInterval(() => {
            this.renderVehicles();
        }, 3600000);
    }

    loadVehicles() {
        const saved = localStorage.getItem('leasingVehicles');
        return saved ? JSON.parse(saved) : [];
    }

    saveVehicles() {
        localStorage.setItem('leasingVehicles', JSON.stringify(this.vehicles));
    }
}

// Service Worker für PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(registration => {
                console.log('SW registered: ', registration);
            })
            .catch(registrationError => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}

// Zusätzlich zum bestehenden Code in script.js:

// Smooth scroll und moderne Interaktionen
document.addEventListener('DOMContentLoaded', function() {
    // Close modal mit Escape-Taste
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            vehicleManager.hideModal();
        }
    });
    
    // Close button event
    document.getElementById('closeModalBtn')?.addEventListener('click', () => {
        vehicleManager.hideModal();
    });
    
    // Smooth animations für Fahrzeugkarten
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.animationDelay = Math.random() * 0.3 + 's';
                entry.target.classList.add('animate-in');
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
    
    const style = document.createElement('style');
    style.textContent = animationCSS;
    document.head.appendChild(style);
});

// Initialize the app
const vehicleManager = new VehicleManager();