# Foucault 3D - Simulatore del Pendolo di Foucault & Forze Terrestri

[English Version Below](#english-version)

Un simulatore 3D interattivo e ad alta fedeltà fisica del celebre esperimento del **Pendolo di Foucault**, progettato per visualizzare la rotazione terrestre e le forze fisiche agenti in tempo reale in tre diverse latitudini: il **Polo Nord (90° N)**, una **Latitudine intermedia (45° N)** e l'**Equatore (0° N)**.

Il progetto è visivamente ottimizzato con un'estetica cyberpunk-scientifica scura, arricchita da pannelli di controllo in stile *glassmorphism* e vettori tridimensionali luminosi per le forze fisiche.

---

## 👥 Autore & Crediti
Questo progetto è stato ideato e realizzato da:
* **Roberto** - *Astrofili Ponte di Piave*
* 🌐 **Sito Web**: [www.astrofilipontedipiave.it](http://www.astrofilipontedipiave.it)

---

## 🌟 Caratteristiche Principali
* **Terra Holografica 3D**: Rappresentazione stilizzata e semitrasparente del globo terrestre con griglie di coordinate attive che ruotano per mostrare chiaramente il moto del pianeta al di sotto dei pendoli.
* **Diagramma delle Forze Tridimensionali**:
  * 🔴 **Forza di Gravità ($\vec{F}_g$)**: Vettore rosso orientato verso il centro di massa terrestre.
  * 🔵 **Tensione del Cavo ($\vec{T}$)**: Vettore azzurro applicato lungo il filo del pendolo.
  * 🟢 **Forza di Coriolis ($\vec{F}_c$)**: Vettore verde brillante ortogonale alla velocità istantanea, responsabile della precessione dell'oscillazione.
* **Traiettorie al Suolo (Curve a Rosetta)**: Tracciamento continuo del percorso del pendolo relativo al terreno, mostrando visivamente il disegno a rosetta generato dalla precessione.
* **Camera Cinematica Dinamica**: Possibilità di agganciare la telecamera alle singole stazioni. In modalità "Focus", la telecamera ruota in sincrono con la Terra per osservare il moto dal punto di vista dell'osservatore solidale al suolo.
* **Pannello di Controllo Interattivo**:
  * Regolazione della velocità di rotazione terrestre (fino a 10.000x per accelerare l'effetto della precessione).
  * Regolazione della frequenza del pendolo.
  * Attivazione/disattivazione visiva di singoli vettori e tracce.

---

## 🔬 Equazioni Fisiche Utilizzate
Il moto del pendolo nel piano orizzontale locale rotante a latitudine $\varphi$ è governato dal sistema di equazioni differenziali del secondo ordine:

$$\ddot{x} = -\omega_0^2 x + 2\Omega\dot{y}\sin\varphi$$
$$\ddot{y} = -\omega_0^2 y - 2\Omega\dot{x}\sin\varphi$$

Dove:
* $\omega_0$ è la frequenza angolare propria dell'oscillazione.
* $\Omega$ è la velocità angolare terrestre (amplificata dal fattore di velocità selezionato).
* $\varphi$ è la latitudine del pendolo.

---

## 🚀 Esecuzione Immediata (Senza Server)
Grazie alla recente ottimizzazione delle dipendenze, il progetto **non richiede un server locale** o build complesse:
1. Scarica o clona il repository.
2. Fai doppio clic sul file `index.html`.
3. Il simulatore si avvierà all'istante nel tuo browser web!

---

<a name="english-version"></a>

# Foucault 3D - Foucault Pendulum & Earth Forces Simulator

An interactive, physics-accurate 3D simulator of the famous **Foucault Pendulum** experiment, designed to visualize Earth's rotation and the acting physical forces in real-time at three distinct latitudes: the **North Pole (90° N)**, **Mid-Latitude (45° N)**, and the **Equator (0° N)**.

The project features a sleek, dark scientific-cyberpunk aesthetic, complete with *glassmorphic* control panels and glowing 3D vectors representing physical forces.

---

## 👥 Author & Credits
This project was conceptualized and created by:
* **Roberto** - *Astrofili Ponte di Piave*
* 🌐 **Website**: [www.astrofilipontedipiave.it](http://www.astrofilipontedipiave.it)

---

## 🌟 Key Features
* **Holographic 3D Earth**: A semi-transparent stylized rendering of the Earth with active coordinate grids rotating to visually demonstrate the planet's movement underneath the pendulums.
* **3D Force Vector Diagrams**:
  * 🔴 **Gravity Force ($\vec{F}_g$)**: Red vector pointing towards the Earth's center of mass.
  * 🔵 **Cable Tension ($\vec{T}$)**: Cyan vector aligned along the pendulum cable.
  * 🟢 **Coriolis Force ($\vec{F}_c$)**: Bright green vector orthogonal to the instantaneous velocity, driving the precession of the swing plane.
* **Ground Trajectories (Rosette Curves)**: Continuous tracking of the bob's path relative to the ground, dynamically drawing the beautiful rosette patterns.
* **Cinematic Camera System**: Lock the camera onto specific pendulum research stands. In "Focus" mode, the camera rotates in sync with the Earth, allowing you to observe the physics from the perspective of an observer standing on the ground.
* **Interactive Control Dashboard**:
  * Earth rotation speed slider (up to 10,000x faster to observe precession in seconds).
  * Pendulum frequency adjustments.
  * Toggle vector arrows and trajectory paths.

---

## 🔬 Math & Physics Engine
The pendulum's motion in the local horizontal plane at latitude $\varphi$ is computed using the following system of coupled differential equations:

$$\ddot{x} = -\omega_0^2 x + 2\Omega\dot{y}\sin\varphi$$
$$\ddot{y} = -\omega_0^2 y - 2\Omega\dot{x}\sin\varphi$$

Where:
* $\omega_0$ is the pendulum's natural angular frequency.
* $\Omega$ is the Earth's angular velocity of rotation (scaled by the simulation speed multiplier).
* $\varphi$ is the latitude.

---

## 🚀 Instant Launch (No Server Needed)
Thanks to dependency optimization, the project **does not require a local server** or complex build configurations:
1. Download or clone this repository.
2. Double-click the `index.html` file.
3. The simulator will instantly run in your favorite web browser!
