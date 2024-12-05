/**
 * InteraktivesCanvas - Eine Klasse für ein interaktives Canvas-Element
 * Implementiert ein zoombares und verschiebbares Canvas mit Text-Eingabe-Funktionalität
 * Inspiriert von Apple Freeform mit ähnlichem Verhalten für Zoom und Pan
 * 
 * Features:
 * - Stufenloses Zoomen mit Mausrad
 * - Physikbasiertes Verschieben mit Trägheit
 * - Text-Eingabe an beliebigen Positionen
 * - Ausblendbare Grid-Punkte
 * - Elastische Grenzen
 */
class InteraktivesCanvas {
    /**
     * Initialisiert das Canvas und alle notwendigen Konfigurationen
     * Setzt die grundlegenden Parameter für Zoom, Grid und Bewegung
     * 
     * Konfigurationsparameter:
     * - Zoom: 50% bis 300% (-100% bis +200% relativ)
     * - Grid: 50px Basis-Abstand, mindestens 25px sichtbar
     * - Bewegung: Elastische Grenzen mit 15% Nachgeben
     * - Viewport: 8-fache Bildschirmgröße als virtueller Bereich
     */
    constructor() {
        this.canvas = document.getElementById('interaktiveCanvas');                // Holt Canvas-Element aus DOM
        this.context = null;                                                      // Canvas-Kontext für Zeichenoperationen
        this.scale = 1.5;                                                        // Aktuelle Zoom-Stufe (1.0 = 100%)
        this.offset = { x: 0, y: 0 };                                            // Position des Canvas im Viewport
        this.lastPosition = { x: 0, y: 0 };                                      // Letzte bekannte Mausposition
        this.isDragging = false;                                                 // Flag für aktives Ziehen
        
        // Zoom Konfiguration
        this.minScale = 0.5;                                                     // Minimaler Zoom (50%)
        this.maxScale = 3.0;                                                     // Maximaler Zoom (300%)
        this.zoomIntensity = 0.001;                                             // Zoom-Geschwindigkeit pro Scroll
        
        // Virtuelle Canvas-Größe (unbegrenzt)
        this.virtualWidth = Infinity;                                // Virtuelle Breite (unbegrenzt)
        this.virtualHeight = Infinity;                              // Virtuelle Höhe (unbegrenzt)
        
        this.currentTool = 'pan';                                               // Aktives Werkzeug (Pan = Verschieben)
        this.textElements = [];                                                 // Array für Textelemente
        this.textInput = document.getElementById('textInput');                  // Text-Eingabefeld
        this.textInputContainer = document.querySelector('.text-input-container'); // Container für Text-Eingabe

        // Entferne die festen Grenzen
        this.boundaries = {
            left: -Infinity,                                        // Keine linke Grenze
            right: Infinity,                                        // Keine rechte Grenze
            top: -Infinity,                                         // Keine obere Grenze
            bottom: Infinity                                        // Keine untere Grenze
        };

        // Bewegungs-Physik anpassen
        this.dragLimits = {
            maxSpeed: 50,                                           // Erhöhte maximale Geschwindigkeit
            friction: 0.95,                                         // Reduzierte Reibung für längeres Gleiten
            elasticity: 0,                                          // Keine Elastizität (keine Grenzen)
            horizontalLimit: Infinity                               // Keine horizontale Begrenzung
        };

        // Bewegungs-Physik
        this.velocity = { x: 0, y: 0 };                                        // Aktuelle Bewegungsgeschwindigkeit
        this.friction = 0.95;                                                  // Reibungsfaktor für Ausgleiten
        this.isMoving = false;                                                // Flag für Bewegungsstatus
        this.lastTime = null;                                                 // Zeitstempel der letzten Bewegung
        this.animationFrame = null;                                          // RequestAnimationFrame ID

        // Grid-Konfiguration
        this.gridSize = 50;                                                  // Abstand zwischen Grid-Punkten
        this.minGridSize = 25;                                              // Minimale sichtbare Grid-Größe

        this.isGridVisible = true;                                       // Status der Grid-Sichtbarkeit
        this.setupGridToggle();                                         // Initialisiert Grid Toggle
        this.initialize();                                              // Startet Initialisierung

        // Neue Eigenschaften für Text-Manipulation
        this.selectedText = null;
        this.isDraggingText = false;
        this.dragStartPos = { x: 0, y: 0 };
        this.textOffset = { x: 0, y: 0 };
        this.textVelocity = { x: 0, y: 0 };
        this.lastTextPos = { x: 0, y: 0 };
        this.textAnimationFrame = null;

        // Neue Eigenschaften für Font-Dragging
        this.isDraggingFont = false;
        this.initialFontSize = 128; // Basis-Schriftgröße
        this.currentFontSize = 128;
        this.fontDragStart = { x: 0, y: 0 };

        this.tools = {
            pan: 'pan',
            text: 'text'
        };
        
        // Select-Tool Eigenschaften
        this.selectedElements = new Set();
        this.isSelecting = false;
        this.selectionStart = { x: 0, y: 0 };
        this.selectionEnd = { x: 0, y: 0 };

        // Event Listener für Tastatureingaben
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
    }

    /**
     * Initialisiert das Canvas und richtet alle Event-Listener ein
     * Wird nach der Konstruktion aufgerufen
     */
    initialize() {
        this.initializeCanvas();         // Canvas-Kontext einrichten
        this.setupEventListeners();      // Event-Listener hinzufügen
        this.setupGUI();                 // GUI-Elemente einrichten
        this.setupTextModal();           // Text-Eingabe vorbereiten
        
        // Startposition zentrieren
        this.offset = {
            x: window.innerWidth / 2,                                        // Setzt X-Offset auf Bildschirmmitte
            y: window.innerHeight / 2                                        // Setzt Y-Offset auf Bildschirmmitte
        };
        this.draw();                                                        // Zeichnet initiales Canvas

    }

    initializeCanvas() {
        this.context = this.canvas.getContext('2d');                        // Holt 2D Rendering-Kontext
        this.updateCanvasSize();                                           // Aktualisiert Canvas-Dimensionen
        
        const dpr = window.devicePixelRatio || 1;                          // Ermittelt Display-Pixeldichte
        this.canvas.style.width = `${window.innerWidth}px`;                // Setzt CSS-Breite auf Fensterbreite
        this.canvas.style.height = `${window.innerHeight}px`;              // Setzt CSS-Höhe auf Fensterhöhe
        this.canvas.width = window.innerWidth * dpr;                       // Setzt tatsächliche Canvas-Breite
        this.canvas.height = window.innerHeight * dpr;                     // Setzt tatsächliche Canvas-Höhe
        this.context.scale(dpr, dpr);                                      // Skaliert Kontext für Retina-Display

        window.addEventListener('resize', () => {                          // Fügt Resize-Event-Listener hinzu
            this.updateCanvasSize();                                       // Aktualisiert Größe bei Fensteränderung
            this.draw();                                                   // Zeichnet Canvas neu
        });
    }

    setupEventListeners() {
        this.canvas.addEventListener('wheel', this.handleWheel.bind(this), { passive: true });      // Zoom-Handler
        this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));                 // Start Interaktion
        this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));                // Bewegung verfolgen
        this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));                    // Ende Interaktion
    }

    /**
     * Behandelt das Mausrad-Event für Zoom-Funktionalität
     * Implementiert ein natürliches Zoom-Verhalten zur Mausposition
     * 
     * Funktionsweise:
     * 1. Berechnet Zoom-Faktor aus Scroll-Delta
     * 2. Prüft Grid-Sichtbarkeit und Zoom-Grenzen
     * 3. Berechnet neue Position relativ zur Maus
     * 4. Aktualisiert Scale und Offset
     * 
     * @param {WheelEvent} event - Das Mausrad-Event
     */
    handleWheel(event) {
        event.preventDefault();                                          // Verhindert Standard-Scroll-Verhalten

        // Hole aktuelle Mausposition
        const mouseX = event.clientX;                                   // X-Koordinate der Maus
        const mouseY = event.clientY;                                   // Y-Koordinate der Maus
        
        // Berechne Zoom-Faktor basierend auf Scrollrichtung
        const wheel = event.deltaY < 0 ? 1 : -1;                       // Bestimmt Zoom-Richtung (rein/raus)
        const zoom = Math.exp(wheel * this.zoomIntensity * Math.abs(event.deltaY));  // Berechnet Zoom-Faktor

        const newScale = this.scale * zoom;                            // Berechnet neue Skalierung
        
        // Prüfe Grid-Sichtbarkeit und Zoom-Grenzen
        const newGridPixelSize = this.gridSize * newScale;             // Berechnet neue Gittergröße in Pixeln
        if (newGridPixelSize < this.minGridSize) return;               // Prüft minimale Gittergröße
        if (newScale < this.minScale || newScale > this.maxScale) return;  // Prüft Zoom-Grenzen

        // Berechne neue Position relativ zur Maus
        const viewportX = mouseX - this.offset.x;                      // Berechnet relative X-Position
        const viewportY = mouseY - this.offset.y;                      // Berechnet relative Y-Position

        // Zoome zur Mausposition
        this.offset.x = mouseX - viewportX * zoom;                     // Aktualisiert X-Offset für Zoom
        this.offset.y = mouseY - viewportY * zoom;                     // Aktualisiert Y-Offset für Zoom
        this.scale = newScale;                                         // Setzt neue Skalierung

        this.draw();                                                   // Zeichnet Canvas neu
    }

    /**
     * Startet die Bewegung des Canvas
     * Initialisiert Drag-Verhalten oder Text-Eingabe
     * @param {MouseEvent} event - Das Maus-Event
     */
    handleMouseDown(event) {
        const mouseX = (event.clientX - this.offset.x) / this.scale;
        const mouseY = (event.clientY - this.offset.y) / this.scale;
        
        // Prüfe zuerst, ob ein Text angeklickt wurde, unabhängig vom Tool
        const clickedText = this.findTextAtPosition(mouseX, mouseY);
        
        // Wenn kein Text getroffen wurde, deselektiere den aktuell ausgewählten Text
        if (!clickedText && this.selectedText) {
            // Animation für Deselektierung
            this.animateTextDeselection(this.selectedText);
            this.selectedText = null;
            this.isDraggingText = false;
            this.canvas.style.cursor = this.currentTool === 'pan' ? 'grab' : 'text';
            this.draw();
        }
        
        if (clickedText) {
            // Text wurde angeklickt - aktiviere Drag-Modus
            this.selectedText = clickedText;
            this.isDraggingText = true;
            this.dragStartPos = { x: mouseX, y: mouseY };
            this.textOffset = {
                x: mouseX - clickedText.x,
                y: mouseY - clickedText.y
            };
            this.lastTextPos = { x: mouseX, y: mouseY };
            this.canvas.style.cursor = 'move';
            
            // Starte Auswahl-Animation
            this.animateTextSelection(clickedText);
            
            // Verhindere weitere Event-Verarbeitung
            event.preventDefault();
            return;
        }
        
        // Wenn kein Text getroffen wurde, normale Tool-Verarbeitung
        if (this.currentTool === 'pan') {
            this.isDragging = true;
            this.isMoving = false;
            this.velocity = { x: 0, y: 0 };
            this.lastPosition = {
                x: event.clientX,
                y: event.clientY,
                time: Date.now()
            };
            this.canvas.style.cursor = 'grabbing';
            
            if (this.animationFrame) {
                cancelAnimationFrame(this.animationFrame);
                this.animationFrame = null;
            }
        }
    }

    /**
     * Behandelt die Bewegung während des Dragging
     * Implementiert physikbasierte Bewegung mit Grenzen und Trägheit
     * 
     * Physik-Parameter:
     * - Maximale Geschwindigkeit: 30 Pixel pro Frame
     * - Reibung: 0.92 (8% Geschwindigkeitsverlust pro Frame)
     * - Elastizität: 0.15 (15% Nachgeben an Grenzen)
     * 
     * Ablauf:
     * 1. Berechnet Bewegungsvektor und Geschwindigkeit
     * 2. Begrenzt Geschwindigkeit für flüssige Bewegung
     * 3. Prüft und korrigiert Grenzen mit Elastizität
     * 4. Aktualisiert Position und Geschwindigkeit
     * 
     * @param {MouseEvent} event - Das Maus-Event
     */
    handleMouseMove(event) {
        if (this.currentTool === 'pan' && this.isDragging) {
            const currentTime = Date.now();
            const deltaTime = currentTime - this.lastPosition.time;
            
            if (deltaTime > 0) {
                const dx = event.clientX - this.lastPosition.x;
                const dy = event.clientY - this.lastPosition.y;
                
                // Flüssigere Geschwindigkeitsberechnung
                this.velocity = {
                    x: dx / deltaTime * 16.67,
                    y: dy / deltaTime * 16.67
                };

                // Direkte Positionsaktualisierung ohne Grenzen
                this.offset.x += dx;
                this.offset.y += dy;
                
                this.lastPosition = {
                    x: event.clientX,
                    y: event.clientY,
                    time: currentTime
                };
                
                this.isMoving = true;
                this.draw();
            }
        }
        
        // Text-Bewegung vereinfachen - direktere Kontrolle
        if (this.isDraggingText && this.selectedText) {
            const mouseX = (event.clientX - this.offset.x) / this.scale;
            const mouseY = (event.clientY - this.offset.y) / this.scale;
            
            // Direkte Positionierung ohne Trägheit
            this.selectedText.x = mouseX - this.textOffset.x;
            this.selectedText.y = mouseY - this.textOffset.y;
            
            this.draw();
        }
        
        // Font-Größen-Änderung
        if (this.isDraggingFont && this.selectedText) {
            const deltaY = this.fontDragStart.y - event.clientY;
            const newSize = this.currentFontSize + deltaY;
            
            // Begrenzen Sie die Schriftgröße auf sinnvolle Werte
            this.selectedText.fontSize = Math.max(32, Math.min(512, newSize));
            this.draw();
        }
    }
    handleMouseUp() {
        if (this.isDragging) {
            this.isDragging = false;
            if (this.currentTool === 'pan') {
                this.canvas.style.cursor = 'grab';
                
                if (this.isMoving) {
                    this.startDeceleration();
                }
            }
        }
        
        // Text-Bewegung direkt beenden ohne Trägheit
        if (this.isDraggingText) {
            this.isDraggingText = false;
            this.canvas.style.cursor = 'text';
        }
        
        if (this.isDraggingFont) {
            this.isDraggingFont = false;
            this.canvas.style.cursor = 'text';
        }
    }

    /**
     * Startet die Ausgleit-Animation nach dem Loslassen
     * Implementiert physikbasiertes Ausgleiten mit Reibung
     * 
     * Animations-Details:
     * 1. Wendet Reibung auf aktuelle Geschwindigkeit an
     * 2. Berechnet neue Position unter Berücksichtigung der Grenzen
     * 3. Prüft harte Grenzen und stoppt bei Kollision
     * 4. Animiert weiter bis Geschwindigkeit unter Schwellwert
     * 
     * Performance:
     * - Nutzt RequestAnimationFrame für flüssige Animation
     * - Optimierte Berechnungen pro Frame
     * - Automatischer Stopp bei geringer Bewegung
     */
    startDeceleration() {                                                         // Startet die Ausgleit-Animation
        let lastTimestamp = null;                                                // Initialisiert Zeitstempel für Animation
        
        const animate = (timestamp) => {                                         // Definiert Animations-Callback-Funktion
            if (!lastTimestamp) lastTimestamp = timestamp;                       // Setzt initialen Zeitstempel beim ersten Aufruf
            
            // Sanftere Geschwindigkeitsreduzierung
            this.velocity.x *= Math.pow(this.dragLimits.friction, timestamp - lastTimestamp / 16.67);
            this.velocity.y *= Math.pow(this.dragLimits.friction, timestamp - lastTimestamp / 16.67);
            
            // Aktualisiere Position ohne Grenzen
            this.offset.x += this.velocity.x;
            this.offset.y += this.velocity.y;
            
            this.draw();                                                        // Zeichnet Canvas neu
            
            // Längeres Ausgleiten für flüssigere Bewegung
            if (Math.abs(this.velocity.x) > 0.01 || Math.abs(this.velocity.y) > 0.01) {
                this.animationFrame = requestAnimationFrame(animate);
            }
        };
        
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }
        this.animationFrame = requestAnimationFrame(animate);
    }

    /**
     * Zeichnet das Grid und alle Textelemente
     * Optimiert das Rendering durch Begrenzung auf sichtbaren Bereich
     * 
     * Rendering-Prozess:
     * 1. Löscht vorheriges Rendering
     * 2. Wendet Transformation (Offset & Scale) an
     * 3. Zeichnet Grid-Punkte im sichtbaren Bereich
     * 4. Rendert alle Textelemente
     * 
     * Optimierungen:
     * - Berechnung des sichtbaren Bereichs mit Puffer
     * - Batch-Rendering für Grid-Punkte
     * - Skalierungsabhängige Punkt- und Textgrößen
     */
    draw() {
        const dpr = window.devicePixelRatio || 1;                                          // Ermittelt Device Pixel Ratio für hochauflösende Displays
        this.context.clearRect(0, 0, this.canvas.width * dpr, this.canvas.height * dpr);   // Löscht den gesamten Canvas-Inhalt
        
        this.context.save();                                                               // Speichert den aktuellen Canvas-Zustand
        this.context.translate(this.offset.x, this.offset.y);                              // Verschiebt den Ursprung gemäß Offset
        this.context.scale(this.scale, this.scale);                                        // Wendet die Zoom-Skalierung an

        this.drawGrid();                                                                   // Zeichnet das Punktraster
        
        // Zeichne alle Textelemente
        this.textElements.forEach(element => {                                             // Iteriert über alle Textelemente
            this.drawVectorText(element);                                                  // Zeichnet jedes Textelement einzeln
        });
        
        this.context.restore();                                                            // Stellt den ursprünglichen Canvas-Zustand wieder her
    }

    updateCanvasSize() {
        this.canvas.width = window.innerWidth;                                             // Setzt Canvas-Breite auf Fensterbreite
        this.canvas.height = window.innerHeight;                                           // Setzt Canvas-Höhe auf Fensterhöhe
    }

    setupGUI() {
        const tools = ['pan', 'text'];                                                     // Definiert verfügbare Werkzeuge
        tools.forEach(tool => {                                                            // Iteriert über alle Werkzeuge
            document.getElementById(`${tool}Tool`).addEventListener('click', () => {        // Fügt Klick-Event-Listener hinzu
                this.setTool(tool);                                                        // Aktiviert das gewählte Werkzeug
                
                // Zeige Text-Modal nur wenn Text-Tool geklickt wird
                if (tool === 'text') {
                    const textModal = document.getElementById('textModal');
                    textModal.style.display = 'flex';
                    document.getElementById('textInput').focus();
                }
            });
        });
    }
    setTool(tool) {
        this.currentTool = tool;                                                          // Setzt das aktuelle Werkzeug
        
        document.querySelectorAll('.tool-button').forEach(button => {                     // Entfernt 'active' Klasse von allen Werkzeug-Buttons
            button.classList.remove('active');
        });
        document.getElementById(`${tool}Tool`).classList.add('active');                   // Fügt 'active' Klasse zum ausgewählten Werkzeug hinzu
        
        if (tool === 'pan') {
            this.canvas.style.cursor = 'grab';                                            // Setzt Hand-Cursor für Pan-Modus
            // Füge Bewegungs-Cursor zum gesamten Canvas hinzu
            this.canvas.addEventListener('mousedown', () => this.canvas.style.cursor = 'grabbing');    // Ändert Cursor beim Drücken
            this.canvas.addEventListener('mouseup', () => this.canvas.style.cursor = 'grab');          // Setzt Cursor beim Loslassen zurück
            this.canvas.addEventListener('mouseleave', () => this.canvas.style.cursor = 'grab');       // Setzt Cursor beim Verlassen zurück
        } else {
            this.canvas.style.cursor = 'text';                                            // Setzt Text-Cursor für Text-Modus
            // Entferne die Cursor-Events wenn nicht im Pan-Modus
            this.canvas.removeEventListener('mousedown', () => this.canvas.style.cursor = 'grabbing'); // Entfernt Mausdrck-Event
            this.canvas.removeEventListener('mouseup', () => this.canvas.style.cursor = 'grab');       // Entfernt Mausloslassen-Event
            this.canvas.removeEventListener('mouseleave', () => this.canvas.style.cursor = 'grab');    // Entfernt Mausverlassen-Event
        }
    }

    setupTextModal() {
        const textModal = document.getElementById('textModal');
        const textInput = document.getElementById('textInput');
        const confirmBtn = document.getElementById('confirmText');
        const cancelBtn = document.getElementById('cancelText');
        
        const fontSelect = document.getElementById('fontSelect');
        
        // Text-Tool Click Handler
        document.getElementById('textTool').addEventListener('click', () => {
            textModal.style.display = 'flex';
            textInput.focus();
        });
        
        // Bestätigen Button
        confirmBtn.addEventListener('click', () => {
            const text = textInput.value.trim();
            if (text) {
                const centerX = (window.innerWidth / 2 - this.offset.x) / this.scale;
                const centerY = (window.innerHeight / 2 - this.offset.y) / this.scale;
                
                this.textElements.push({
                    text: text,
                    x: centerX,
                    y: centerY,
                    fontFamily: fontSelect.value // Speichere die ausgewählte Schriftart
                });
                this.draw();
            }
            textInput.value = '';
            textModal.style.display = 'none';
        });
        
        // Abbrechen Button
        cancelBtn.addEventListener('click', () => {
            textInput.value = '';
            textModal.style.display = 'none';
        });
        
        // Enter-Taste als Bestätigung
        textInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                confirmBtn.click();
            } else if (e.key === 'Escape') {
                cancelBtn.click();
            }
        });
    }

    /**
     * Verwaltet die Text-Eingabe und -Platzierung
     * Konvertiert Bildschirm- in Canvas-Koordinaten
     * 
     * Funktionsweise:
     * 1. Zeigt Eingabefeld an Mausposition
     * 2. Konvertiert Position unter Berücksichtigung von Zoom/Offset
     * 3. Validiert Position innerhalb der Grenzen
     * 4. Fügt Text zum Canvas hinzu
     * 
     * @param {string} text - Der einzufügende Text
     * @param {number} x - X-Koordinate auf dem Bildschirm
     * @param {number} y - Y-Koordinate auf dem Bildschirm
     */
    addTextElement(text, x, y) {
        if (!text.trim()) return;                                                         // Prüft ob Text leer ist und bricht ggf. ab
        
        // Konvertiere Bildschirmkoordinaten in virtuelle Koordinaten
        const scaledX = (x - this.offset.x) / this.scale;                                // Berechnet skalierte X-Position im virtuellen Raum
        const scaledY = (y - this.offset.y) / this.scale;                                // Berechnet skalierte Y-Position im virtuellen Raum
        
        // Prüfe ob innerhalb der virtuellen Grenzen
        if (scaledX >= this.boundaries.left &&                                           // Prüft ob X-Position links im erlaubten Bereich
            scaledX <= this.boundaries.right &&                                          // Prüft ob X-Position rechts im erlaubten Bereich
            scaledY >= this.boundaries.top &&                                            // Prüft ob Y-Position oben im erlaubten Bereich
            scaledY <= this.boundaries.bottom) {                                         // Prüft ob Y-Position unten im erlaubten Bereich
            
            this.textElements.push({                                                     // Fügt neues Textelement zum Array hinzu
                text: text.trim(),                                                       // Speichert bereinigten Text
                x: scaledX,                                                              // Speichert X-Position
                y: scaledY                                                               // Speichert Y-Position
            });
            
            this.draw();                                                                 // Aktualisiert die Canvas-Anzeige
        }
    }
    drawGrid() {                                                                         // Zeichnet das Punktraster
        if (!this.isGridVisible) return;                                                // Beendet Funktion wenn Raster nicht sichtbar
        
        const context = this.context;                                                   // Holt den Canvas-Zeichenkontext
        const dotRadius = 0.8 / this.scale;                                            // Berechnet skalierten Punktradius
        
        context.fillStyle = 'var(--dot-color)';                                        // Setzt Punktfarbe aus CSS-Variable

        // Berechne sichtbaren Bereich basierend auf aktuellem Viewport
        const viewportLeft = -this.offset.x / this.scale;
        const viewportTop = -this.offset.y / this.scale;
        const viewportRight = (this.canvas.width - this.offset.x) / this.scale;
        const viewportBottom = (this.canvas.height - this.offset.y) / this.scale;

        // Füge Puffer hinzu fr flüssiges Scrollen
        const buffer = this.gridSize * 2;
        const startX = Math.floor((viewportLeft - buffer) / this.gridSize) * this.gridSize;
        const startY = Math.floor((viewportTop - buffer) / this.gridSize) * this.gridSize;
        const endX = Math.ceil((viewportRight + buffer) / this.gridSize) * this.gridSize;
        const endY = Math.ceil((viewportBottom + buffer) / this.gridSize) * this.gridSize;

        context.beginPath();
        for (let x = startX; x <= endX; x += this.gridSize) {
            for (let y = startY; y <= endY; y += this.gridSize) {
                context.moveTo(x, y);
                context.arc(x, y, dotRadius, 0, Math.PI * 2);
            }
        }
        context.fill();
    }
    drawVectorText(element) {
        const context = this.context;
        const fontSize = element.fontSize || this.initialFontSize;
        const scale = element.scale || 1;
        const opacity = element.opacity !== undefined ? element.opacity : 1;
        
        context.save();
        
        // Skalierung für Animation
        const centerX = element.x + context.measureText(element.text).width / 2;
        const centerY = element.y;
        context.translate(centerX, centerY);
        context.scale(scale, scale);
        context.translate(-centerX, -centerY);
        
        // Verwende die gespeicherte Schriftart oder Standard
        const fontFamily = element.fontFamily || 'IranSans';
        context.font = `${fontSize / this.scale}px '${fontFamily}', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
        
        // Verbesserte Hervorhebung für ausgewählten Text
        if (element === this.selectedText) {
            const metrics = context.measureText(element.text);
            const padding = 8 / this.scale;
            const radius = 4 / this.scale;
            
            // Schatten für 3D-Effekt
            context.shadowColor = 'rgba(0, 0, 0, 0.1)';
            context.shadowBlur = 5 / this.scale;
            context.shadowOffsetY = 2 / this.scale;
            
            // Hintergrund mit abgerundeten Ecken
            context.fillStyle = 'rgba(0, 122, 255, 0.1)';
            this.roundRect(
                element.x - padding,
                element.y - metrics.actualBoundingBoxAscent - padding,
                metrics.width + padding * 2,
                metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent + padding * 2,
                radius
            );
            context.fill();
            
            // Rahmen
            context.shadowColor = 'transparent';
            context.strokeStyle = 'rgba(0, 122, 255, 0.8)';
            context.lineWidth = 1.5 / this.scale;
            context.stroke();
            
            // Ziehpunkte an den Ecken
            this.drawDragHandles(element, metrics, padding);
            
            // Ausgewählter Text leicht verblasst (aktiver Zustand)
            context.fillStyle = `rgba(0, 0, 0, ${opacity * 0.6})`;
        } else {
            // Normaler Text mit Opacity
            context.fillStyle = `rgba(0, 0, 0, ${opacity})`;
        }
        
        // Text zeichnen
        context.fillText(element.text, element.x, element.y);
        
        context.restore();
    }

    preventBrowserZoom() {                                                              // Verhindert Browser-Zoom-Gesten
        // Verhindere Pinch-Zoom
        document.addEventListener('touchmove', (e) => {                                 // Überwacht Touch-Bewegungen
            if (e.touches.length > 1) {                                                // Prüft auf Multi-Touch
                e.preventDefault();                                                     // Verhindert Standard-Verhalten
            }
        }, { passive: false });                                                        // Erlaubt preventDefault()

        // Verhindere Doppeltipp-Zoom
        document.addEventListener('touchend', (e) => {                                 // Überwacht Touch-Ende
            const now = Date.now();                                                    // Speichert aktuellen Zeitstempel
            if (now - this.lastTap < 300) {                                           // Prüft auf Doppeltipp
                e.preventDefault();                                                     // Verhindert Standard-Verhalten
            }
            this.lastTap = now;                                                        // Aktualisiert letzten Tipp-Zeitstempel
        }, { passive: false });                                                        // Erlaubt preventDefault()

        // Verhindere Strg+Wheel Zoom
        document.addEventListener('wheel', (e) => {                                    // Überwacht Mausrad-Events
            if (e.ctrlKey) {                                                          // Prüft ob Strg gedrückt
                e.preventDefault();                                                     // Verhindert Standard-Verhalten
            }
        }, { passive: false });                                                        // Erlaubt preventDefault()

        // Verhindere Strg+Plus/Minus Zoom
        document.addEventListener('keydown', (e) => {                                  // Überwacht Tastatureingaben
            if (e.ctrlKey && (e.key === '+' || e.key === '-' || e.key === '=')) {    // Prüft auf Strg+Plus/Minus
                e.preventDefault();                                                     // Verhindert Standard-Verhalten
            }
        });
    }

    setupGridToggle() {                                                                 // Richtet Grid-Toggle-Funktionalität ein
        const toggleButton = document.getElementById('toggleGridButton');               // Holt Grid-Toggle-Button aus DOM
        const icon = toggleButton.querySelector('i');                                   // Findet Icon-Element im Button
        
        toggleButton.addEventListener('click', () => {                                  // Fügt Click-Event-Listener hinzu
            this.isGridVisible = !this.isGridVisible;                                  // Invertiert Grid-Sichtbarkeit
            toggleButton.classList.toggle('active');                                    // Schaltet aktiven Zustand des Buttons um
            
            // Wechsle das Icon
            icon.classList.toggle('fa-eye');                                           // Schaltet Auge-Icon um
            icon.classList.toggle('fa-eye-slash');                                     // Schaltet durchgestrichenes Auge-Icon um
            
            // Toggle Sichtbarkeit der Mittellinie
            document.querySelector('.center-line').style.opacity =                      // Ändert Sichtbarkeit der Mittellinie
                this.isGridVisible ? '1' : '0';                                        // Basierend auf Grid-Sichtbarkeit
            
            this.draw();                                                               // Zeichnet Canvas neu
        });
    }

    findTextAtPosition(x, y) {
        // Temporär Context speichern für Textmessungen
        const context = this.context;
        
        // Durchsuche alle Textelemente von oben nach unten
        return this.textElements.find(element => {
            // Setze Font für korrekte Messungen
            const fontSize = element.fontSize || this.initialFontSize;
            context.font = `${fontSize / this.scale}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
            
            // Berechne Textmaße
            const metrics = context.measureText(element.text);
            const padding = 10; // Größerer Klickbereich für bessere Bedienbarkeit
            
            // Berechne Bounding Box
            const top = element.y - metrics.actualBoundingBoxAscent - padding;
            const bottom = element.y + metrics.actualBoundingBoxDescent + padding;
            const left = element.x - padding;
            const right = element.x + metrics.width + padding;
            
            // Prüfe ob Mausposition innerhalb der Bounding Box liegt
            return x >= left && 
                   x <= right && 
                   y >= top && 
                   y <= bottom;
        });
    }

    animateTextSelection(textElement) {
        const originalScale = textElement.scale || 1;
        const animationDuration = 200;
        const startTime = Date.now();
        
        // Setze Opacity-Animation
        textElement.opacity = 0.6; // Startopazität für ausgewählten Text
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(1, elapsed / animationDuration);
            
            // Sanfterer Bounce-Effekt mit Easing
            const bounce = Math.sin(progress * Math.PI) * Math.sin(progress * Math.PI * 2);
            const scale = 1 + bounce * 0.03;
            textElement.scale = originalScale * scale;
            
            this.draw();
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                textElement.scale = originalScale;
                this.draw();
            }
        };
        
        animate();
    }

    drawDragHandles(element, metrics, padding) {
        const handleSize = 6 / this.scale;
        const positions = [
            // Ecken
            { x: element.x - padding, y: element.y - metrics.actualBoundingBoxAscent - padding },
            { x: element.x + metrics.width + padding, y: element.y - metrics.actualBoundingBoxAscent - padding },
            { x: element.x - padding, y: element.y + metrics.actualBoundingBoxDescent + padding },
            { x: element.x + metrics.width + padding, y: element.y + metrics.actualBoundingBoxDescent + padding }
        ];
        
        this.context.fillStyle = '#fff';
        this.context.strokeStyle = 'rgba(0, 122, 255, 0.8)';
        this.context.lineWidth = 1 / this.scale;
        
        positions.forEach(pos => {
            this.context.beginPath();
            this.context.arc(pos.x, pos.y, handleSize, 0, Math.PI * 2);
            this.context.fill();
            this.context.stroke();
        });
    }

    roundRect(x, y, width, height, radius) {
        this.context.beginPath();
        this.context.moveTo(x + radius, y);
        this.context.lineTo(x + width - radius, y);
        this.context.quadraticCurveTo(x + width, y, x + width, y + radius);
        this.context.lineTo(x + width, y + height - radius);
        this.context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        this.context.lineTo(x + radius, y + height);
        this.context.quadraticCurveTo(x, y + height, x, y + height - radius);
        this.context.lineTo(x, y + radius);
        this.context.quadraticCurveTo(x, y, x + radius, y);
        this.context.closePath();
    }

    showTextInput(x, y) {
        const textModal = document.getElementById('textModal');
        const textInput = document.getElementById('textInput');
        
        // Position für neue Text-Eingabe speichern
        this.pendingTextPosition = {
            x: (x - this.offset.x) / this.scale,
            y: (y - this.offset.y) / this.scale
        };
        
        // Modal anzeigen und Input fokussieren
        textModal.style.display = 'flex';
        textInput.value = '';
        textInput.focus();
    }

    // Neue Methode für die Deselektions-Animation
    animateTextDeselection(textElement) {
        const startScale = textElement.scale || 1;
        const animationDuration = 150; // etwas schneller als die Selektions-Animation
        const startTime = Date.now();
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(1, elapsed / animationDuration);
            
            // Sanfter Übergang zurück zur normalen Größe
            const scale = startScale + (1 - startScale) * progress;
            textElement.scale = scale;
            
            // Opacity zurücksetzen
            textElement.opacity = 1;
            
            this.draw();
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                textElement.scale = 1;
                this.draw();
            }
        };
        
        animate();
    }

    // Neue Methode für Tastatur-Events
    handleKeyDown(event) {
        // Prüfe ob ein Text ausgewählt ist und Delete/Entf gedrückt wurde
        if (this.selectedText && (event.key === 'Delete' || event.key === 'Backspace')) {
            this.deleteSelectedText();
            event.preventDefault();
        }
    }

    // Neue Methode für das Löschen von Text mit Animation
    deleteSelectedText() {
        if (!this.selectedText) return;
        
        const textToDelete = this.selectedText;
        const startTime = Date.now();
        const animationDuration = 200;
        
        // Animation starten
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(1, elapsed / animationDuration);
            
            // Scale und Opacity Animation
            textToDelete.scale = 1 - (progress * 0.2); // Leicht verkleinern
            textToDelete.opacity = 1 - progress; // Ausblenden
            
            this.draw();
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                // Text aus Array entfernen
                this.textElements = this.textElements.filter(element => element !== textToDelete);
                this.selectedText = null;
                this.draw();
            }
        };
        
        animate();
    }
}

document.addEventListener('DOMContentLoaded', () => {                                   // Wartet auf DOM-Ladung
    new InteraktivesCanvas();                                                          // Erstellt neue Canvas-Instanz
}); 