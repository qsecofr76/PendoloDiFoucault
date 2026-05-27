// Simulation Configuration & State
const state = {
    paused: false,
    earthSpeedMultiplier: 2000,      // Scale factor to make Earth's rotation visible
    pendulumFreq: 4.0,              // Swing frequency
    showGravity: true,
    showTension: true,
    showCoriolis: true,
    showPath: true,
    activeFocus: 'globe',           // 'globe', 'pole', 'mid', 'equator'
    selectedLatitude: 90,           // Currently displayed info tab
};

// Physics constants (scaled for stable real-time integration)
const PHYSICS = {
    G_CONSTANT: 9.81,               // Local gravity acceleration m/s^2
    PENDULUM_LENGTH: 5.0,           // Cable length (visual/physics)
    BASE_EARTH_OMEGA: 7.292115e-5,  // Real Earth angular velocity rad/s (approx 1 rotation/day)
    SUBSTEPS: 10,                   // Physics steps per frame for high accuracy
};

// Global WebGL objects
let scene, camera, renderer, controls;
let earthGroup, earthMesh, gridHelper;
let stars;
let pendulums = [];
let clock;

// -------------------------------------------------------------
// PROCEDURAL HOLOGRAPHIC TEXTURE GENERATOR
// -------------------------------------------------------------
function createProceduralEarthTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    // Deep space-blue background
    ctx.fillStyle = '#05070f';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw cyber grids
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.05)';
    ctx.lineWidth = 1;
    const cols = 36;
    const rows = 18;
    
    // Meridians
    for (let i = 0; i < cols; i++) {
        const x = (i / cols) * canvas.width;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
    }
    // Parallels
    for (let i = 0; i < rows; i++) {
        const y = (i / rows) * canvas.height;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }

    // Procedural glowing world map (simplified cyberpunk landmasses)
    ctx.fillStyle = 'rgba(0, 240, 255, 0.25)';
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#00f0ff';

    // Simple geometric continent representations (100% compatible with older browsers)
    const drawLand = (x, y, w, h) => {
        ctx.beginPath();
        ctx.rect(x * canvas.width, y * canvas.height, w * canvas.width, h * canvas.height);
        ctx.fill();
    };

    // North America
    drawLand(0.12, 0.2, 0.22, 0.3);
    // South America
    drawLand(0.24, 0.5, 0.14, 0.4);
    // Greenland
    drawLand(0.32, 0.08, 0.08, 0.12);
    // Eurasia / Europe / Asia
    drawLand(0.42, 0.15, 0.42, 0.4);
    // Africa
    drawLand(0.46, 0.45, 0.15, 0.38);
    // Australia
    drawLand(0.78, 0.6, 0.12, 0.2);
    // Antarctica
    drawLand(0.1, 0.88, 0.8, 0.08);

    // Draw some glowing city light clusters (Cyber dots)
    ctx.fillStyle = '#ffffff';
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#ffffff';
    for (let i = 0; i < 200; i++) {
        const rx = Math.random();
        const ry = Math.random();
        // Place cities mostly on land area bounds
        if ((rx > 0.12 && rx < 0.34 && ry > 0.2 && ry < 0.8) || 
            (rx > 0.42 && rx < 0.85 && ry > 0.15 && ry < 0.8)) {
            ctx.beginPath();
            ctx.arc(rx * canvas.width, ry * canvas.height, 1.5 + Math.random() * 2, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    return new THREE.CanvasTexture(canvas);
}

// -------------------------------------------------------------
// INDIVIDUAL FOUCAULT PENDULUM CLASS
// -------------------------------------------------------------
class FoucaultPendulum {
    constructor(latitude, color, radiusOffset = 5.0) {
        this.latitude = latitude;
        this.latitudeRad = (latitude * Math.PI) / 180;
        this.color = color;
        this.radiusOffset = radiusOffset; // Placed directly on the Earth sphere surface
        
        // Physics Simulation Variables (Local Horizontal coordinate system: x = East, y = North)
        this.x = 0.6;          // Initial displacement East (meters)
        this.y = 0.0;          // Initial displacement North
        this.vx = 0.0;         // Initial velocity East
        this.vy = 0.0;         // Initial velocity North
        
        this.precessionAngle = 0; // Current angle of precession relative to the platform
        this.maxCoriolis = 0.0;   // Track max Coriolis force

        // Trajectory trail history
        this.maxTrailPoints = 3000;
        this.trailPoints = [];
        this.trailGeometry = new THREE.BufferGeometry();
        
        this.init3D();
    }

    init3D() {
        // Base container rotated and positioned on the Globe surface
        this.group = new THREE.Group();

        // Calculate Position on Globe (assuming sphere of radius 5.0, North Pole is top, Equator is side)
        const cosLat = Math.cos(this.latitudeRad);
        const sinLat = Math.sin(this.latitudeRad);
        
        // Three.js standard: Y is Up, Z is Forward, X is Right.
        const px = 0;
        const py = this.radiusOffset * sinLat;
        const pz = this.radiusOffset * cosLat;
        this.group.position.set(px, py, pz);

        // Rotate the local group so its "Up" (local Z) points radially outward.
        const localUp = new THREE.Vector3(px, py, pz).normalize();
        const defaultUp = new THREE.Vector3(0, 0, 1); // Local standard Up is Z
        
        const quaternion = new THREE.Quaternion();
        quaternion.setFromUnitVectors(defaultUp, localUp);
        this.group.quaternion.copy(quaternion);

        // Create local laboratory stand (aesthetic circular platform)
        const platGeo = new THREE.CylinderGeometry(0.7, 0.7, 0.04, 32);
        platGeo.rotateX(Math.PI / 2); // Align cylinder along local Z
        const platMat = new THREE.MeshStandardMaterial({
            color: 0x111625,
            roughness: 0.2,
            metalness: 0.8,
            transparent: true,
            opacity: 0.9,
            side: THREE.DoubleSide
        });
        const platform = new THREE.Mesh(platGeo, platMat);
        this.group.add(platform);

        // Circular boundary ring (neon border)
        const ringGeo = new THREE.RingGeometry(0.69, 0.71, 32);
        const ringMat = new THREE.MeshBasicMaterial({ color: this.color, side: THREE.DoubleSide });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.z = 0.02;
        this.group.add(ring);

        // Scaffold / Support Tripod (Aesthetic wireframe scaffold)
        const scaffoldGeo = new THREE.ConeGeometry(0.68, 1.2, 4, 1, true);
        scaffoldGeo.rotateX(Math.PI / 2); // Align cone along local Z
        scaffoldGeo.translate(0, 0, 0.6); // Base at 0, apex at Z = 1.2
        const scaffoldMat = new THREE.MeshBasicMaterial({
            color: 0x00f0ff,
            wireframe: true,
            transparent: true,
            opacity: 0.15
        });
        const scaffold = new THREE.Mesh(scaffoldGeo, scaffoldMat);
        this.group.add(scaffold);

        // Suspension Point (Pivot) at local (0, 0, 1.2)
        this.pivotPos = new THREE.Vector3(0, 0, 1.2);

        // Pendulum Bob (Sphere)
        const bobGeo = new THREE.SphereGeometry(0.04, 16, 16);
        const bobMat = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            emissive: this.color,
            emissiveIntensity: 0.5,
            roughness: 0.1,
            metalness: 0.9
        });
        this.bob = new THREE.Mesh(bobGeo, bobMat);
        this.group.add(this.bob);

        // Cable/Rod (glowing cylinder connecting pivot to bob)
        const cableGeo = new THREE.BufferGeometry();
        const cablePositions = new Float32Array([
            this.pivotPos.x, this.pivotPos.y, this.pivotPos.z,
            0, 0, 0 // Updated dynamically
        ]);
        cableGeo.setAttribute('position', new THREE.BufferAttribute(cablePositions, 3));
        const cableMat = new THREE.LineBasicMaterial({ color: 0x475569, transparent: true, opacity: 0.3 });
        this.cable = new THREE.Line(cableGeo, cableMat);
        this.group.add(this.cable);

        // Ground path line (Visualizes rosette patterns)
        const trailPositions = new Float32Array(this.maxTrailPoints * 3);
        const trailColors = new Float32Array(this.maxTrailPoints * 3);
        this.trailGeometry.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
        this.trailGeometry.setAttribute('color', new THREE.BufferAttribute(trailColors, 3));
        
        const trailMat = new THREE.LineBasicMaterial({
            vertexColors: true,
            transparent: true,
            opacity: 0.8,
            linewidth: 2
        });
        this.trailLine = new THREE.Line(this.trailGeometry, trailMat);
        this.group.add(this.trailLine);

        // -------------------------------------------------------------
        // FORCE ARROWS SETUP
        // -------------------------------------------------------------
        // 1. Gravity Vector (Red): points down towards Earth center (-z local)
        this.arrowGravity = new THREE.ArrowHelper(
            new THREE.Vector3(0, 0, -1),
            new THREE.Vector3(0, 0, 0),
            0.3,
            0xff3344,
            0.08,
            0.04
        );
        this.group.add(this.arrowGravity);

        // 2. Tension Vector (Cyan): points along cable from bob to pivot
        this.arrowTension = new THREE.ArrowHelper(
            new THREE.Vector3(0, 0, 1),
            new THREE.Vector3(0, 0, 0),
            0.3,
            0x00e5ff,
            0.08,
            0.04
        );
        this.group.add(this.arrowTension);

        // 3. Coriolis Vector (Green/Yellow): orthogonal to swing velocity
        this.arrowCoriolis = new THREE.ArrowHelper(
            new THREE.Vector3(1, 0, 0),
            new THREE.Vector3(0, 0, 0),
            0.3,
            0x39ff14,
            0.08,
            0.04
        );
        this.group.add(this.arrowCoriolis);
    }

    updatePhysics(dt, earthOmega) {
        // Integrate horizontal local pendulum physics using Verlet/Euler-Cromer
        const g = PHYSICS.G_CONSTANT;
        const L = 1.2; // Local pendulum visual length (pivot is at z=1.2)
        const omega_0_sq = Math.pow(state.pendulumFreq, 2);

        // Coriolis parameter: 2 * Omega * sin(latitude)
        const f = 2 * earthOmega * Math.sin(this.latitudeRad);

        // Substepping for numeric stability
        const substeps = PHYSICS.SUBSTEPS;
        const sdt = dt / substeps;

        for (let step = 0; step < substeps; step++) {
            // Equations of Foucault Pendulum:
            // ax = -omega_0^2 * x + 2 * Omega * vy * sin(lat)
            // ay = -omega_0^2 * y - 2 * Omega * vx * sin(lat)
            const ax = -omega_0_sq * this.x + f * this.vy;
            const ay = -omega_0_sq * this.y - f * this.vx;

            // Velocity update
            this.vx += ax * sdt;
            this.vy += ay * sdt;

            // Position update
            this.x += this.vx * sdt;
            this.y += this.vy * sdt;
        }

        // Keep bob constrained to sphere of radius L centered at Pivot (0, 0, L)
        const r_sq = this.x * this.x + this.y * this.y;
        let localZ = 0.05; // Ground clearance offset
        if (r_sq < L * L) {
            localZ = L - Math.sqrt(L * L - r_sq);
        }
        
        // Update Bob position in 3D scene
        this.bob.position.set(this.x, this.y, localZ);

        // Update Cable geometry
        const positions = this.cable.geometry.attributes.position.array;
        positions[3] = this.x;
        positions[4] = this.y;
        positions[5] = localZ;
        this.cable.geometry.attributes.position.needsUpdate = true;

        // Calculate Coriolis acceleration magnitude for UI display
        const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        const coriolisAcc = Math.abs(f * speed);
        if (coriolisAcc > this.maxCoriolis) {
            this.maxCoriolis = coriolisAcc;
        }

        // Calculate Precession Angle relative to the local ground
        if (r_sq < 0.04 && speed > 0.1) {
            const currentAngle = Math.atan2(this.vy, this.vx) * (180 / Math.PI);
            this.precessionAngle = (currentAngle + 360) % 360;
        }

        // -------------------------------------------------------------
        // UPDATE VISUAL FORCE VECTORS
        // -------------------------------------------------------------
        const bobPos = this.bob.position;

        // 1. Gravity Vector (Red): points down towards Earth center
        this.arrowGravity.position.copy(bobPos);
        const gravityDir = new THREE.Vector3(0, 0, -1);
        this.arrowGravity.setDirection(gravityDir);
        const gravLen = state.showGravity ? 0.35 : 0.0001;
        this.arrowGravity.setLength(gravLen, gravLen * 0.25, gravLen * 0.12);

        // 2. Tension Vector (Cyan): points along cable from bob to pivot
        this.arrowTension.position.copy(bobPos);
        const tensionDir = new THREE.Vector3().subVectors(this.pivotPos, bobPos).normalize();
        this.arrowTension.setDirection(tensionDir);
        
        let tensLen = 0.0001;
        if (state.showTension) {
            // Keep tension highly visible, slightly larger than gravity to stand out
            const speedSq = this.vx * this.vx + this.vy * this.vy;
            tensLen = 0.38 + Math.min(speedSq * 0.02, 0.1); 
        }
        this.arrowTension.setLength(tensLen, tensLen * 0.25, tensLen * 0.12);

        // 3. Coriolis Force Vector (Green/Yellow): orthogonal to velocity
        this.arrowCoriolis.position.copy(bobPos);
        
        // We boost the visual size of Coriolis force so that it's highly obvious and readable 
        // even under modest speed multipliers
        const visualBoost = 2.5; 
        const coriolisDir = new THREE.Vector3(f * this.vy * visualBoost, -f * this.vx * visualBoost, 0);
        const coriolisLen = coriolisDir.length();
        if (coriolisLen > 1e-6) {
            coriolisDir.normalize();
        } else {
            coriolisDir.set(1, 0, 0);
        }
        this.arrowCoriolis.setDirection(coriolisDir);
        
        let corLen = 0.0001;
        if (state.showCoriolis) {
            // Cap the visual size perfectly so it stays elegant
            corLen = Math.min(coriolisLen, 0.45);
            // Give it a small minimum size when the pendulum has speed, so it doesn't vanish entirely
            if (speed > 0.05 && corLen < 0.12 && Math.abs(this.latitude) > 2) {
                corLen = 0.12; 
            }
        }
        this.arrowCoriolis.setLength(corLen, corLen * 0.25, corLen * 0.12);

        // -------------------------------------------------------------
        // TRAJECTORY HISTORY (GROUND TRAIL)
        // -------------------------------------------------------------
        if (state.showPath && !state.paused) {
            this.trailPoints.push(new THREE.Vector3(this.x, this.y, 0.02));
            if (this.trailPoints.length > this.maxTrailPoints) {
                this.trailPoints.shift();
            }
            this.updateTrailMesh();
            this.trailLine.visible = true;
        } else if (!state.showPath) {
            this.trailLine.visible = false;
        }
    }

    updateTrailMesh() {
        const positions = this.trailGeometry.attributes.position.array;
        const colors = this.trailGeometry.attributes.color.array;
        const len = this.trailPoints.length;

        const pathColor = new THREE.Color(0xec4899); // Pink neon path

        for (let i = 0; i < this.maxTrailPoints; i++) {
            const idx = i * 3;
            if (i < len) {
                const pt = this.trailPoints[i];
                positions[idx] = pt.x;
                positions[idx+1] = pt.y;
                positions[idx+2] = pt.z;

                const alpha = i / len;
                colors[idx] = pathColor.r * alpha;
                colors[idx+1] = pathColor.g * alpha;
                colors[idx+2] = pathColor.b * alpha;
            } else {
                const pt = len > 0 ? this.trailPoints[len - 1] : new THREE.Vector3(0,0,0.02);
                positions[idx] = pt.x;
                positions[idx+1] = pt.y;
                positions[idx+2] = pt.z;
                colors[idx] = 0;
                colors[idx+1] = 0;
                colors[idx+2] = 0;
            }
        }
        this.trailGeometry.attributes.position.needsUpdate = true;
        this.trailGeometry.attributes.color.needsUpdate = true;
    }

    reset() {
        this.x = 0.6;
        this.y = 0.0;
        this.vx = 0.0;
        this.vy = 0.0;
        this.trailPoints = [];
        this.maxCoriolis = 0.0;
        this.precessionAngle = 0;
        this.updateTrailMesh();
    }
}

// -------------------------------------------------------------
// SYSTEM INITIALIZATION
// -------------------------------------------------------------
function init() {
    const container = document.getElementById('canvas-container');

    // 1. Scene & Camera Setup
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0a0b10, 0.015);

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 4, 12);

    // 2. Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    // 3. Orbit Controls
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxDistance = 25;
    controls.minDistance = 2;

    // 4. Starfield space background
    createSpaceBackground();

    // 5. Lighting Setup
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0x00f0ff, 1.2);
    dirLight1.position.set(5, 10, 7);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x9b5de5, 0.8);
    dirLight2.position.set(-5, -5, -5);
    scene.add(dirLight2);

    // 6. Holographic Rotating Earth Globe
    earthGroup = new THREE.Group();
    scene.add(earthGroup);

    const earthTexture = createProceduralEarthTexture();
    const earthGeo = new THREE.SphereGeometry(5.0, 64, 64);
    const earthMat = new THREE.MeshStandardMaterial({
        map: earthTexture,
        transparent: true,
        opacity: 0.85,
        roughness: 0.4,
        metalness: 0.7,
        bumpScale: 0.05
    });
    earthMesh = new THREE.Mesh(earthGeo, earthMat);
    earthGroup.add(earthMesh);

    // Outer grid (holographic latitude/longitude guide)
    const gridGeo = new THREE.SphereGeometry(5.05, 36, 18);
    const gridMat = new THREE.MeshBasicMaterial({
        color: 0x00f0ff,
        wireframe: true,
        transparent: true,
        opacity: 0.12
    });
    gridHelper = new THREE.Mesh(gridGeo, gridMat);
    earthGroup.add(gridHelper);

    // 7. Instantiate Foucault Pendulums
    const polePendulum = new FoucaultPendulum(90, 0x39ff14, 5.0);
    earthGroup.add(polePendulum.group);
    pendulums.push(polePendulum);

    const midPendulum = new FoucaultPendulum(45, 0xec4899, 5.0);
    earthGroup.add(midPendulum.group);
    pendulums.push(midPendulum);

    const eqPendulum = new FoucaultPendulum(0, 0xeab308, 5.0);
    earthGroup.add(eqPendulum.group);
    pendulums.push(eqPendulum);

    // 8. Event Listeners & Controls Setup
    clock = new THREE.Clock();
    window.addEventListener('resize', onWindowResize);
    setupUIControls();

    // Trigger initial camera focus
    updateCameraFocus('globe');

    // Start Simulation loop
    animate();
}

function createSpaceBackground() {
    const starGeo = new THREE.BufferGeometry();
    const starCount = 3000;
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount; i++) {
        const idx = i * 3;
        const u = Math.random();
        const v = Math.random();
        const theta = u * 2.0 * Math.PI;
        const phi = Math.acos(2.0 * v - 1.0);
        const r = 40 + Math.random() * 20;

        positions[idx] = r * Math.sin(phi) * Math.cos(theta);
        positions[idx+1] = r * Math.sin(phi) * Math.sin(theta);
        positions[idx+2] = r * Math.cos(phi);

        const rand = Math.random();
        if (rand > 0.8) {
            colors[idx] = 0.5; colors[idx+1] = 0.8; colors[idx+2] = 1.0; // Cyan star
        } else if (rand > 0.6) {
            colors[idx] = 0.8; colors[idx+1] = 0.5; colors[idx+2] = 1.0; // Purple star
        } else {
            colors[idx] = 1.0; colors[idx+1] = 1.0; colors[idx+2] = 1.0; // White star
        }
    }

    starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const starMat = new THREE.PointsMaterial({
        size: 0.15,
        vertexColors: THREE.VertexColors, // Compatible with standard r128
        transparent: true,
        opacity: 0.7
    });

    stars = new THREE.Points(starGeo, starMat);
    scene.add(stars);
}

// -------------------------------------------------------------
// EVENT HANDLERS & INTERACTIVITY
// -------------------------------------------------------------
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function updateCameraFocus(mode) {
    state.activeFocus = mode;
    
    // Deactivate all focus buttons
    document.querySelectorAll('.focus-btn').forEach(btn => btn.classList.remove('active'));

    const targetPos = new THREE.Vector3();

    switch (mode) {
        case 'globe':
            document.getElementById('focus-globe').classList.add('active');
            controls.target.set(0, 0, 0);
            animateCamera(new THREE.Vector3(0, 4, 13));
            state.selectedLatitude = 90;
            break;
            
        case 'pole':
            document.getElementById('focus-pole').classList.add('active');
            pendulums[0].group.getWorldPosition(targetPos);
            controls.target.copy(targetPos);
            const poleCam = new THREE.Vector3().copy(targetPos).add(new THREE.Vector3(0, 1.8, 1.2));
            animateCamera(poleCam);
            state.selectedLatitude = 90;
            break;

        case 'mid':
            document.getElementById('focus-mid').classList.add('active');
            pendulums[1].group.getWorldPosition(targetPos);
            controls.target.copy(targetPos);
            const midCam = new THREE.Vector3().copy(targetPos).add(new THREE.Vector3(0, 1.3, 1.8));
            animateCamera(midCam);
            state.selectedLatitude = 45;
            break;

        case 'equator':
            document.getElementById('focus-equator').classList.add('active');
            pendulums[2].group.getWorldPosition(targetPos);
            controls.target.copy(targetPos);
            const eqCam = new THREE.Vector3().copy(targetPos).add(new THREE.Vector3(0, 0.8, 2.2));
            animateCamera(eqCam);
            state.selectedLatitude = 0;
            break;
    }

    updateRealtimeUIInfo();
}

function animateCamera(toPosition) {
    let count = 0;
    const steps = 30;
    const fromPos = camera.position.clone();
    
    function step() {
        if (count < steps) {
            camera.position.lerpVectors(fromPos, toPosition, count / steps);
            count++;
            requestAnimationFrame(step);
        } else {
            camera.position.copy(toPosition);
        }
    }
    step();
}

function updateRealtimeUIInfo() {
    const title = document.getElementById('current-location-title');
    const badge = document.getElementById('current-latitude-badge');
    const period = document.getElementById('val-precession-period');
    const speed = document.getElementById('val-precession-speed');
    
    let activePend = pendulums[0];

    if (state.selectedLatitude === 90) {
        title.innerText = 'Polo Nord';
        badge.innerText = '90° N';
        badge.style.borderColor = '#39ff14';
        badge.style.color = '#39ff14';
        period.innerText = '24.0 ore';
        speed.innerText = '15.0° / ora';
        activePend = pendulums[0];
    } else if (state.selectedLatitude === 45) {
        title.innerText = 'Latitudine 45°';
        badge.innerText = '45° N';
        badge.style.borderColor = '#ec4899';
        badge.style.color = '#ec4899';
        period.innerText = '33.9 ore';
        speed.innerText = '10.6° / ora';
        activePend = pendulums[1];
    } else if (state.selectedLatitude === 0) {
        title.innerText = 'Equatore';
        badge.innerText = '0° N';
        badge.style.borderColor = '#eab308';
        badge.style.color = '#eab308';
        period.innerText = 'Infinito';
        speed.innerText = '0.0° / ora';
        activePend = pendulums[2];
    }

    document.querySelectorAll('.accordion-item').forEach((item, index) => {
        const lats = [90, 45, 0];
        if (lats[index] === state.selectedLatitude) {
            item.classList.add('open');
        } else {
            item.classList.remove('open');
        }
    });
}

function setupUIControls() {
    // Speed Slider
    const speedSlider = document.getElementById('speed-slider');
    const speedVal = document.getElementById('speed-val');
    speedSlider.addEventListener('input', (e) => {
        state.earthSpeedMultiplier = parseInt(e.target.value);
        speedVal.innerText = `${state.earthSpeedMultiplier}x`;
    });

    // Pendulum Frequency Slider
    const pendSlider = document.getElementById('pendulum-speed-slider');
    const pendVal = document.getElementById('pend-speed-val');
    pendSlider.addEventListener('input', (e) => {
        state.pendulumFreq = parseFloat(e.target.value);
        pendVal.innerText = `${state.pendulumFreq.toFixed(1)} Hz`;
    });

    // Play/Pause Button
    const btnPlayPause = document.getElementById('btn-play-pause');
    btnPlayPause.addEventListener('click', () => {
        state.paused = !state.paused;
        btnPlayPause.innerHTML = state.paused ? '▶️ Avvia' : '⏸️ Pausa';
        btnPlayPause.classList.toggle('primary-btn');
        btnPlayPause.classList.toggle('secondary-btn');
    });

    // Reset Button
    document.getElementById('btn-reset').addEventListener('click', () => {
        pendulums.forEach(p => p.reset());
    });

    // Camera Focus Buttons
    document.getElementById('focus-globe').addEventListener('click', () => updateCameraFocus('globe'));
    document.getElementById('focus-pole').addEventListener('click', () => updateCameraFocus('pole'));
    document.getElementById('focus-mid').addEventListener('click', () => updateCameraFocus('mid'));
    document.getElementById('focus-equator').addEventListener('click', () => updateCameraFocus('equator'));

    // Accordions interaction click
    document.querySelectorAll('.accordion-header').forEach((header, index) => {
        header.addEventListener('click', () => {
            const lats = [90, 45, 0];
            state.selectedLatitude = lats[index];
            
            const modes = ['pole', 'mid', 'equator'];
            updateCameraFocus(modes[index]);
        });
    });

    // Vector Checkboxes
    document.getElementById('chk-gravity').addEventListener('change', (e) => state.showGravity = e.target.checked);
    document.getElementById('chk-tension').addEventListener('change', (e) => state.showTension = e.target.checked);
    document.getElementById('chk-coriolis').addEventListener('change', (e) => state.showCoriolis = e.target.checked);
    document.getElementById('chk-path').addEventListener('change', (e) => {
        state.showPath = e.target.checked;
        if (!state.showPath) {
            pendulums.forEach(p => p.trailLine.visible = false);
        }
    });
}

// -------------------------------------------------------------
// MAIN ANIMATION LOOP
// -------------------------------------------------------------
function animate() {
    requestAnimationFrame(animate);

    const rawDelta = clock.getDelta();
    const dt = Math.min(rawDelta, 0.03);

    const currentEarthOmega = PHYSICS.BASE_EARTH_OMEGA * state.earthSpeedMultiplier;

    if (!state.paused) {
        earthGroup.rotation.y += currentEarthOmega * dt;

        pendulums.forEach(p => {
            p.updatePhysics(dt, currentEarthOmega);
        });
    }

    const activePend = state.selectedLatitude === 90 ? pendulums[0] : 
                       state.selectedLatitude === 45 ? pendulums[1] : pendulums[2];
                       
    document.getElementById('val-current-precession').innerText = `${activePend.precessionAngle.toFixed(2)}°`;
    document.getElementById('val-coriolis-force').innerText = `${(activePend.maxCoriolis * 1000).toFixed(2)} mm/s²`;

    if (state.activeFocus !== 'globe') {
        const targetPos = new THREE.Vector3();
        activePend.group.getWorldPosition(targetPos);
        controls.target.copy(targetPos);
        
        if (!state.paused) {
            const rotY = currentEarthOmega * dt;
            camera.position.applyAxisAngle(new THREE.Vector3(0, 1, 0), rotY);
        }
    }

    controls.update();
    renderer.render(scene, camera);
}

// Start everything when DOM is loaded
window.addEventListener('DOMContentLoaded', init);
