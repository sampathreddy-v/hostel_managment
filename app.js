// ============================================================
// APP LOGIC & UI INTERACTION
// ============================================================

const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000'
    : 'https://hostel-managment-i9y5.onrender.com';

let currentRole = null;
let currentHostel = 1;
let currentTenant = null;
let loginTab = 'owner';

// Using hostels and rooms defined in database.js

// ============================================================
// NAVIGATION & MODALS
// ============================================================
function goTo(id) {
    document.querySelectorAll('.pg').forEach(p => p.classList.remove('on'));
    const target = document.getElementById(id);
    if (target) target.classList.add('on');
    window.scrollTo(0, 0);
}

function openModal(id) { 
    const el = document.getElementById(id);
    if (el) el.classList.add('on'); 
}

function closeModal(id) { 
    const el = document.getElementById(id);
    if (el) el.classList.remove('on'); 
}

function logout() {
    currentRole = null;
    goTo('pg-landing');
    showToast('Logged out', 'See you next time!');
}

function scrollToInfo() { 
    document.getElementById('hostel-info').scrollIntoView({ behavior: 'smooth' }); 
}

function loginAs(role) {
    switchLoginTab(role);
    openModal('login-modal');
}

function switchLoginTab(role) {
    loginTab = role;
    document.querySelectorAll('.fb').forEach(b => b.classList.remove('on'));
    const target = document.getElementById(`lt-${role}`);
    if (target) target.classList.add('on');
    
    const btn = document.getElementById('l-btn');
    if (btn) btn.textContent = `Login as ${role.charAt(0).toUpperCase() + role.slice(1)}`;
}

async function doLogin() {
    const email = document.getElementById('l-email').value.trim().toLowerCase();
    const pass = document.getElementById('l-pass').value.trim();
    
    if (!email || !pass) {
        showToast('Missing Info', 'Please enter email and password.');
        return;
    }

    showToast('Authenticating...', 'Checking credentials...');
    
    // For demo purposes, we allow any login that matches the role logic
    // or specific logic from your hostel_management002.html
    if (loginTab === 'owner') {
        goTo('pg-owner');
        renderOwnerOccupancy();
    } else if (loginTab === 'manager') {
        currentHostel = 1; // Default to Hostel 1 for demo
        goTo('pg-manager');
        renderManagerOccupancy();
    } else {
        goTo('pg-tenant');
        renderTenantPortal();
    }
    
    closeModal('login-modal');
}

// ============================================================
// DASHBOARD TAB NAVIGATION
// ============================================================
function ownerTab(el, id) {
    document.querySelectorAll('#pg-owner .sb-link').forEach(l => l.classList.remove('act'));
    el.classList.add('act');
    document.querySelectorAll('#pg-owner .dash-section').forEach(s => s.classList.remove('on'));
    const target = document.getElementById(id);
    if (target) target.classList.add('on');
    
    if (id === 'o-occupancy') renderOwnerOccupancy();
    if (id === 'o-managers') renderManagersTable();
    if (id === 'o-rent') renderOwnerRentTable();
    if (id === 'o-complaints') renderOwnerComplaints();
    if (id === 'o-tenants') renderOwnerAllTenants();
}

function mgrTab(el, id) {
    document.querySelectorAll('#pg-manager .sb-link').forEach(l => l.classList.remove('act'));
    el.classList.add('act');
    document.querySelectorAll('#pg-manager .dash-section').forEach(s => s.classList.remove('on'));
    const target = document.getElementById(id);
    if (target) target.classList.add('on');
    
    if (id === 'm-occupancy') renderManagerOccupancy();
    if (id === 'm-rent') renderMgrRentTable();
    if (id === 'm-tenants') renderMgrTenants();
    if (id === 'm-requests') renderMgrRequests();
}

function tenantTab(el, id) {
    document.querySelectorAll('#pg-tenant .sb-link').forEach(l => l.classList.remove('act'));
    el.classList.add('act');
    document.querySelectorAll('#pg-tenant .dash-section').forEach(s => s.classList.remove('on'));
    const target = document.getElementById(id);
    if (target) target.classList.add('on');
    
    if (id === 't-pay') renderTenantPortal();
    if (id === 't-complaints') renderTenantComplaints();
}

// ============================================================
// MOBILE SIDEBAR
// ============================================================
function openMobileSidebar() {
    document.querySelectorAll('.sidebar').forEach(s => s.classList.add('mob-open'));
    document.getElementById('sidebar-overlay').classList.add('on');
}

function closeMobileSidebar() {
    document.querySelectorAll('.sidebar').forEach(s => s.classList.remove('mob-open'));
    document.getElementById('sidebar-overlay').classList.remove('on');
}
const hostelPhotos = {
    1: ['hostel_single.png', 'hostel_common.png'],
    2: ['hostel_triple.png', 'hostel_common.png'],
    3: ['hostel_single.png', 'hostel_triple.png']
};

const hostelDetails = {
    1: {
        desc: "ISHTAA PRIME BOYS property at NARSINGI offers premium boys accommodation with ultra-modern amenities, high-speed connectivity, and comfortable living spaces.",
        locFull: "NARSINGI, Hyderabad",
        mapUrl: "https://www.google.com/maps/search/?api=1&query=17.394860,78.324830"
    },
    2: {
        desc: "ISHTAA PRIME GIRLS property at NARSINGI provides safe, luxurious, and convenient girls accommodation close to IT hubs with top-class amenities.",
        locFull: "NARSINGI, Hyderabad",
        mapUrl: "https://www.google.com/maps/search/?api=1&query=17.448293,78.374185"
    }
};

async function openHostelDetail(id) {
    const h = hostels[id];
    const d = hostelDetails[id];
    
    document.getElementById('hd-name').textContent = h.name;
    document.getElementById('hd-loc-sub').textContent = d.locFull.split(',')[0];
    document.getElementById('hd-loc-full').textContent = d.locFull;
    document.getElementById('hd-desc').textContent = d.desc;
    
    const fallbackMapUrls = {
        1: {
            mapUrl: "https://www.google.com/maps/search/?api=1&query=17.394860,78.324830",
            mapEmbedUrl: "https://maps.google.com/maps?q=17.394860,78.324830&z=15&output=embed"
        },
        2: {
            mapUrl: "https://www.google.com/maps/search/?api=1&query=17.448293,78.374185",
            mapEmbedUrl: "https://maps.google.com/maps?q=17.448293,78.374185&z=15&output=embed"
        },
        3: {
            mapUrl: "https://www.google.com/maps/search/?api=1&query=17.448550,78.390830",
            mapEmbedUrl: "https://maps.google.com/maps?q=17.448550,78.390830&z=15&output=embed"
        }
    };
    const mapInfo = fallbackMapUrls[id] || fallbackMapUrls[1];
    const mapBtn = document.getElementById('hd-map-btn');
    if (mapBtn) {
        mapBtn.href = d.mapUrl || mapInfo.mapUrl;
    }
    const mapIframe = document.getElementById('hd-map-iframe');
    if (mapIframe) {
        mapIframe.src = d.mapEmbedUrl || mapInfo.mapEmbedUrl;
    }

    // Also update main dashboard map
    const dbMapIframe = document.getElementById('db-map-iframe');
    if (dbMapIframe) {
        dbMapIframe.src = mapInfo.mapEmbedUrl;
    }
    const dbMapTitle = document.getElementById('db-map-title');
    if (dbMapTitle) {
        dbMapTitle.textContent = `${h.name} Location`;
    }
    
    // Set initial image
    const photos = hostelPhotos[id];
    document.getElementById('hd-img').src = photos[0];
    
    // Create gallery dots
    const nav = document.getElementById('hd-gal-nav');
    nav.innerHTML = photos.map((p, i) => `<div class="gal-dot ${i===0?'on':''}" onclick="changeDetailPhoto(this, '${p}')"></div>`).join('');
    
    // Calculate live stats
    if (!rooms[id] || rooms[id].length === 0) {
        showToast('Loading...', `Fetching inventory for ${h.name}`);
        await loadData([id]);
    }
    
    const stats = { 1: 0, 2: 0, 3: 0 };
    rooms[id].forEach(r => {
        const vacantBeds = r.beds.filter(b => !b.tenant).length;
        if (stats[r.capacity] !== undefined) {
            stats[r.capacity] += vacantBeds;
        }
    });
    
    document.getElementById('hd-stat-1').textContent = stats[1] || 0;
    document.getElementById('hd-stat-2').textContent = stats[2] || 0;
    document.getElementById('hd-stat-3').textContent = stats[3] || 0;
    
    openModal('hostel-detail-modal');
}

function changeDetailPhoto(dot, src) {
    document.getElementById('hd-img').src = src;
    document.querySelectorAll('.gal-dot').forEach(d => d.classList.remove('on'));
    dot.classList.add('on');
}

// ============================================================
// LOGIN LOGIC
// ============================================================
function switchLoginTab(tab) {
    loginTab = tab;
    ['owner', 'manager', 'tenant'].forEach(t => document.getElementById('lt-' + t).classList.remove('on'));
    document.getElementById('lt-' + tab).classList.add('on');
    document.getElementById('l-btn').textContent = `Login as ${tab.charAt(0).toUpperCase() + tab.slice(1)}`;
    
    document.getElementById('l-email').value = '';
    document.getElementById('l-pass').value = '';
}

function loginAs(role) {
    switchLoginTab(role);
    openModal('login-modal');
}

async function doLogin() {
    const email = document.getElementById('l-email').value.trim();
    const password = document.getElementById('l-pass').value;

    if (!email || !password) {
        showToast('Error', 'Please enter email and password');
        return;
    }

    showToast('Authenticating...', 'Verifying credentials...');

    if (loginTab === 'owner' || loginTab === 'manager') {
        const { data: user, error } = await db.from('users')
            .select('*')
            .eq('email', email)
            .eq('password', password)
            .eq('role', loginTab)
            .single();

        if (error || !user) {
            showToast('Login Failed', 'Invalid email or password');
            return;
        }

        closeModal('login-modal');

        if (loginTab === 'owner') {
            currentRole = 'owner';
            showToast('Loading...', 'Fetching data from database...');
            try {
                await loadData([1, 2]);
            } catch (e) {
                console.warn("Soft fail on loadData, proceeding anyway.");
            }
            
            try {
                renderOwnerOccupancy();
                renderOwnerRentTable('all');
                renderOwnerComplaints();
                renderOwnerAllTenants();
                renderOwnerNotices();
                renderManagersTable();
            } catch (renderError) {
                console.error("Dashboard render error:", renderError);
            }
            
            goTo('pg-owner');
            showToast('Welcome back, Owner! 👑', 'Owner dashboard loaded.');
        } else if (loginTab === 'manager') {
            currentRole = 'manager';
            currentHostel = user.hostel_id;
            document.getElementById('mgr-name-sb').textContent = (hostels[currentHostel] ? hostels[currentHostel].mgr : 'Manager');
            document.getElementById('mgr-hostel-sb').textContent = (hostels[currentHostel] ? `Hostel ${currentHostel} — ${hostels[currentHostel].name.replace('VUSTELA ', '')}` : `Hostel ${currentHostel}`);
            document.getElementById('m-dash-title').textContent = (hostels[currentHostel] ? hostels[currentHostel].name : `Hostel ${currentHostel}`);
            
            showToast('Loading...', 'Fetching data from database...');
            try {
                await loadData([currentHostel]);
            } catch (e) {
                console.warn("Soft fail on loadData, proceeding anyway.");
            }
            
            try {
                renderManagerOccupancy();
                renderMgrRentTable('all');
                renderMgrTenants();
                renderMgrComplaints('all');
                renderMgrFoodMenu();
                renderMgrRequests();
            } catch (renderError) {
                console.error("Manager dashboard render error:", renderError);
            }
            
            goTo('pg-manager');
            showToast(`Welcome! 🗂️`, `Managing Hostel ${currentHostel}`);
        }
    } else {
        // Tenant login
        let foundBed = null;
        for (let hid of [1, 2]) {
            rooms[hid].forEach(r => {
                r.beds.forEach(b => {
                    if (b.tenant_email && b.tenant_email.toLowerCase() === email.toLowerCase() && b.tenant_password === password) {
                        foundBed = { ...b, tenant_name: b.tenant, rooms: { num: r.num, hostel_id: hid } };
                    }
                });
            });
        }

        if (!foundBed) {
            const { data: bed, error } = await db.from('beds')
                .select('*, rooms(hostel_id, num)')
                .ilike('tenant_email', email)
                .eq('tenant_password', password)
                .single();
                
            if (!error && bed) foundBed = bed;
        }

        if (!foundBed) {
            showToast('Login Failed', 'Invalid tenant email or password');
            return;
        }

        closeModal('login-modal');
        currentRole = 'tenant';
        currentTenant = foundBed;
        currentHostel = foundBed.rooms.hostel_id;
        
        showToast('Loading...', 'Fetching data from database...');
        try {
            await loadData([currentHostel]);
        } catch (e) {
            console.warn("Soft fail on loadData, proceeding anyway.");
        }
        renderTenantPortal();
        renderTenantComplaints();
        renderNotices();
        renderTenantFoodMenu();
        goTo('pg-tenant');
        showToast(`Welcome back, ${foundBed.tenant_name}! 🏠`, `Room ${foundBed.rooms.num} · Hostel ${currentHostel}`);
    }
}



// ============================================================
// ROOM OCCUPANCY
window.currentOccBlockFilter = 'ALL';
function setOccBlockFilter(blk) {
    window.currentOccBlockFilter = blk;
    if (currentRole === 'owner') renderOwnerOccupancy();
    else renderManagerOccupancy();
}

function buildOccGrid(hostelIds, containerId, role) {
    const container = document.getElementById(containerId);
    if (!container) return;
    let html = '';

    const currentFilter = window.currentOccBlockFilter || 'ALL';

    // Block Filter Toolbar
    html += `<div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px; margin-bottom:18px; background:var(--bg2, #f8fafc); padding:12px 16px; border-radius:12px; border:1px solid var(--border, #e2e8f0);">
        <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:16px;">🏢</span>
            <strong style="font-size:14px; color:var(--ink);">Filter Block:</strong>
        </div>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <button class="btn btn-sm ${currentFilter === 'ALL' ? 'btn-primary' : 'btn-outline'}" onclick="setOccBlockFilter('ALL')">All Blocks (A & B)</button>
            <button class="btn btn-sm ${currentFilter === 'A' ? 'btn-primary' : 'btn-outline'}" onclick="setOccBlockFilter('A')">🏢 Block A (5 Floors, 40 Rooms)</button>
            <button class="btn btn-sm ${currentFilter === 'B' ? 'btn-primary' : 'btn-outline'}" onclick="setOccBlockFilter('B')">🏢 Block B (5 Floors, 40 Rooms)</button>
        </div>
    </div>`;

    hostelIds.forEach(hid => {
        const hrooms = rooms[hid] || [];
        if (hrooms.length === 0) {
            html += `<div class="card" style="padding:40px; text-align:center; color:var(--ink3)">No room data found for Hostel ${hid}</div>`;
            return;
        }

        // Group rooms by Block
        const blocksMap = {};
        hrooms.forEach(r => {
            let blockName = 'Block A';
            if (r.num && (r.num.toUpperCase().startsWith('B-') || r.num.toUpperCase().startsWith('B') || r.block === 'B')) {
                blockName = 'Block B';
            } else if (r.num && (r.num.toUpperCase().startsWith('A-') || r.num.toUpperCase().startsWith('A') || r.block === 'A')) {
                blockName = 'Block A';
            }
            if (!blocksMap[blockName]) blocksMap[blockName] = [];
            blocksMap[blockName].push(r);
        });

        const totalBeds = hrooms.reduce((sum, r) => sum + r.capacity, 0);
        const occBeds = hrooms.reduce((sum, r) => sum + (r.beds ? r.beds.filter(b => b.tenant).length : 0), 0);
        const pct = totalBeds > 0 ? Math.round(occBeds / totalBeds * 100) : 0;

        html += `<div class="hostel-occ-block" style="margin-bottom:28px;">
            <div class="hob-header">
                <div><div class="hob-name">${hostels[hid] ? hostels[hid].name : 'Hostel ' + hid}</div></div>
                <div class="hob-stats">
                    <div class="hob-stat"><span class="dot dot-green"></span><strong>${occBeds}</strong>&nbsp;Beds Full</div>
                    <div class="hob-stat"><span class="dot dot-red"></span><strong>${totalBeds - occBeds}</strong>&nbsp;Beds Free</div>
                    <div class="hob-stat"><strong>${pct}%</strong>&nbsp;Occupancy</div>
                </div>
            </div>`;

        const sortedBlockKeys = Object.keys(blocksMap).sort();
        sortedBlockKeys.forEach(blkKey => {
            if (currentFilter === 'A' && !blkKey.endsWith('A')) return;
            if (currentFilter === 'B' && !blkKey.endsWith('B')) return;

            const blkRooms = blocksMap[blkKey];
            const blkTotalBeds = blkRooms.reduce((sum, r) => sum + r.capacity, 0);
            const blkOccBeds = blkRooms.reduce((sum, r) => sum + (r.beds ? r.beds.filter(b => b.tenant).length : 0), 0);
            const blkPct = blkTotalBeds > 0 ? Math.round(blkOccBeds / blkTotalBeds * 100) : 0;

            html += `<div class="block-section" style="margin-top:16px; margin-bottom:20px; border:1px solid var(--border); border-radius:12px; padding:16px; background:var(--card-bg, #ffffff); box-shadow:0 2px 8px rgba(0,0,0,0.04);">
                <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid var(--border); padding-bottom:10px; margin-bottom:14px; flex-wrap:wrap; gap:8px;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span class="badge ${blkKey.includes('B') ? 'badge-blue' : 'badge-green'}" style="font-size:12px; padding:4px 10px; font-weight:800;">🏢 ${blkKey.toUpperCase()}</span>
                        <span style="font-weight:700; font-size:15px; color:var(--ink);">${blkKey} — 5 Floors (8 Rooms per Floor)</span>
                    </div>
                    <div style="font-size:12px; color:var(--ink2); font-weight:600;">
                        Occupancy: <strong>${blkOccBeds} / ${blkTotalBeds} Beds</strong> (${blkPct}%)
                    </div>
                </div>`;

            const floors = [...new Set(blkRooms.map(r => r.floor))].sort((a,b) => a - b);
            floors.forEach(fl => {
                const flrRooms = blkRooms.filter(r => r.floor === fl);
                html += `<div class="floor-block" style="margin-bottom:16px;">
                    <div class="floor-label" style="font-weight:700; color:var(--ink); font-size:13px; margin-bottom:8px; display:flex; align-items:center; gap:8px;">
                        <span>📍 Floor ${fl}</span>
                        <span style="font-size:11px; opacity:0.6; font-weight:normal;">(${flrRooms.length} Rooms: ${flrRooms[0]?.num || ''} - ${flrRooms[flrRooms.length-1]?.num || ''})</span>
                    </div>
                    <div class="room-grid" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap:10px;">`;

                flrRooms.forEach(r => {
                    const occupiedBeds = r.beds ? r.beds.filter(b => b.tenant).length : 0;
                    const isFull = occupiedBeds === r.capacity;
                    const isEmpty = occupiedBeds === 0;
                    const hasOverdue = r.beds ? r.beds.some(b => b.rentStatus === 'overdue') : false;
                    
                    let cls = isEmpty ? 'vacant' : (hasOverdue) ? 'warning' : 'occupied';
                    let statusText = isEmpty ? '<span class="rb-status" style="color:var(--red)">VACANT</span>' :
                        hasOverdue ? '<span class="rb-status" style="color:var(--yellow)">OVERDUE</span>' :
                        (!isFull) ? '<span class="rb-status" style="color:var(--green)">PARTIAL</span>' :
                        '<span class="rb-status" style="color:var(--green)">FULL</span>';
                        
                    html += `<div class="room-box ${cls}" onclick="showRoomPopup(event,${hid},'${r.num}','${role}')">
                        <div class="rb-num">${r.num}</div>
                        <div class="rb-name">${occupiedBeds} / ${r.capacity} Beds</div>
                        ${statusText}
                    </div>`;
                });
                html += `</div></div>`;
            });
            html += `</div>`;
        });
        html += `</div>`;
    });
    container.innerHTML = html;
}

function renderOwnerOccupancy() { buildOccGrid([1, 2], 'owner-occ-grid', 'owner'); }
function renderManagerOccupancy() { buildOccGrid([currentHostel], 'manager-occ-grid', 'manager'); }

// ============================================================
// ROOM POPUP & ACTIONS
// ============================================================
function showRoomPopup(e, hostelId, roomNum, role) {
    e.stopPropagation();
    const room = rooms[hostelId].find(r => r.num === roomNum);
    if (!room) return;
    const popup = document.getElementById('room-popup');
    document.getElementById('rp-room-num').textContent = `Room ${roomNum} — Hostel ${hostelId}`;
    
    let bedDetails = room.beds.map((b, idx) => `
        <div style="padding:10px; border:1px solid var(--border); border-radius:8px; margin-bottom:8px; background:${b.tenant ? 'var(--white)' : 'var(--bg)'}">
            <div style="font-size:11px; font-weight:700; color:var(--ink3); margin-bottom:4px">BED ${idx + 1}</div>
            ${b.tenant ? `
                <div style="font-weight:600; color:var(--ink); margin-bottom:2px">${b.tenant}</div>
                <div style="font-size:12px; color:var(--ink2)">Rent: ₹${b.rent.toLocaleString()}</div>
                <div style="font-size:12px; margin-top:4px">${b.rentStatus === 'paid' ? '✅ Paid' : '⏳ Pending'}</div>
                ${role === 'manager' ? `<button class="btn-sm btn-outline" style="margin-top:6px" onclick="removeTenant(${hostelId},'${roomNum}',${idx})">Remove</button>` : ''}
            ` : `
                <div style="font-weight:500; color:var(--ink3); font-style:italic">Empty Bed</div>
                ${role === 'manager' ? `<button class="btn-sm btn-ghost" style="margin-top:6px" onclick="openAddTenantModal('${room.num}')">+ Add Student</button>` : ''}
            `}
        </div>
    `).join('');

    document.getElementById('rp-content').innerHTML = `
        <div class="rp-row"><span class="rp-key">Type</span><span class="rp-val">${room.type}</span></div>
        <div style="margin-top:12px">${bedDetails}</div>
    `;
    
    popup.style.top = '';
    popup.style.left = '';
    popup.classList.add('on');
}

function closeRoomPopup() { 
    const el = document.getElementById('room-popup');
    if (el) el.classList.remove('on'); 
}

// ============================================================
// TENANT MANAGEMENT
// ============================================================
async function addTenant() {
    const name = document.getElementById('at-name').value.trim();
    const email = document.getElementById('at-email').value.trim().toLowerCase();
    const phone = document.getElementById('at-phone').value.replace(/\D/g, '');
    const roomNum = document.getElementById('at-room').value;
    const rent = parseInt(document.getElementById('at-rent').value) || 5500;
    
    if (!/^[a-z0-9._%+-]+@gmail\.com$/i.test(email)) {
        showToast('Error', 'Invalid @gmail.com address. Only true Gmail addresses are accepted.');
        return;
    }

    const r = rooms[currentHostel].find(rm => rm.num === roomNum);
    if (!r) return;
    
    const emptyBed = r.beds.find(b => !b.tenant);
    if (!emptyBed) return;

    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let genPwd = 'Vustela#';
    for (let i=0; i<4; i++) genPwd += chars[Math.floor(Math.random() * chars.length)];

    showToast('Saving...', 'Adding tenant to database...');
    
    const { data, error } = await db.from('beds').update({ 
        tenant_name: name, 
        tenant_email: email, 
        tenant_password: genPwd, 
        tenant_phone: phone, 
        rent, 
        rent_status: 'pending' 
    }).eq('id', emptyBed._id).select().single();

    if (error) {
        showToast('Error', error.message);
        return;
    }

    // Update local state
    emptyBed.tenant = name;
    emptyBed.tenant_email = email;
    emptyBed.tenant_password = genPwd;
    emptyBed.rent = rent;
    emptyBed.rentStatus = 'pending';

    closeModal('add-tenant-modal');
    renderManagerOccupancy();
    renderMgrTenants();
    showToast('Tenant Added ✅', 'Credentials sent to email.');
    
    // Send email notification
    sendEmail(email, "Welcome to VUSTELA PG! 🏠", `<h2>Welcome ${name}!</h2><p>Login: ${email}<br>Password: ${genPwd}</p>`);
}

// Helper for sending emails via local backend
function sendEmail(to, subject, html) {
    fetch(API_BASE_URL + '/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, subject, html })
    }).catch(err => console.error("Email error:", err));
}

// ============================================================
// BOOKING REQUESTS (New)
// ============================================================
let bookingRequests = [];

// ============================================================
// LIVE BOOKING SYSTEM (MULTI-STEP)
// ============================================================
let bookingState = { step: 1, hostelId: null, selectedRoom: null, selectedBedIndex: null };

async function selectHostelForBooking(id) {
    bookingState.hostelId = id;
    const h = hostels[id];
    document.getElementById('br-hostel-name').textContent = h.name;
    document.getElementById('br-live-grid').innerHTML = '<div style="text-align:center; padding:40px; color:var(--ink3);">Loading available beds...</div>';
    goToStep(2);

    if (!rooms[id] || rooms[id].length === 0) {
        await loadData([id]);
    }
    renderBookingGrid(id);
}

function renderBookingGrid(id) {
    const hostelRooms = rooms[id] || [];
    const container = document.getElementById('br-live-grid');
    if (hostelRooms.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:40px; color:var(--ink3);">No rooms found.</div>';
        return;
    }
    container.innerHTML = hostelRooms.map(rm => `
        <div class="floor-block" style="margin-bottom: 24px;">
            <div class="floor-label" style="font-size: 11px; font-weight: 700; color: var(--ink3); text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 12px; border-bottom: 1px solid var(--border); padding-bottom: 4px;">
                ${rm.floor === 0 ? 'Ground Floor' : rm.floor + (rm.floor === 1 ? 'st' : (rm.floor === 2 ? 'nd' : 'th')) + ' Floor'}
            </div>
            <div class="room-grid" style="display: flex; flex-wrap: wrap; gap: 12px;">
                <div class="room-card" style="background: var(--white); border: 1px solid var(--border); border-radius: 12px; padding: 12px; min-width: 140px;">
                    <div style="font-weight: 700; font-size: 13px; margin-bottom: 8px;">Room ${rm.num} <span style="font-weight:400; opacity:0.6; font-size:11px;">(${rm.type})</span></div>
                    <div style="display: flex; gap: 6px;">
                        ${rm.beds.map((b, idx) => {
                            const isOccupied = !!b.tenant;
                            return `<div class="bed-box" onclick="${isOccupied ? '' : `selectBedForBooking('${rm.num}', ${idx})`}"
                                     style="width: 32px; height: 32px; border-radius: 6px; cursor: ${isOccupied ? 'not-allowed' : 'pointer'}; 
                                            display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700;
                                            ${isOccupied ? 'background: var(--green); color: white;' : 'border: 1.5px dashed var(--accent); color: var(--accent);'}">
                                    ${idx + 1}
                                </div>`;
                        }).join('')}
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

function selectBedForBooking(roomNum, bedIdx) {
    const rm = rooms[bookingState.hostelId].find(r => r.num === roomNum);
    bookingState.selectedRoom = rm;
    bookingState.selectedBedIndex = bedIdx;
    document.getElementById('br-selection-text').textContent = `Room ${roomNum} (Bed ${bedIdx + 1}) — ${rm.type}`;
    goToStep(3);
}

function goToStep(step) {
    bookingState.step = step;
    document.getElementById('br-step-1').style.display = step === 1 ? 'block' : 'none';
    document.getElementById('br-step-2').style.display = step === 2 ? 'block' : 'none';
    document.getElementById('br-step-3').style.display = step === 3 ? 'block' : 'none';
    const title = document.getElementById('book-modal-title');
    if (step === 1) title.textContent = 'Select Your Branch';
    if (step === 2) title.textContent = 'Choose Your Bed';
    if (step === 3) title.textContent = 'Confirm Booking';
}

function backToStep(step) { goToStep(step); }

async function submitRoomRequest() {
    const name = document.getElementById('br-name').value.trim();
    const email = document.getElementById('br-email').value.trim().toLowerCase();
    const phone = document.getElementById('br-phone').value.trim();
    const message = document.getElementById('br-message').value.trim();

    if (!name || !email || !phone) return showToast('Error', 'Please fill in required fields');
    showToast('Submitting...', 'Sending your request...');

    const roomNum = bookingState.selectedRoom?.num || '';
    const roomType = bookingState.selectedRoom?.type || 'Standard';

    const { error } = await db.schema('public').from('room_bookings').insert({
        name, email, phone, hostel_id: bookingState.hostelId || 1, 
        room_num: roomNum, bed_index: bookingState.selectedBedIndex || 0,
        sharing: roomType, message, status: 'pending'
    });

    if (error) return showToast('Error', error.message);

    // Send Automated WhatsApp & Gmail Notifications to Hostel Manager & Owner
    const bookingDetails = {
        name,
        email,
        phone,
        hostel_id: bookingState.hostelId || 1,
        room_num: roomNum,
        sharing: roomType,
        message: message,
        doj: new Date().toISOString().split('T')[0],
        idtype: 'Aadhaar Card'
    };

    fetch((typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : '') + '/send-booking-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bookingDetails)
    }).catch(err => console.warn('[app.js submitRoomRequest] Notification notice:', err));

    closeModal('book-room-modal');
    showToast('Request Sent! 📬', 'Your request has been sent. WhatsApp & Gmail notifications delivered to Manager & Owner.');
    bookingState = { step: 1, hostelId: null, selectedRoom: null, selectedBedIndex: null };
    goToStep(1);
}

async function renderMgrRequests() {
    const { data, error } = await db.schema('public').from('room_bookings')
        .select('*')
        .eq('hostel_id', currentHostel)
        .order('created_at', { ascending: false });

    if (error) return;
    bookingRequests = data;

    const table = document.getElementById('mgr-requests-table');
    if (!table) return;

    table.innerHTML = data.map(r => `
        <tr>
            <td><strong>${r.name}</strong></td>
            <td>${r.email}</td>
            <td>${r.phone}</td>
            <td><span class="badge badge-${r.status === 'pending' ? 'yellow' : r.status === 'accepted' ? 'green' : 'red'}">${r.status.toUpperCase()}</span></td>
            <td>
                <div class="flex gap8">
                    <button class="btn-sm btn-ghost" onclick="seeRequestProfile(${r.id})">See Profile</button>
                    ${r.status === 'pending' ? `
                        <button class="btn-sm btn-green" onclick="acceptRequest(${r.id})">Accept</button>
                        <button class="btn-sm btn-red" onclick="rejectRequest(${r.id})">Reject</button>
                    ` : ''}
                </div>
            </td>
        </tr>
    `).join('') || '<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--ink3)">No pending requests</td></tr>';
}

function seeRequestProfile(id) {
    const r = bookingRequests.find(x => x.id === id);
    if (!r) return;

    document.getElementById('rp-profile-content').innerHTML = `
        <div class="card" style="padding:0; border:none; box-shadow:none">
            <table style="width:100%; border-collapse:collapse">
                <tr style="border-bottom:1px solid var(--border)"><td style="padding:12px; font-weight:600">Full Name</td><td style="padding:12px">${r.name}</td></tr>
                <tr style="border-bottom:1px solid var(--border)"><td style="padding:12px; font-weight:600">Email</td><td style="padding:12px">${r.email}</td></tr>
                <tr style="border-bottom:1px solid var(--border)"><td style="padding:12px; font-weight:600">Phone</td><td style="padding:12px">${r.phone}</td></tr>
                <tr style="border-bottom:1px solid var(--border)"><td style="padding:12px; font-weight:600">Sharing Preference</td><td style="padding:12px">${r.sharing}-Sharing</td></tr>
                <tr style="border-bottom:1px solid var(--border)"><td style="padding:12px; font-weight:600">Message</td><td style="padding:12px">${r.message || 'None'}</td></tr>
                <tr><td style="padding:12px; font-weight:600">Date Requested</td><td style="padding:12px">${new Date(r.created_at).toLocaleDateString()}</td></tr>
            </table>
        </div>
    `;
    openModal('request-profile-modal');
}

async function acceptRequest(id) {
    const r = bookingRequests.find(x => x.id === id);
    if (!r) return;

    // Use the tenant's selected room and bed
    const hostelRooms = rooms[r.hostel_id] || [];
    const targetRoom = hostelRooms.find(rm => rm.num === r.room_num);
    
    if (!targetRoom) {
        showToast('Error ❌', 'Assigned room no longer exists.');
        return;
    }

    const targetBed = targetRoom.beds[r.bed_index];
    if (!targetBed || targetBed.tenant) {
        showToast('Bed Taken ❌', 'This bed is no longer available. Please reject or choose manually.');
        return;
    }

    showToast('Accepting...', 'Assigning chosen room...');

    // 1. Generate credentials
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let genPwd = 'Vustela#';
    for (let i=0; i<4; i++) genPwd += chars[Math.floor(Math.random() * chars.length)];

    // 2. Update the Bed in Database
    const { error: bedError } = await db.from('beds').update({ 
        tenant_name: r.name, 
        tenant_email: r.email, 
        tenant_password: genPwd, 
        tenant_phone: r.phone, 
        rent_status: 'pending' 
    }).eq('id', targetBed._id);

    if (bedError) {
        showToast('Error', 'Failed to assign bed: ' + bedError.message);
        return;
    }

    // 3. Mark the request as accepted
    await db.schema('public').from('room_bookings').update({ status: 'accepted' }).eq('id', id);

    // 4. Send the Greeting Email
    sendEmail(r.email, "Welcome to VUSTELA! 🏠 Application Accepted", `
        <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 40px; border: 1px solid #EEE; border-radius: 20px; background: #FFF;">
            <h2 style="color: #C84B31; margin-bottom: 20px;">Welcome to VUSTELA! 🏠</h2>
            <p style="font-size: 16px; color: #333;">Hi <strong>${r.name}</strong>,</p>
            <p style="font-size: 15px; color: #555;">Your application for <strong>Room ${targetRoom.num}</strong> at <strong>${hostels[r.hostel_id].name}</strong> has been accepted.</p>
            
            <div style="background: #F7F5F0; padding: 24px; border-radius: 12px; margin: 30px 0; border: 1px solid #E5E1DB;">
                <h3 style="margin-top: 0; color: #1A1814; font-size: 18px;">🔑 Your Login Details:</h3>
                <p style="margin: 8px 0; font-size: 15px;"><strong>Email:</strong> <span style="color: #2B5EA7;">${r.email}</span></p>
                <p style="margin: 8px 0; font-size: 15px;"><strong>Password:</strong> <code style="background: #FFF; padding: 4px 8px; border-radius: 4px; border: 1px solid #DDD;">${genPwd}</code></p>
            </div>

            <p style="font-size: 14px; color: #666; margin-bottom: 24px;">You can login here to pay rent, view receipts, and raise complaints:</p>
            
            <a href="index.html" 
               style="display: inline-block; background: #1A1814; color: #FFF; padding: 14px 28px; border-radius: 40px; text-decoration: none; font-weight: 700; font-size: 15px;">
               Login to Dashboard
            </a>

            <div style="margin-top: 40px; border-top: 1px solid #EEE; padding-top: 20px; font-size: 12px; color: #999;">
                — VUSTELA PG Hostel Management
            </div>
        </div>
    `);

    // 5. Update Local Data & UI
    targetBed.tenant = r.name;
    targetBed.tenant_email = r.email;
    targetBed.tenant_password = genPwd;
    targetBed.rentStatus = 'pending';

    renderMgrRequests();
    renderManagerOccupancy();
    renderMgrTenants();
    showToast('Accepted ✅', `Tenant assigned to Room ${targetRoom.num} and email sent.`);
}

async function rejectRequest(id) {
    const r = bookingRequests.find(x => x.id === id);
    if (!r) return;

    showToast('Rejecting...', 'Sending status update...');
    const { error } = await db.schema('public').from('room_bookings').update({ status: 'rejected' }).eq('id', id);

    if (error) {
        showToast('Error', error.message);
        return;
    }

    sendEmail(r.email, "Update on your VUSTELA PG Application", `
        <p>Hi ${r.name},</p>
        <p>Thank you for your interest in <strong>${hostels[r.hostel_id].name}</strong>.</p>
        <p>Unfortunately, we are unable to accommodate your request at this time due to high demand or lack of availability for your preferred sharing type.</p>
        <p>We wish you the best in your search.</p>
        <br>
        <p>Regards,<br>VUSTELA PG Management</p>
    `);

    renderMgrRequests();
    showToast('Rejected ❌', 'Rejection mail sent to applicant.');
}

function openAddTenantModal(prefillRoomNum = '') {
    const select = document.getElementById('at-room');
    if (!select) return;
    select.innerHTML = '';
    
    rooms[currentHostel].forEach(r => {
        const freeCount = r.capacity - r.beds.filter(b => b.tenant).length;
        if (freeCount > 0) {
            const opt = document.createElement('option');
            opt.value = r.num;
            opt.textContent = `${r.num} — ${freeCount} Free`;
            if (r.num === prefillRoomNum) opt.selected = true;
            select.appendChild(opt);
        }
    });
    
    openModal('add-tenant-modal');
}

// ============================================================
// COMPLAINTS
// ============================================================
function renderMgrComplaints(filter) {
    let list = complaints.filter(c => c.hostel === currentHostel);
    if (filter !== 'all') list = list.filter(c => c.status === filter);
    
    document.getElementById('mgr-complaints-list').innerHTML = list.map(c => `
        <div class="complaint-card">
            <div class="cc-header">
                <div><div class="cc-title">${c.subject}</div><div class="cc-meta">Room ${c.room} · ${c.tenant}</div></div>
                <span class="badge badge-${c.status === 'resolved' ? 'green' : 'yellow'}">${c.status.toUpperCase()}</span>
            </div>
            <div class="cc-desc">${c.desc}</div>
            <div class="cc-actions">
                ${c.status !== 'resolved' ? `<button class="btn-sm btn-green" onclick="resolveComplaint(${c.id})">Resolve</button>` : ''}
            </div>
        </div>
    `).join('') || '<div class="card" style="text-align:center;padding:32px">No complaints</div>';
}

async function resolveComplaint(id) {
    const { error } = await db.from('complaints').update({ status: 'resolved' }).eq('id', id);
    if (error) return;
    
    const c = complaints.find(x => x.id === id);
    if (c) c.status = 'resolved';
    renderMgrComplaints('all');
    showToast('Resolved ✅', 'Complaint marked as resolved.');
}

// ============================================================
// TOAST HELPERS
// ============================================================
function showToast(title, body) {
    const el = document.getElementById('toast');
    if (!el) return;
    document.getElementById('toast-title').textContent = title;
    document.getElementById('toast-body').textContent = body;
    el.classList.add('on');
    setTimeout(() => el.classList.remove('on'), 3500);
}

function togglePwd(btn) {
    const span = btn.previousElementSibling;
    const isHidden = span.textContent === '••••••••';
    if (isHidden) {
        span.textContent = span.getAttribute('data-pwd');
        span.style.letterSpacing = 'normal';
    } else {
        span.textContent = '••••••••';
        span.style.letterSpacing = '2px';
    }
}

// ============================================================
// MOBILE SIDEBAR
// ============================================================
function openMobileSidebar() {
    document.querySelectorAll('.sidebar').forEach(s => s.classList.add('mob-open'));
    document.getElementById('sidebar-overlay').classList.add('on');
    document.body.style.overflow = 'hidden';
}

function closeMobileSidebar() {
    document.querySelectorAll('.sidebar').forEach(s => s.classList.remove('mob-open'));
    document.getElementById('sidebar-overlay').classList.remove('on');
    document.body.style.overflow = '';
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Add event listeners for mobile sidebar
    document.querySelectorAll('.sb-link').forEach(link => {
        link.addEventListener('click', () => {
            if (window.innerWidth <= 768) closeMobileSidebar();
        });
    });
});

// ============================================================
// RENT TABLES
// ============================================================
function rentBadge(s) {
    if (s === 'paid') return '<span class="badge badge-green">✅ Paid</span>';
    if (s === 'pending') return '<span class="badge badge-yellow">⏳ Pending</span>';
    if (s === 'overdue') return '<span class="badge badge-red">🔴 Overdue</span>';
    return '';
}

function renderOwnerRentTable(filter = 'all') {
    let allBeds = [];
    [1, 2].forEach(hid => {
        if (!rooms[hid]) return;
        rooms[hid].forEach(r => {
            r.beds.forEach((b, idx) => {
                if (b.tenant) allBeds.push({ ...b, num: r.num, bedIdx: idx + 1, hostel: hid });
            });
        });
    });
    if (filter === 'paid') allBeds = allBeds.filter(b => b.rentStatus === 'paid');
    else if (filter === 'pending') allBeds = allBeds.filter(b => b.rentStatus === 'pending');
    else if (filter === 'overdue') allBeds = allBeds.filter(b => b.rentStatus === 'overdue');
    
    const table = document.getElementById('owner-rent-table');
    if (table) {
        table.innerHTML = allBeds.map(b => `
            <tr>
                <td><div class="flex gap8"><div class="ava" style="width:30px;height:30px;font-size:10px">${b.tenant.split(' ').map(x => x[0]).join('')}</div><span style="font-weight:500">${b.tenant}</span></div></td>
                <td><span class="badge badge-blue">H${b.hostel}</span></td>
                <td class="mono">${b.num} <span style="font-size:11px;color:var(--ink3)">(Bed ${b.bedIdx})</span></td>
                <td style="font-weight:600">₹${b.rent.toLocaleString()}</td>
                <td>${rentBadge(b.rentStatus)}</td>
            </tr>
        `).join('') || '<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--ink3)">No records found</td></tr>';
    }
}

function renderMgrRentTable(filter = 'all') {
    let allBeds = [];
    if (!rooms[currentHostel]) return;
    rooms[currentHostel].forEach(r => {
        r.beds.forEach((b, idx) => {
            if (b.tenant) allBeds.push({ ...b, num: r.num, bedIdx: idx });
        });
    });
    const table = document.getElementById('mgr-rent-table');
    if (table) {
        table.innerHTML = allBeds.map(b => `
            <tr>
                <td><strong>${b.tenant}</strong></td>
                <td class="mono">${b.num}</td>
                <td style="font-weight:600">₹${b.rent.toLocaleString()}</td>
                <td>${rentBadge(b.rentStatus)}</td>
                <td><button class="btn-sm btn-ghost" onclick="showToast('Reminder','Reminder sent!')">Remind</button></td>
            </tr>
        `).join('') || '<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--ink3)">No tenants found</td></tr>';
    }
}

// ============================================================
// COMPLAINTS
// ============================================================
function statusBadge(s) {
    if (s === 'resolved') return '<span class="badge badge-green">Resolved</span>';
    return '<span class="badge badge-yellow">Pending</span>';
}

function renderOwnerComplaints() {
    const list = document.getElementById('owner-complaints-list');
    if (list) {
        list.innerHTML = complaints.map(c => `
            <div class="complaint-card" style="padding:12px; border-bottom:1px solid var(--border)">
                <div class="flex between"><strong>${c.subject}</strong> ${statusBadge(c.status)}</div>
                <div style="font-size:12px; color:var(--ink3)">H${c.hostel} · Room ${c.room} · ${c.tenant}</div>
            </div>
        `).join('') || 'No complaints';
    }
}

function renderTenantComplaints() {
    if (!currentTenant) return;
    const list = document.getElementById('tenant-complaints-list');
    const myComps = complaints.filter(c => c.tenant === currentTenant.tenant_name);
    if (list) {
        list.innerHTML = myComps.map(c => `
            <div class="card" style="margin-bottom:12px">
                <div class="flex between"><strong>${c.subject}</strong> ${statusBadge(c.status)}</div>
                <p style="font-size:14px; margin:8px 0">${c.desc}</p>
            </div>
        `).join('') || 'You have no complaints';
    }
}

// ============================================================
// OTHER RENDERS
// ============================================================
function renderOwnerAllTenants() {
    const table = document.getElementById('owner-tenants-table'); // Check ID in HTML
    if (!table) return;
    // Logic to list all tenants across all hostels
}

function renderManagersTable() {
    const table = document.getElementById('owner-managers-table');
    if (table) {
        table.innerHTML = managers.map(m => `
            <tr><td>${m.email}</td><td>Hostel ${m.hostel_id}</td></tr>
        `).join('');
    }
}

function renderMgrTenants() {
    // Logic to list all tenants in current hostel
}

function renderTenantPortal() {
    if (!currentTenant) return;
    document.getElementById('t-name-sb').textContent = currentTenant.tenant_name;
    document.getElementById('t-room-sb').textContent = `Room ${currentTenant.rooms.num}`;
    // Load payment area
    document.getElementById('tenant-pay-area').innerHTML = `
        <div class="card">
            <h3>June 2025 Rent</h3>
            <div style="font-size:24px; font-weight:800; margin:12px 0">₹${currentTenant.rent.toLocaleString()}</div>
            <button class="btn btn-primary" onclick="showToast('Success','Payment initiated!')">Pay Now</button>
        </div>
    `;
}

function renderOwnerNotices() {
    const list = document.getElementById('owner-global-notices'); // Check if this ID exists or use a generic one
    if (list) {
        list.innerHTML = notices.filter(n => n.hostel_id === 0).map(n => `
            <div class="card" style="margin-bottom:12px; border-left:4px solid var(--accent)">
                <strong>${n.title}</strong>
                <p style="font-size:14px; margin:4px 0">${n.body}</p>
            </div>
        `).join('') || 'No global notices';
    }
}

function renderNotices() {
    const list = document.getElementById('notices-list');
    if (list) {
        list.innerHTML = notices.map(n => `<div class="card"><strong>${n.title}</strong></div>`).join('');
    }
}
function renderTenantFoodMenu() {}
