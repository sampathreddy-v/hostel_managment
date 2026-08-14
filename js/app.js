/**
 * Vustela Management Gateway - Direct Hostel Selection & Redirection Engine
 */

// Supabase Configuration (Matching User's Active Database)
const SUPABASE_URL = 'https://ybnkqmpjvcvbnwwudqdj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlibmtxbXBqdmN2Ym53d3VkcWRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxMzg0MjcsImV4cCI6MjA5MzcxNDQyN30.Msd-VylS1ycp0K1LKBQxu15WqOx7jnJZ_VoIaaThprw';

let supabaseClient = null;
if (window.supabase) {
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// Initial Default Registered Hostels (VUSTELA MANAGEMENT ONLY)
const DEFAULT_HOSTELS = [
  { id: 'vustela_b', name: "VUSTELA BOYS", mainHostelName: "VUSTELA MANAGEMENT", loc: "NARSINGI, HYDERABAD", code: "VUS-101", slug: "isthaaprimeboys", category: "Boys PG" },
  { id: 'vustela_g', name: "VUSTELA GIRLS", mainHostelName: "VUSTELA MANAGEMENT", loc: "NARSINGI, HYDERABAD", code: "VUS-102", slug: "isthaaprimegirls", category: "Girls PG" }
];

// Role Features Data Dictionary
const ROLE_FEATURES = {
  owner: {
    title: "Owner Portal",
    left: [
      {
        icon: "fa-building",
        title: "Manage Multi-Hostel Network",
        desc: "Monitor total revenue, collected rent, pending dues, and net income across all hostels (VUSTELA MANAGEMENT, SRINIVASA, etc.) in real-time."
      },
      {
        icon: "fa-layer-group",
        title: "Visual Room & Bed Occupancy",
        desc: "Live bed availability grid, vacant rooms tracking, and occupancy percentages across all properties."
      },
      {
        icon: "fa-user-tie",
        title: "Manage Managers & Staff",
        desc: "Add/remove hostel managers, assign specific hostels to managers, and track manager actions & staff payroll."
      }
    ],
    right: [
      {
        icon: "fa-chart-line",
        title: "Expense & Financial Logs",
        desc: "Track, categorize, and approve hostel operating expenses (electricity, groceries, water, maintenance repairs)."
      },
      {
        icon: "fa-indian-rupee-sign",
        title: "Smart Rent Collection & Dues",
        desc: "View payment statuses for every tenant, track security deposits, late fees, and auto-generate receipts."
      },
      {
        icon: "fa-brands fa-whatsapp",
        title: "Automated WhatsApp API",
        desc: "Configure UltraMsg or Meta API for instant automated WhatsApp rent receipts, checkout notices, and alerts."
      }
    ]
  },
  manager: {
    title: "Manager Portal",
    left: [
      {
        icon: "fa-list-check",
        title: "Daily Tasks & Room Grid",
        desc: "Automated daily task list for rent collections and floor-wise visual room matrix for quick bed allocation."
      },
      {
        icon: "fa-user-plus",
        title: "Onboard & Allocate Tenants",
        desc: "1-click tenant registration form to assign rooms, beds, rent rates, security deposit, and contact details."
      },
      {
        icon: "fa-bell-concierge",
        title: "Vacancy Alerts",
        desc: "Real-time warnings for rooms vacant 15+ days to follow up with leads and maximize hostel occupancy."
      }
    ],
    right: [
      {
        icon: "fa-qrcode",
        title: "Verify UPI Rent Payments",
        desc: "Review tenant payment screenshots, UTR transaction numbers, and issue instant digital receipts."
      },
      {
        icon: "fa-wrench",
        title: "Complaints Desk",
        desc: "Resolve tenant-reported repair issues (plumbing, electrical, Wi-Fi, AC) and update resolution status."
      },
      {
        icon: "fa-utensils",
        title: "Mess Menu & Notices",
        desc: "Update weekly menus for breakfast, lunch, dinner, and post gate-timing rules or emergency notices."
      }
    ]
  },
  tenant: {
    title: "Tenant Portal",
    left: [
      {
        icon: "fa-house-user",
        title: "My Bed & Rent Details",
        desc: "View assigned room number, bed number, monthly rent rate, security deposit balance, and due dates."
      },
      {
        icon: "fa-receipt",
        title: "Pay Rent & Instant Receipt",
        desc: "Pay monthly rent via UPI / QR code, upload transaction screenshots, and download official PDF rent receipts."
      },
      {
        icon: "fa-calendar-minus",
        title: "Notice Period & Checkouts",
        desc: "Submit formal check-out notice requests and track security deposit refund status."
      }
    ],
    right: [
      {
        icon: "fa-triangle-exclamation",
        title: "Raise Complaints & Tickets",
        desc: "Submit room repair tickets (plumbing leaks, electrical, Wi-Fi speed) and track status in real-time."
      },
      {
        icon: "fa-bullhorn",
        title: "Digital Notices & Mess Menu",
        desc: "View announcements, gate timing alerts, and daily food menus with meal opt-out options."
      }
    ]
  }
};

// App State
const localSavedHostels = JSON.parse(localStorage.getItem("vustela_registered_hostels"));
let state = {
  hostels: (localSavedHostels && localSavedHostels.length > 0) ? localSavedHostels : DEFAULT_HOSTELS,
  regRequests: JSON.parse(localStorage.getItem("vustela_reg_requests")) || [],
  subRequests: JSON.parse(localStorage.getItem("vustela_sub_requests")) || [],
  activeCategory: "All",
  searchQuery: "",
  targetPortalUrl: "https://vustelamanagement.com/",
  activeFeatureRole: "owner"
};

// Initialize Gateway Portal
document.addEventListener("DOMContentLoaded", () => {
  // Ensure default hostels (VUSTELA MANAGEMENT, SRINIVASA, VUSTELA HOSTELS) are always present by name
  DEFAULT_HOSTELS.forEach(def => {
    if (!state.hostels.some(h => (h.name || '').toUpperCase().trim() === def.name.toUpperCase().trim())) {
      state.hostels.push(def);
    }
  });

  // Merge any approved hostel requests into active hostels
  const approvedFromReqs = state.regRequests.filter(r => r.status === "Approved");
  approvedFromReqs.forEach(r => {
    if (!state.hostels.some(h => h.id == r.id)) {
      state.hostels.push({
        id: r.id,
        name: r.name,
        loc: r.loc || "HYDERABAD",
        code: `VUS-${100 + state.hostels.length + 1}`,
        category: r.category || "Boys PG",
        slug: (r.name || 'hostel').toLowerCase().replace(/[^a-z0-9]/g, '')
      });
    }
  });

  // Keep ONLY VUSTELA MANAGEMENT hostels
  state.hostels = state.hostels.filter(h => h.name && h.name.toUpperCase().includes("VUSTELA"));

  saveState();
  renderHostels();
  renderFeatureShowcase("owner");
  fetchHostelsFromSupabase();

  // Check if modal requested via URL (for opening register modal in new tab)
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get("modal") === "registerHostelModal" && typeof openModal === "function") {
    setTimeout(() => openModal("registerHostelModal"), 200);
  }
});

function saveState() {
  localStorage.setItem("vustela_registered_hostels", JSON.stringify(state.hostels));
  localStorage.setItem("vustela_reg_requests", JSON.stringify(state.regRequests));
  localStorage.setItem("vustela_sub_requests", JSON.stringify(state.subRequests));
}

// Hamburger Drawer Toggle
function toggleNavDrawer() {
  const drawer = document.getElementById("navDrawer");
  const overlay = document.getElementById("drawerOverlay");
  if (drawer && overlay) {
    drawer.classList.toggle("open");
    overlay.classList.toggle("active");
  }
}

// Switch Feature Showcase Role Tab
function switchFeatureRole(role) {
  state.activeFeatureRole = role;
  
  document.querySelectorAll(".features-tab-btn").forEach(btn => btn.classList.remove("active"));
  if (role === "owner") document.getElementById("ftab-owner")?.classList.add("active");
  if (role === "manager") document.getElementById("ftab-manager")?.classList.add("active");
  if (role === "tenant") document.getElementById("ftab-tenant")?.classList.add("active");

  renderFeatureShowcase(role);
}

// Render Features Showcase Columns
function renderFeatureShowcase(role) {
  const data = ROLE_FEATURES[role] || ROLE_FEATURES.owner;
  const leftCol = document.getElementById("featureColLeft");
  const rightCol = document.getElementById("featureColRight");
  const phoneTitle = document.getElementById("phoneTitle");

  if (phoneTitle) phoneTitle.textContent = `${data.title} Mobile`;

  if (leftCol) {
    leftCol.innerHTML = data.left.map(f => `
      <div class="feature-item-card">
        <div class="feature-square-icon">
          <i class="fa-solid ${f.icon}"></i>
        </div>
        <div class="feature-item-content">
          <div class="feature-item-title">${f.title}</div>
          <div class="feature-item-desc">${f.desc}</div>
        </div>
      </div>
    `).join('');
  }

  if (rightCol) {
    rightCol.innerHTML = data.right.map(f => `
      <div class="feature-item-card">
        <div class="feature-square-icon">
          <i class="fa-solid ${f.icon}"></i>
        </div>
        <div class="feature-item-content">
          <div class="feature-item-title">${f.title}</div>
          <div class="feature-item-desc">${f.desc}</div>
        </div>
      </div>
    `).join('');
  }
}

// Fetch Live Hostels from Supabase
async function fetchHostelsFromSupabase() {
  if (!supabaseClient) return;

  try {
    const { data, error } = await supabaseClient.from('hostels').select('*');
    if (error) {
      console.warn("Supabase fetch error, using local hostels cache:", error);
      return;
    }

    if (data && data.length > 0) {
      data.forEach(h => {
        const existingIdx = state.hostels.findIndex(x => String(x.id) === String(h.id) || x.name === h.name);
        const formatted = {
          id: h.id,
          name: h.name || `Hostel #${h.id}`,
          mainHostelName: h.main_hostel_name || h.mainHostelName || h.name,
          loc: h.location || h.loc || "HYDERABAD",
          code: h.code || `VUS-${100 + h.id}`,
          category: h.category || "Boys PG"
        };

        if (existingIdx >= 0) {
          state.hostels[existingIdx] = formatted;
        } else {
          state.hostels.push(formatted);
        }
      });

      state.hostels = state.hostels.filter(h => h.name && h.name.toUpperCase().includes("VUSTELA"));

      DEFAULT_HOSTELS.forEach(def => {
        if (!state.hostels.some(h => String(h.id) === String(def.id) || h.name.toUpperCase().trim() === def.name.toUpperCase().trim())) {
          state.hostels.push(def);
        }
      });

      saveState();
      renderHostels();
    }
  } catch (err) {
    console.error("Supabase connection exception:", err);
  }
}

// Render Clean Hostel Name Cards (Grouping VUSTELA MANAGEMENT into 1 card)
function getBrandName(hostel) {
  if (hostel.mainHostelName && hostel.mainHostelName.trim()) {
    let m = hostel.mainHostelName.toUpperCase().trim();
    if (!m.endsWith("HOSTELS") && !m.endsWith("HOSTEL")) m += " HOSTELS";
    return m;
  }
  let raw = (hostel.name || '').toUpperCase().trim();
  raw = raw.replace(/\b(BOYS|GIRLS|PG|BRANCH|BRANCHES)\b/gi, '').trim();
  if (!raw.endsWith("HOSTELS") && !raw.endsWith("HOSTEL")) {
    raw = raw.replace(/\bHOSTEL(S)?\b/gi, '').trim();
    if (raw) raw = `${raw} HOSTELS`;
  }
  return (raw || 'VUSTELA HOSTELS').replace(/\s+/g, ' ').trim();
}

function renderHostels() {
  const container = document.getElementById("hostelGrid");
  if (!container) return;

  let displayList = [];
  const groupsMap = new Map();

  if (Array.isArray(state.hostels)) {
    state.hostels.forEach(h => {
      const hName = (h.name || '').toUpperCase().trim();
      if (!hName || hName.includes("MADHAPUR") || hName.includes("ROYAL PALACE")) return;

      const brandKey = getBrandName(h);
      if (!groupsMap.has(brandKey)) {
        groupsMap.set(brandKey, []);
      }
      groupsMap.get(brandKey).push(h);
    });
  }

  groupsMap.forEach((branches, brandKey) => {
    const firstLoc = branches[0].loc || "HYDERABAD";
    const hasBoys = branches.some(b => (b.category || b.name || '').toUpperCase().includes('BOYS'));
    const hasGirls = branches.some(b => (b.category || b.name || '').toUpperCase().includes('GIRLS'));
    const catText = (hasBoys && hasGirls) ? "Boys & Girls Branches" : (hasGirls ? "Girls Branch" : "Boys Branch");

    displayList.push({
      id: branches[0].id,
      name: brandKey,
      loc: firstLoc,
      code: `${branches.length} Branch${branches.length !== 1 ? 'es' : ''}`,
      category: catText,
      isBrandGroup: true,
      branches: branches
    });
  });

  // Apply Category Filter
  if (state.activeCategory !== "All") {
    if (state.activeCategory === "Boys") {
      displayList = displayList.filter(h => h.category.toLowerCase().includes("boys"));
    } else if (state.activeCategory === "Girls") {
      displayList = displayList.filter(h => h.category.toLowerCase().includes("girls"));
    }
  }

  // Apply Search Filter
  if (state.searchQuery.trim() !== "") {
    const q = state.searchQuery.toLowerCase();
    displayList = displayList.filter(h => 
      h.name.toLowerCase().includes(q) || 
      (h.loc && h.loc.toLowerCase().includes(q)) || 
      (h.code && h.code.toLowerCase().includes(q))
    );
  }

  if (displayList.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1/-1; padding: 3rem; text-align: center; color: var(--text-muted); background: var(--glass-bg); border-radius: 16px;">
        <i class="fa-solid fa-building-circle-xmark" style="font-size: 3rem; margin-bottom: 1rem; color: var(--text-dim);"></i>
        <h3>No Hostels Found Matching "${state.searchQuery}"</h3>
        <p style="font-size: 0.85rem; margin-top: 0.5rem;">Click "Register New Hostel" to create a new hostel.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = displayList.map(h => `
    <div class="hostel-card-simple" onclick="directRedirectToHostel('${h.id}')" style="cursor: pointer;">
      <div style="display: flex; align-items: center; gap: 1rem;">
        <div class="hostel-name-badge-icon" style="${h.isBrandGroup ? 'background: linear-gradient(135deg, rgba(217,27,92,0.25), rgba(168,85,247,0.25)); color: #c084fc;' : ''}">
          <i class="fa-solid ${h.isBrandGroup ? 'fa-building' : 'fa-building-user'}"></i>
        </div>
        <div>
          <div class="hostel-simple-name" style="font-weight: 800; font-size: 1.1rem; color: #fff;">${h.name}</div>
          <div style="font-size: 0.8rem; color: var(--text-muted); font-weight: 600;">${h.loc || 'HYDERABAD'} ${h.isBrandGroup ? '• Boys & Girls Branches' : ''}</div>
        </div>
      </div>
      <div class="hostel-simple-icon">
        <i class="fa-solid fa-chevron-right"></i>
      </div>
    </div>
  `).join('');
}

// Search & Category Filters
function filterHostels() {
  const input = document.getElementById("hostelSearchInput");
  if (input) {
    state.searchQuery = input.value.trim();
    renderHostels();
  }
}

function filterCategory(cat) {
  state.activeCategory = cat;
  document.querySelectorAll(".section-header .btn-sm").forEach(btn => btn.style.background = "var(--bg-card-dark)");
  
  if (cat === "All") document.getElementById("cat-all").style.background = "var(--primary-600)";
  if (cat === "Boys") document.getElementById("cat-boys").style.background = "var(--primary-600)";
  if (cat === "Girls") document.getElementById("cat-girls").style.background = "var(--primary-600)";
  
  renderHostels();
}

// Auth Navigation Router (Sign In / Register Routing - Opens in New Tab)
function navigateToAuth(action) {
  if (action === "register") {
    window.open("register.html", "_blank");
  } else {
    window.open("index.html?action=login", "_blank");
  }
}

// Redirection & Branch Selection Routing (Directly opens hostel portal app page in NEW TAB)
function directRedirectToHostel(hostelId) {
  const hostelStr = String(hostelId);
  const hostel = (state.hostels || []).find(h => String(h.id) === hostelStr);
  let targetBrand = '';

  if (hostel) {
    targetBrand = hostel.mainHostelName || hostel.name || '';
  }
  
  if (!targetBrand) {
    if (hostelStr.includes('srinivasa')) targetBrand = 'SRINIVASA';
    else if (hostelStr.includes('vustela')) targetBrand = 'VUSTELA';
    else targetBrand = 'VUSTELA MANAGEMENT';
  }

  const redirectUrl = `index.html?hostel=${encodeURIComponent(targetBrand)}&hostel_id=${hostelId}#hostel-info`;
  window.open(redirectUrl, "_blank");
}

function selectBranchPortal(hostelId, branchName) {
  const slug = branchName.toLowerCase().replace(/[^a-z0-9]/g, '');
  const redirectUrl = `index.html?hostel=${slug}&hostel_id=${hostelId}&hostel_name=${encodeURIComponent(branchName)}#hostel-info`;
  window.open(redirectUrl, "_blank");
}

window.directRedirectToHostel = directRedirectToHostel;
window.selectBranchPortal = selectBranchPortal;

// Handle Gateway Login Modal Submission (Authenticates and opens user's portal in new tab)
async function handleGatewayLoginSubmit() {
  const emailInput = document.getElementById("gw_email");
  const passInput = document.getElementById("gw_pass");
  if (!emailInput || !passInput) return;

  const email = emailInput.value.trim().toLowerCase();
  const pass = passInput.value.trim();

  if (!email || !pass) {
    alert("Please enter both email/mobile and password.");
    return;
  }

  let role = 'owner';
  let hostelId = 1;

  // Check phone / email matching in registered owners
  const registeredOwners = JSON.parse(localStorage.getItem('vustela_registered_owners')) || [];
  const cleanInput = email.replace(/\D/g, '');
  const matchedOwner = registeredOwners.find(o => 
    (o.email && o.email.toLowerCase() === email.toLowerCase()) || 
    (cleanInput.length >= 10 && String(o.phone).replace(/\D/g, '') === cleanInput)
  );

  if (matchedOwner && matchedOwner.password === pass) {
    role = 'owner';
    hostelId = matchedOwner.id || 1;
    localStorage.setItem('vustela_session', JSON.stringify({ role: 'owner', phone: matchedOwner.phone, email: matchedOwner.email, password: pass, hostel_id: hostelId, name: matchedOwner.name }));
  } else if (supabaseClient) {
    try {
      const { data: user } = await supabaseClient.from('users').select('*').or(`email.eq.${email},phone.eq.${email}`).eq('password', pass).single();
      if (user) {
        role = user.role;
        hostelId = user.hostel_id || 1;
      }
    } catch(e) {
      console.warn("Supabase auth lookup fallback:", e);
    }
  }

  // Store session in localStorage so index.html loads user session immediately
  localStorage.setItem('vustela_session', JSON.stringify({ role: role, email: email, phone: cleanInput, password: pass, hostel_id: hostelId }));

  closeModal('gatewayLoginModal');

  // Direct user to their portal in a new tab
  const targetUrl = `index.html?action=login&role=${role}&hostel_id=${hostelId}`;
  console.log(`Directing authenticated user to portal: ${targetUrl}`);
  window.open(targetUrl, '_blank');
}

let activeRegisterOtp = null;
let activeForgotOtp = null;

function sendUltraMsgWhatsApp(phone, message) {
  const instanceId = localStorage.getItem('ultramsg_instance') || 'instance187011';
  const token = localStorage.getItem('ultramsg_token') || 'jdaa3d454xknt0bv';
  let cleanPhone = String(phone).replace(/\D/g, '');
  if (cleanPhone.length === 10) cleanPhone = '91' + cleanPhone;
  if (!cleanPhone.startsWith('+')) cleanPhone = '+' + cleanPhone;

  fetch(`https://api.ultramsg.com/${instanceId}/messages/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ token, to: cleanPhone, body: message })
  }).catch(err => console.warn('UltraMsg fetch error:', err));
}

function sendRegisterOTP() {
  const phoneEl = document.getElementById('reg_phone');
  const phone = phoneEl ? phoneEl.value.trim() : '';
  if (!phone || phone.length < 10) {
    alert('Please enter a valid 10-digit mobile phone number.');
    return;
  }
  activeRegisterOtp = String(Math.floor(100000 + Math.random() * 900000));
  const statusEl = document.getElementById('regOtpStatus');
  if (statusEl) {
    statusEl.style.display = 'block';
    statusEl.textContent = `✅ OTP ${activeRegisterOtp} sent to WhatsApp number +91 ${phone}!`;
  }
  sendUltraMsgWhatsApp(phone, `Your VUSTELA Owner Registration OTP is ${activeRegisterOtp}. Valid for 5 minutes.`);
  alert(`📲 OTP Sent via WhatsApp to +91 ${phone}! (Code: ${activeRegisterOtp})`);
}

function submitOwnerRegistration() {
  const nameEl = document.getElementById('reg_mgr');
  const phoneEl = document.getElementById('reg_phone');
  const otpEl = document.getElementById('reg_otp');
  const passEl = document.getElementById('reg_password');

  const name = nameEl ? nameEl.value.trim() : 'Owner';
  const phone = phoneEl ? phoneEl.value.trim() : '';
  const enteredOtp = otpEl ? otpEl.value.trim() : '';
  const pass = passEl ? passEl.value.trim() : '';

  if (!name || !phone || !pass) {
    alert('Please complete Name, Mobile Phone Number, and Password.');
    return;
  }

  if (activeRegisterOtp && enteredOtp !== activeRegisterOtp) {
    alert('Invalid OTP entered. Please enter the 6-digit OTP sent to your WhatsApp.');
    return;
  }

  const cleanPhone = phone.replace(/\D/g, '');
  const newOwner = {
    id: Date.now(),
    name: name,
    phone: cleanPhone,
    password: pass,
    role: 'owner',
    hostel_name: 'VUSTELA HOSTELS',
    created_at: new Date().toISOString()
  };

  const registeredOwners = JSON.parse(localStorage.getItem('vustela_registered_owners')) || [];
  registeredOwners.unshift(newOwner);
  localStorage.setItem('vustela_registered_owners', JSON.stringify(registeredOwners));

  // Store active session
  localStorage.setItem('vustela_session', JSON.stringify({ role: 'owner', phone: cleanPhone, password: pass, name: name, hostel_id: newOwner.id }));
  localStorage.setItem('vustela_pending_setup_owner', JSON.stringify(newOwner));

  closeModal('registerHostelModal');

  // Reveal Top Account Setup Banner & Open Setup Modal (Image 1 & 2)
  const bannerEl = document.getElementById('setupAccountBanner');
  if (bannerEl) {
    bannerEl.style.display = 'flex';
  }
  const setupNameEl = document.getElementById('setup_hostel_name');
  if (setupNameEl) setupNameEl.value = 'VUSTELA HOSTELS';
  openModal('setupAccountModal');
}

function saveAccountSetup() {
  const hostelNameEl = document.getElementById('setup_hostel_name');
  const branchNamesEl = document.getElementById('setup_branch_names');
  const locEl = document.getElementById('setup_location');

  const hostelName = hostelNameEl ? hostelNameEl.value.trim().toUpperCase() : 'VUSTELA HOSTELS';
  const branchStr = branchNamesEl ? branchNamesEl.value.trim() : '';
  const loc = locEl ? locEl.value.trim().toUpperCase() : 'NARSINGI, HYDERABAD';

  if (!hostelName || !branchStr) {
    alert('Please enter both Hostel Name and Branch Names.');
    return;
  }

  const branchList = branchStr.split(',').map(b => b.trim()).filter(Boolean);
  const registeredHostels = JSON.parse(localStorage.getItem('vustela_registered_hostels')) || [];

  branchList.forEach((bName, idx) => {
    const branchObj = {
      id: Date.now() + idx,
      name: bName.toUpperCase(),
      mainHostelName: hostelName,
      loc: loc,
      beds: '80 Total Beds',
      price: '₹7,500+ / month',
      category: idx % 2 === 0 ? 'Boys PG' : 'Girls PG',
      image: idx % 2 === 0 ? 'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&w=600&q=80' : 'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=600&q=80'
    };
    registeredHostels.unshift(branchObj);
    state.hostels.unshift(branchObj);
  });

  localStorage.setItem('vustela_registered_hostels', JSON.stringify(registeredHostels));
  saveState();
  renderHostelGrid();

  const bannerEl = document.getElementById('setupAccountBanner');
  if (bannerEl) bannerEl.style.display = 'none';

  closeModal('setupAccountModal');
  alert(`🎉 Setup Complete! ${branchList.length} branches added to your portal directory.`);
}

function sendForgotOTP() {
  const phoneEl = document.getElementById('fp_phone');
  const phone = phoneEl ? phoneEl.value.trim() : '';
  if (!phone || phone.length < 10) {
    alert('Please enter your registered mobile phone number.');
    return;
  }
  activeForgotOtp = String(Math.floor(100000 + Math.random() * 900000));
  const statusEl = document.getElementById('fpOtpStatus');
  if (statusEl) {
    statusEl.style.display = 'block';
    statusEl.textContent = `✅ Password Reset OTP ${activeForgotOtp} sent via WhatsApp!`;
  }
  sendUltraMsgWhatsApp(phone, `Your VUSTELA Password Reset OTP is ${activeForgotOtp}. Valid for 5 minutes.`);
  alert(`📲 Reset OTP Sent via WhatsApp to +91 ${phone}! (Code: ${activeForgotOtp})`);
}

function resetOwnerPassword() {
  const phoneEl = document.getElementById('fp_phone');
  const otpEl = document.getElementById('fp_otp');
  const passEl = document.getElementById('fp_password');

  const phone = phoneEl ? phoneEl.value.trim().replace(/\D/g, '') : '';
  const enteredOtp = otpEl ? otpEl.value.trim() : '';
  const newPass = passEl ? passEl.value.trim() : '';

  if (!phone || !enteredOtp || !newPass) {
    alert('Please enter your Phone Number, OTP, and New Password.');
    return;
  }

  if (activeForgotOtp && enteredOtp !== activeForgotOtp) {
    alert('Invalid OTP. Please enter the 6-digit OTP sent to your WhatsApp.');
    return;
  }

  const registeredOwners = JSON.parse(localStorage.getItem('vustela_registered_owners')) || [];
  const owner = registeredOwners.find(o => String(o.phone).replace(/\D/g, '') === phone);
  if (owner) {
    owner.password = newPass;
    localStorage.setItem('vustela_registered_owners', JSON.stringify(registeredOwners));
  }

  closeModal('forgotPasswordModal');
  alert('🔑 Password successfully reset! Logging in now...');
  localStorage.setItem('vustela_session', JSON.stringify({ role: 'owner', phone: phone, password: newPass }));
  window.open(`index.html?action=login&role=owner&phone=${phone}`, '_blank');
}

// Handle Subscription Purchase Request (Sent to Super Admin Control)
async function requestSubscription(planName, price) {
  const hostelName = prompt(`Enter your Hostel / PG Name for ${planName} subscription (${price}):`);
  if (!hostelName || hostelName.trim() === "") return;

  const phone = prompt("Enter your Mobile Number / WhatsApp Number:");
  if (!phone || phone.trim() === "") return;

  const subId = Date.now();
  const subObj = {
    id: subId,
    hostel_name: hostelName.trim().toUpperCase(),
    plan: planName,
    price: price,
    phone: phone.trim(),
    date: new Date().toLocaleDateString(),
    status: "Pending"
  };

  // 1. Log subscription request
  state.subRequests.unshift(subObj);
  saveState();

  // 2. Insert into Supabase if available
  if (supabaseClient) {
    try {
      await supabaseClient.from('subscription_requests').insert([subObj]);
    } catch (err) {
      console.warn("Supabase sub request error:", err);
    }
  }

  alert(`✅ Subscription Request Received! Plan: ${planName} (${price}) for "${hostelName}". Vustela Super Admin has logged your request.`);
}

// Modal Helpers
function openModal(id) {
  const el = document.getElementById(id);
  if (el) {
    el.classList.add("active");
    el.style.display = "flex";
  }
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) {
    el.classList.remove("active");
    el.style.display = "none";
  }
}

window.openModal = openModal;
window.closeModal = closeModal;
window.navigateToAuth = navigateToAuth;
