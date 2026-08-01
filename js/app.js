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

// Initial Default Registered Hostels (ISHTAA PRIME, VUSTELA HOSTELS)
const DEFAULT_HOSTELS = [
  { id: 1, name: "ISHTAA PRIME", loc: "NARSINGI", code: "VUS-101", slug: "isthaprime", category: "Boys PG", portalUrl: "https://vustelamanagement.com/" },
  { id: 1785479749186, name: "VUSTELA HOSTELS", loc: "KOKAPET", code: "VUS-102", slug: "vustelahostels", category: "Boys PG", portalUrl: "https://vustelamanagement.com/" }
];

// Role Features Data Dictionary
const ROLE_FEATURES = {
  owner: {
    title: "Owner Portal",
    left: [
      {
        icon: "fa-building",
        title: "Manage Multi-Hostel Network",
        desc: "Monitor total revenue, collected rent, pending dues, and net income across all hostels (ISHTAA PRIME, etc.) in real-time."
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
        title: "My Stay Summary",
        desc: "View assigned hostel, room #, bed status, joining date, and deposit status in one place."
      },
      {
        icon: "fa-clock",
        title: "Real-Time Rent Due Banner",
        desc: "Check monthly rent due date, countdown days remaining, and instant payment alerts."
      },
      {
        icon: "fa-calendar-minus",
        title: "Notice Period & Checkouts",
        desc: "Submit formal check-out notice requests and track security deposit refund status."
      }
    ],
    right: [
      {
        icon: "fa-credit-card",
        title: "Pay Rent Online",
        desc: "Scan UPI QR Code or pay via Google Pay, PhonePe, or Paytm with instant payment confirmation."
      },
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
  // Ensure default hostels (ISHTAA PRIME BOYS, ISHTAA PRIME GIRLS, VUSTELA HOSTELS) are always present
  DEFAULT_HOSTELS.forEach(def => {
    if (!state.hostels.some(h => h.id == def.id || h.name.toUpperCase().includes("ISHTAA"))) {
      state.hostels.unshift(def);
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

  // Exclude unwanted hostels & rename ISHTAA PRIME BOYS to ISHTAA PRIME per user request
  const excluded = ["ISHTAA ROYAL PALACE", "ISHTAA PRIME GIRLS", "MADHAPUR"];
  state.hostels = state.hostels.map(h => {
    if (h.name === "ISHTAA PRIME BOYS") h.name = "ISHTAA PRIME";
    return h;
  }).filter(h => h.name && !excluded.some(ex => h.name.toUpperCase().includes(ex.toUpperCase())));

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
        const existingIdx = state.hostels.findIndex(x => x.id == h.id);
        const formatted = {
          id: h.id,
          name: h.name || `Hostel #${h.id}`,
          loc: h.location || h.loc || "HYDERABAD",
          code: h.code || `VUS-${100 + h.id}`,
          category: h.category || "Boys PG",
          portalUrl: h.portal_url || h.portalUrl || "https://vustelamanagement.com/"
        };

        if (existingIdx >= 0) {
          state.hostels[existingIdx] = formatted;
        } else {
          state.hostels.push(formatted);
        }
      });

      saveState();
      renderHostels();
    }
  } catch (err) {
    console.error("Supabase connection exception:", err);
  }
}

// Render Clean Hostel Name Cards (Grouping ISHTAA PRIME into 1 card)
function renderHostels() {
  const container = document.getElementById("hostelGrid");
  if (!container) return;

  let displayList = [];
  let hasIshtaa = false;

  state.hostels.forEach(h => {
    if (h.name && h.name.toUpperCase().includes("ISHTAA")) {
      if (!hasIshtaa) {
        displayList.push({
          id: 'ishtaa_prime',
          name: "ISHTAA PRIME HOSTELS",
          loc: "NARSINGI, HYDERABAD",
          code: "VUS-101 / 102",
          category: "Boys & Girls Branches",
          isBrandGroup: true
        });
        hasIshtaa = true;
      }
    } else {
      if (h.name && !h.name.toUpperCase().includes("MADHAPUR")) {
        displayList.push(h);
      }
    }
  });

  if (!hasIshtaa && state.searchQuery === "") {
    displayList.unshift({
      id: 'ishtaa_prime',
      name: "ISHTAA PRIME HOSTELS",
      loc: "NARSINGI, HYDERABAD",
      code: "VUS-101 / 102",
      category: "Boys & Girls Branches",
      isBrandGroup: true
    });
  }

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
    window.open("hostel_app.html?action=login", "_blank");
  }
}

// Redirection & Branch Selection Routing (Directly opens hostel portal app page in NEW TAB)
function directRedirectToHostel(hostelId) {
  const hostelStr = String(hostelId);
  if (hostelStr === '1' || hostelStr === '2' || hostelStr === 'ishtaa_prime' || hostelStr.toLowerCase().includes('ishtaa')) {
    window.open("hostel_app.html#hostel-info", "_blank");
    return;
  }

  const hostel = state.hostels ? state.hostels.find(h => String(h.id) === hostelStr) : null;
  const slug = (hostel && hostel.slug) || (hostel && hostel.name ? hostel.name.toLowerCase().replace(/[^a-z0-9]/g, '') : 'vustela');
  const redirectUrl = `hostel_app.html?hostel=${slug}&hostel_id=${hostel ? hostel.id : 1}`;
  window.open(redirectUrl, "_blank");
}

function selectBranchPortal(hostelId, branchName) {
  const slug = branchName.toLowerCase().replace(/[^a-z0-9]/g, '');
  const redirectUrl = `hostel_app.html?hostel=${slug}&hostel_id=${hostelId}&hostel_name=${encodeURIComponent(branchName)}#hostel-info`;
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

  // SUPERADMIN CREDENTIAL CHECK (sampathreddyvustela4@gmail.com / 1234)
  if (
    (email === "sampathreddyvustela4@gmail.com" || email === "sampathreddyvustela4" || email === "vustelasrinivasreddy456@gmail.com" || email === "admin@vustela.com") &&
    (pass === "1234" || pass === "vustela123" || pass === "admin")
  ) {
    sessionStorage.setItem("vustela_admin_authenticated", "true");
    closeModal("gatewayLoginModal");
    alert("👑 Welcome Sampath Reddy! Opening Vustela Master Admin Portal...");
    window.location.href = "superadmin.html";
    return;
  }

  let role = 'owner';
  let hostelId = 1;

  if (supabaseClient) {
    try {
      const { data: user } = await supabaseClient.from('users').select('*').eq('email', email).eq('password', pass).single();
      if (user) {
        role = user.role;
        hostelId = user.hostel_id || 1;
      }
    } catch(e) {
      console.warn("Supabase auth lookup fallback:", e);
    }
  }

  // Store session in localStorage so hostel_app.html loads user session immediately
  localStorage.setItem('vustela_session', JSON.stringify({ role: role, email: email, password: pass, hostel_id: hostelId }));

  closeModal('gatewayLoginModal');

  // Direct user to their portal in a new tab
  const targetUrl = `hostel_app.html?action=login&role=${role}&hostel_id=${hostelId}`;
  console.log(`Directing authenticated user to portal: ${targetUrl}`);
  window.open(targetUrl, '_blank');
}

// Handle New Hostel Registration Request Submission (Sent to Super Admin Control)
async function handleNewHostelSubmit() {
  const nameEl = document.getElementById("reg_name");
  const locEl = document.getElementById("reg_loc");
  const catEl = document.getElementById("reg_category");
  const mgrEl = document.getElementById("reg_mgr");
  const phoneEl = document.getElementById("reg_phone");
  const emailEl = document.getElementById("reg_email");
  const roomsEl = document.getElementById("reg_rooms");

  const name = nameEl ? nameEl.value.trim() : "";
  const loc = locEl ? locEl.value.trim().toUpperCase() : "";
  const category = catEl ? catEl.value : "Boys PG";
  const mgr = mgrEl ? mgrEl.value.trim() : "Owner";
  const phone = phoneEl ? phoneEl.value.trim() : "";
  const email = emailEl ? emailEl.value.trim() : "vustela.hostels@gmail.com";
  const rooms = roomsEl ? roomsEl.value.trim() : "20 Rooms";

  if (!name || !loc) {
    alert("Please fill in Hostel Name and Location.");
    return;
  }

  const newId = Date.now();
  const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '');

  const regRequestObj = {
    id: newId,
    name: name,
    loc: loc,
    category: category,
    mgr: mgr || "Owner",
    phone: phone || "Not Provided",
    email: email,
    rooms: rooms,
    slug: slug,
    date: new Date().toLocaleDateString(),
    status: "Pending"
  };

  // 1. Log request to local storage for Super Admin
  state.regRequests.unshift(regRequestObj);
  saveState();

  // 2. Insert into Supabase database if connected
  if (supabaseClient) {
    try {
      await supabaseClient.from('hostel_requests').insert([regRequestObj]);
    } catch (err) {
      console.warn("Supabase integration warning:", err);
    }
  }

  // 3. Send alert notification email to vustela.hostels@gmail.com
  try {
    fetch('http://localhost:3000/api/notify-new-hostel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(regRequestObj)
    }).catch(e => console.warn('Notification fetch fallback:', e));
  } catch(e) {}

  // Reset UI elements if present
  if (nameEl) nameEl.value = "";
  if (locEl) locEl.value = "";
  if (typeof closeModal === 'function') closeModal('registerHostelModal');
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
