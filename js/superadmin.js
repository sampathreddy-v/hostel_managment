/**
 * Vustela Super Admin Control Center Script
 * Real-Time Request Logging & Management Engine
 */

const SUPABASE_URL = 'https://ybnkqmpjvcvbnwwudqdj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlibmtxbXBqdmN2Ym53d3VkcWRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxMzg0MjcsImV4cCI6MjA5MzcxNDQyN30.Msd-VylS1ycp0K1LKBQxu15WqOx7jnJZ_VoIaaThprw';

const MASTER_ADMIN_PIN = "1234";

let supabaseClient = null;
if (window.supabase) {
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// Initial Mock Data if empty
const INITIAL_REG_REQUESTS = [
  {
    id: 1001,
    name: "ISHTAA ROYAL PALACE",
    loc: "NARSINGI, HYDERABAD",
    category: "Boys PG",
    mgr: "K. Sampath Reddy",
    phone: "+91 98765 43210",
    date: new Date().toLocaleDateString(),
    status: "Pending"
  }
];

const INITIAL_SUB_REQUESTS = [
  {
    id: 2002,
    hostel_name: "VUSTELA HOSTELS",
    hostel_id: 1,
    plan: "Pro 4 Months Plan (7 Beds)",
    price: "₹630",
    phone: "+91 98765 43210",
    utr: "421098765432",
    screenshot: "https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=600&auto=format&fit=crop&q=80",
    date: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
    status: "Pending"
  }
];

let adminState = {
  regRequests: JSON.parse(localStorage.getItem("vustela_reg_requests")) || INITIAL_REG_REQUESTS,
  subRequests: JSON.parse(localStorage.getItem("vustela_sub_requests")) || INITIAL_SUB_REQUESTS,
  hostels: (JSON.parse(localStorage.getItem("vustela_registered_hostels")) || [
    { id: 1, name: "ISHTAA PRIME", loc: "NARSINGI", code: "VUS-101", category: "Boys PG" },
    { id: 1785479749186, name: "VUSTELA HOSTELS", loc: "KOKAPET", code: "VUS-102", category: "Boys PG" }
  ]).map(h => {
    if (h.name === "ISHTAA PRIME BOYS") h.name = "ISHTAA PRIME";
    return h;
  }).filter(h => !h.name || !["ISHTAA ROYAL PALACE", "ISHTAA PRIME GIRLS", "MADHAPUR"].some(ex => h.name.toUpperCase().includes(ex)))
};

function refreshAdminStateFromStorage() {
  const localSubs = JSON.parse(localStorage.getItem("vustela_sub_requests"));
  if (localSubs && localSubs.length > 0) {
    adminState.subRequests = localSubs;
  }
  const localRegs = JSON.parse(localStorage.getItem("vustela_reg_requests"));
  if (localRegs && localRegs.length > 0) {
    adminState.regRequests = localRegs;
  }
  updateMetrics();
  renderRegistrationRequests();
  renderSubscriptionRequests();
  if (typeof renderLiveHostels === 'function') renderLiveHostels();
}

window.addEventListener('storage', (e) => {
  if (e.key === 'vustela_sub_requests' || e.key === 'vustela_reg_requests') {
    refreshAdminStateFromStorage();
  }
});

function loadMasterUpiId() {
  const savedUpi = localStorage.getItem('vustela_saas_upi_id') || 'vustelahostels@upi';
  const el = document.getElementById('inputMasterUpiId');
  if (el) el.value = savedUpi;
}

function saveMasterUpiId() {
  const el = document.getElementById('inputMasterUpiId');
  if (!el) return;
  const newUpi = el.value.trim();
  if (!newUpi || !newUpi.includes('@')) {
    alert('Please enter a valid UPI ID (e.g. yourname@upi)');
    return;
  }
  localStorage.setItem('vustela_saas_upi_id', newUpi);
  alert(`🎉 SaaS Master UPI ID updated successfully to: ${newUpi}`);
}

function loadAdminEmail() {
  const savedEmail = localStorage.getItem('vustela_admin_email') || 'vustelasrinivasreddy456@gmail.com';
  const el = document.getElementById('inputAdminEmail');
  if (el) el.value = savedEmail;
}

function saveAdminEmail() {
  const el = document.getElementById('inputAdminEmail');
  if (!el) return;
  const newEmail = el.value.trim();
  if (!newEmail || !newEmail.includes('@')) {
    alert('Please enter a valid Gmail address (e.g. yourname@gmail.com)');
    return;
  }
  localStorage.setItem('vustela_admin_email', newEmail);
  alert(`🎉 SuperAdmin Notification Email updated successfully to: ${newEmail}`);
}

async function sendSubscriptionEmailNotification(subData) {
  const adminEmail = localStorage.getItem('vustela_admin_email') || 'vustelasrinivasreddy456@gmail.com';
  const emailEndpoint = `https://formsubmit.co/ajax/${encodeURIComponent(adminEmail)}`;

  const payload = {
    _subject: `🚨 NEW VUSTELA SUBSCRIPTION REQUEST: ${subData.hostel_name} (${subData.plan}) - ${subData.price}`,
    Hostel_Name: subData.hostel_name,
    Subscription_Plan: subData.plan,
    Amount_Paid: subData.price,
    UTR_Number: subData.utr || 'N/A',
    Owner_Phone: subData.phone || 'N/A',
    Owner_Email: subData.email || 'N/A',
    Date: subData.date || new Date().toLocaleDateString('en-IN'),
    Action_Required: 'Log in to Vustela SuperAdmin Control Center to verify payment screenshot and approve subscription.'
  };

  try {
    await fetch(emailEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    console.log('[EmailAlert] Subscription notification sent to Gmail:', adminEmail);
  } catch(err) {
    console.warn('[EmailAlert] Email notification dispatch warning:', err);
  }
}

function resetSamplePendingSubscription() {
  const sample = {
    id: Date.now(),
    hostel_name: "VUSTELA HOSTELS",
    hostel_id: 1,
    plan: "Pro 4 Months Plan (7 Beds)",
    price: "₹630",
    phone: "+91 98765 43210",
    utr: "421098765432",
    screenshot: "https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=600&auto=format&fit=crop&q=80",
    date: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
    status: "Pending"
  };

  let subs = JSON.parse(localStorage.getItem("vustela_sub_requests")) || [];
  subs.unshift(sample);
  localStorage.setItem("vustela_sub_requests", JSON.stringify(subs));

  adminState.subRequests = subs;
  updateMetrics();
  renderSubscriptionRequests();
  alert("✨ Added sample pending subscription request with UTR and Screenshot!");
}

document.addEventListener("DOMContentLoaded", () => {
  refreshAdminStateFromStorage();
  loadMasterUpiId();
  loadAdminEmail();
  // Check if session already authenticated
  if (sessionStorage.getItem("vustela_admin_authenticated") === "true") {
    unlockAdminDashboard();
  }
});

function verifyAdminPin() {
  const pinInput = document.getElementById("adminPinInput")?.value?.trim();
  if (pinInput === "1234" || pinInput === MASTER_ADMIN_PIN || pinInput === "vustela123" || pinInput === "sampathreddyvustela4@gmail.com") {
    sessionStorage.setItem("vustela_admin_authenticated", "true");
    unlockAdminDashboard();
  } else {
    alert("❌ Invalid Master Passcode! Access Denied.");
    if (document.getElementById("adminPinInput")) document.getElementById("adminPinInput").value = "";
    document.getElementById("adminPinInput")?.focus();
  }
}

function unlockAdminDashboard() {
  const overlay = document.getElementById("adminPinOverlay");
  const content = document.getElementById("adminMainContent");
  if (overlay) overlay.style.display = "none";
  if (content) content.style.display = "block";

  saveAdminState();
  updateMetrics();
  renderRegistrationRequests();
  renderSubscriptionRequests();
  renderLiveHostels();
  fetchSupabaseData();
}

function saveAdminState() {
  localStorage.setItem("vustela_reg_requests", JSON.stringify(adminState.regRequests));
  localStorage.setItem("vustela_sub_requests", JSON.stringify(adminState.subRequests));
  localStorage.setItem("vustela_registered_hostels", JSON.stringify(adminState.hostels));
}

// Toggle Admin Right Slide-Out Navigation Drawer
function toggleAdminDrawer() {
  const drawer = document.getElementById("adminNavDrawer");
  const overlay = document.getElementById("adminDrawerOverlay");
  if (drawer && overlay) {
    drawer.classList.toggle("open");
    overlay.classList.toggle("active");
  }
}

// Fetch live requests from Supabase
async function fetchSupabaseData() {
  if (!supabaseClient) return;

  try {
    const { data: regData } = await supabaseClient.from('hostel_requests').select('*');
    if (regData && regData.length > 0) {
      regData.forEach(r => {
        if (!adminState.regRequests.some(x => x.id == r.id)) {
          adminState.regRequests.unshift(r);
        }
      });
    }

    const { data: subData } = await supabaseClient.from('subscription_requests').select('*');
    if (subData && subData.length > 0) {
      subData.forEach(s => {
        if (!adminState.subRequests.some(x => x.id == s.id)) {
          adminState.subRequests.unshift(s);
        }
      });
    }

    saveAdminState();
    updateMetrics();
    renderRegistrationRequests();
    renderSubscriptionRequests();
  } catch (err) {
    console.warn("Supabase fetch warning on superadmin:", err);
  }
}

// Update Header Stat Counters
function updateMetrics() {
  const pendingRegs = adminState.regRequests.filter(r => r.status === "Pending").length;
  const pendingSubs = adminState.subRequests.filter(s => s.status === "Pending").length;
  const activeHostels = adminState.hostels.length;

  let totalRev = 0;
  adminState.subRequests.forEach(s => {
    if (s.status === "Active" || s.status === "Approved") {
      if (s.plan.includes("Pro")) totalRev += 499;
      if (s.plan.includes("Enterprise")) totalRev += 999;
    }
  });

  document.getElementById("statPendingRegs").textContent = pendingRegs;
  document.getElementById("statPendingSubs").textContent = pendingSubs;
  document.getElementById("statActiveHostels").textContent = activeHostels;
  document.getElementById("statTotalRev").textContent = `₹${totalRev.toLocaleString()}`;

  document.getElementById("countRegBadge").textContent = pendingRegs;
  document.getElementById("countSubBadge").textContent = pendingSubs;
}

// Tab Switching Logic
function switchAdminTab(tab) {
  document.querySelectorAll(".main-wrapper section").forEach(sec => sec.style.display = "none");
  document.querySelectorAll(".main-wrapper .btn-secondary").forEach(btn => {
    btn.style.background = "var(--bg-card-dark)";
    btn.style.color = "var(--text-main)";
  });

  if (tab === "registrations") {
    document.getElementById("sectionRegistrations").style.display = "block";
    document.getElementById("atab-registrations").style.background = "var(--primary-600)";
  } else if (tab === "subscriptions") {
    document.getElementById("sectionSubscriptions").style.display = "block";
    document.getElementById("atab-subscriptions").style.background = "var(--primary-600)";
  } else if (tab === "hostels") {
    document.getElementById("sectionHostels").style.display = "block";
    document.getElementById("atab-hostels").style.background = "var(--primary-600)";
  }
}

// Render Hostel Registration Requests
function renderRegistrationRequests() {
  const tbody = document.getElementById("tblRegistrationRequests");
  if (!tbody) return;

  if (adminState.regRequests.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="padding: 2rem; text-align: center; color: var(--text-muted);">
          No pending hostel registration requests found.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = adminState.regRequests.map(r => `
    <tr style="border-bottom: 1px solid rgba(255,255,255,0.06);">
      <td style="padding: 1rem; font-weight: 700; color: #fff;">${r.name}</td>
      <td style="padding: 1rem; color: var(--text-muted);">${r.loc}</td>
      <td style="padding: 1rem;"><span style="background: rgba(6,182,212,0.15); color: var(--accent-cyan); padding: 0.2rem 0.6rem; border-radius: 99px; font-size: 0.8rem; font-weight: 700;">${r.category || 'Boys PG'}</span></td>
      <td style="padding: 1rem; color: var(--text-muted);">${r.mgr || 'N/A'}</td>
      <td style="padding: 1rem; color: var(--text-muted);">${r.phone || 'N/A'}</td>
      <td style="padding: 1rem; color: var(--text-dim); font-size: 0.8rem;">${r.date || 'Today'}</td>
      <td style="padding: 1rem;">
        ${r.status === 'Approved' ? '<span style="color: #10b981; font-weight: 800;"><i class="fa-solid fa-circle-check"></i> Approved</span>' : ''}
        ${r.status === 'Rejected' ? '<span style="color: #f43f5e; font-weight: 800;"><i class="fa-solid fa-circle-xmark"></i> Rejected</span>' : ''}
        ${r.status === 'Pending' ? '<span style="color: #f59e0b; font-weight: 800;"><i class="fa-solid fa-clock"></i> Pending Approval</span>' : ''}
      </td>
      <td style="padding: 1rem; text-align: right;">
        ${r.status === 'Pending' ? `
          <button class="btn btn-emerald btn-sm" onclick="approveRegistration(${r.id})">
            <i class="fa-solid fa-check"></i> Approve & Activate
          </button>
          <button class="btn btn-secondary btn-sm" onclick="rejectRegistration(${r.id})" style="border-color: rgba(244,63,94,0.4); color: #f43f5e;">
            <i class="fa-solid fa-xmark"></i> Reject
          </button>
        ` : `<span style="font-size: 0.8rem; color: var(--text-dim);">Processed</span>`}
      </td>
    </tr>
  `).join('');
}

// Approve Hostel Registration Request
async function approveRegistration(id) {
  const req = adminState.regRequests.find(r => r.id == id);
  if (!req) return;

  req.status = "Approved";

  // Create active hostel entry
  const newHostelId = req.id;
  const newHostelCode = `VUS-${100 + adminState.hostels.length + 1}`;
  const newHostel = {
    id: newHostelId,
    name: req.name,
    loc: req.loc,
    code: newHostelCode,
    category: req.category || "Boys PG"
  };

  if (!adminState.hostels.some(h => h.id == newHostelId)) {
    adminState.hostels.push(newHostel);
  }

  saveAdminState();
  updateMetrics();
  renderRegistrationRequests();
  renderLiveHostels();

  // Update Supabase if available
  if (supabaseClient) {
    try {
      await supabaseClient.from('hostels').insert([{
        id: newHostelId,
        name: req.name,
        loc: req.loc,
        manager_name: req.mgr,
        owner_phone: req.phone,
        code: newHostelCode
      }]);
    } catch (err) {
      console.warn("Supabase insert error on approval:", err);
    }
  }

  alert(`✅ "${req.name}" approved and added to active hostels directory!`);
}

// Reject Registration Request
function rejectRegistration(id) {
  const req = adminState.regRequests.find(r => r.id == id);
  if (!req) return;

  req.status = "Rejected";
  saveAdminState();
  updateMetrics();
  renderRegistrationRequests();
}

// Render Subscription Requests
function renderSubscriptionRequests() {
  const tbody = document.getElementById("tblSubscriptionRequests");
  if (!tbody) return;

  if (adminState.subRequests.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="padding: 2rem; text-align: center; color: var(--text-muted);">
          No pending subscription requests found.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = adminState.subRequests.map(s => `
    <tr style="border-bottom: 1px solid rgba(255,255,255,0.06);">
      <td style="padding: 1rem; font-weight: 700; color: #fff;">${s.hostel_name}</td>
      <td style="padding: 1rem;"><span style="background: rgba(168,85,247,0.15); color: var(--accent-purple); padding: 0.2rem 0.6rem; border-radius: 99px; font-size: 0.8rem; font-weight: 700;">${s.plan}</span></td>
      <td style="padding: 1rem; font-weight: 800; color: #10b981;">${s.price}</td>
      <td style="padding: 1rem;"><span style="font-family: monospace; background: rgba(6,182,212,0.15); color: var(--accent-cyan); padding: 0.2rem 0.6rem; border-radius: 6px; font-weight: 700; font-size: 0.8rem;">${s.utr || 'Pending'}</span></td>
      <td style="padding: 1rem;">
        ${s.screenshot ? `
          <button class="btn btn-secondary btn-sm" onclick="viewPaymentScreenshot('${s.id}')" style="background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.2); color: #fff;">
            <i class="fa-solid fa-eye text-purple"></i> View Image
          </button>
        ` : '<span style="color: var(--text-dim); font-size: 0.8rem;">No Screenshot</span>'}
      </td>
      <td style="padding: 1rem; color: var(--text-muted);">${s.phone || 'N/A'}</td>
      <td style="padding: 1rem; color: var(--text-dim); font-size: 0.8rem;">${s.date || 'Today'}</td>
      <td style="padding: 1rem;">
        ${(s.status === 'Active' || s.status === 'Approved') ? '<span style="color: #10b981; font-weight: 800;"><i class="fa-solid fa-circle-check"></i> Active Plan</span>' : ''}
        ${s.status === 'Rejected' ? '<span style="color: #f43f5e; font-weight: 800;"><i class="fa-solid fa-circle-xmark"></i> Rejected</span>' : ''}
        ${s.status === 'Pending' ? '<span style="color: #f59e0b; font-weight: 800;"><i class="fa-solid fa-clock"></i> Pending Payment Approval</span>' : ''}
      </td>
      <td style="padding: 1rem; text-align: right;">
        ${s.status === 'Pending' ? `
          <button class="btn btn-emerald btn-sm" onclick="approveSubscription(${s.id})">
            <i class="fa-solid fa-check"></i> Grant Subscription
          </button>
          <button class="btn btn-secondary btn-sm" onclick="rejectSubscription(${s.id})" style="border-color: rgba(244,63,94,0.4); color: #f43f5e;">
            <i class="fa-solid fa-xmark"></i> Reject
          </button>
        ` : `<span style="font-size: 0.8rem; color: var(--text-dim);">Processed</span>`}
      </td>
    </tr>
  `).join('');
}

function viewPaymentScreenshot(id) {
  const sub = adminState.subRequests.find(s => s.id == id);
  if (!sub || !sub.screenshot) {
    alert('No payment screenshot available for this transaction.');
    return;
  }
  const modal = document.getElementById('screenshotModal');
  const img = document.getElementById('imgScreenshotFull');
  const lblUtr = document.getElementById('lblScreenshotUTR');
  const lblHostel = document.getElementById('lblScreenshotHostel');

  if (img) img.src = sub.screenshot;
  if (lblUtr) lblUtr.textContent = sub.utr || 'N/A';
  if (lblHostel) lblHostel.textContent = sub.hostel_name || 'VUSTELA HOSTELS';
  if (modal) modal.style.display = 'flex';
}

function closeScreenshotModal() {
  const modal = document.getElementById('screenshotModal');
  if (modal) modal.style.display = 'none';
}

// Approve Subscription
function approveSubscription(id) {
  const sub = adminState.subRequests.find(s => s.id == id);
  if (!sub) return;

  sub.status = "Active";
  if (sub.hostel_id) {
    localStorage.removeItem('vustela_sub_override_' + sub.hostel_id);
  }
  saveAdminState();
  updateMetrics();
  renderSubscriptionRequests();

  alert(`🎉 Subscription "${sub.plan}" activated for "${sub.hostel_name}"!`);
}

// Reject Subscription
function rejectSubscription(id) {
  const sub = adminState.subRequests.find(s => s.id == id);
  if (!sub) return;

  sub.status = "Rejected";
  saveAdminState();
  updateMetrics();
  renderSubscriptionRequests();
}

function editHostelSubscriptionRate(hostelId, hostelName) {
  const hId = hostelId || 1;
  const hName = hostelName || "VUSTELA HOSTELS";
  const currentRate = localStorage.getItem('vustela_hostel_bed_rate_' + hId) || '25';
  const newRatePrompt = prompt(`✏️ Edit Monthly Subscription Cost per Bed for "${hName}":\n\nEnter custom bed rate (in ₹/bed/month):`, currentRate);
  
  if (newRatePrompt !== null) {
    const parsedRate = parseFloat(newRatePrompt);
    if (isNaN(parsedRate) || parsedRate <= 0) {
      alert('Please enter a valid numeric subscription rate per bed.');
      return;
    }
    localStorage.setItem('vustela_hostel_bed_rate_' + hId, parsedRate);
    alert(`🎉 Subscription rate for "${hName}" updated to ₹${parsedRate} / bed / month!`);
    renderLiveHostels();
    renderSubscriptionRequests();
  }
}

function showHostelDetails(hostelId) {
  let h = adminState.hostels.find(item => String(item.id) === String(hostelId) || item.name === hostelId);
  if (!h) {
    const saved = JSON.parse(localStorage.getItem('vustela_registered_hostels')) || [];
    h = saved.find(item => String(item.id) === String(hostelId)) || { id: hostelId, name: 'ISHTAA PRIME', loc: 'NARSINGI', code: 'VUS-101', category: 'Coliving PG' };
  }

  const customRate = localStorage.getItem('vustela_hostel_bed_rate_' + hostelId) || '25';
  const rateVal = parseFloat(customRate);

  let totalBeds = 7;
  let occupiedBeds = 5;
  try {
    const savedRooms = JSON.parse(localStorage.getItem('vustela_rooms_' + hostelId)) || JSON.parse(localStorage.getItem('vustela_rooms')) || [];
    if (savedRooms && savedRooms.length > 0) {
      let bedCount = 0;
      let occCount = 0;
      savedRooms.forEach(r => {
        const cap = r.capacity || (r.type === 'Single' ? 1 : r.type === 'Double' ? 2 : 3);
        bedCount += cap;
        if (r.beds) {
          r.beds.forEach(b => { if (b.tenant || b.tenant_name) occCount++; });
        }
      });
      if (bedCount > 0) {
        totalBeds = bedCount;
        occupiedBeds = occCount;
      }
    }
  } catch(e){}

  const vacantBeds = Math.max(0, totalBeds - occupiedBeds);
  const totalSaaS = Math.round(totalBeds * rateVal);

  const titleEl = document.getElementById('infoHostelTitle');
  const subEl = document.getElementById('infoHostelSub');
  const bedsEl = document.getElementById('infoTotalBeds');
  const occEl = document.getElementById('infoOccupiedBeds');
  const vacEl = document.getElementById('infoVacantBeds');
  const rateEl = document.getElementById('infoSubRate');

  const locEl = document.getElementById('infoLocation');
  const codeEl = document.getElementById('infoCode');
  const ownerNameEl = document.getElementById('infoOwnerName');
  const ownerPhoneEl = document.getElementById('infoOwnerPhone');
  const planEl = document.getElementById('infoSubPlan');
  const billEl = document.getElementById('infoSaaSBill');

  if (titleEl) titleEl.textContent = h.name;
  if (subEl) subEl.textContent = `Code: ${h.code || 'VUS-101'} • ${h.category || 'Coliving PG'}`;
  if (bedsEl) bedsEl.textContent = `${totalBeds} Beds`;
  if (occEl) occEl.textContent = `${occupiedBeds} Beds`;
  if (vacEl) vacEl.textContent = `${vacantBeds} Beds`;
  if (rateEl) rateEl.textContent = `₹${rateVal}/bed/mo`;

  if (locEl) locEl.textContent = h.loc || 'NARSINGI, HYDERABAD';
  if (codeEl) codeEl.textContent = h.code || 'VUS-101';
  if (ownerNameEl) ownerNameEl.textContent = h.manager_name || h.mgr || 'K. Sampath Reddy';
  if (ownerPhoneEl) ownerPhoneEl.textContent = h.owner_phone || h.phone || '+91 98765 43210';
  
  const activeSub = adminState.subRequests.find(s => String(s.hostel_id) === String(hostelId) || s.hostel_name === h.name);
  if (planEl) planEl.textContent = activeSub ? `${activeSub.plan} (${activeSub.status})` : 'Active 15-Day Free Trial';
  if (billEl) billEl.textContent = `₹${totalSaaS.toLocaleString()} / month`;

  const btnEditRate = document.getElementById('infoBtnEditRate');
  if (btnEditRate) {
    btnEditRate.onclick = function() {
      closeHostelInfoModal();
      editHostelSubscriptionRate(hostelId, h.name);
    };
  }

  const btnOpenPortal = document.getElementById('infoBtnOpenPortal');
  if (btnOpenPortal) {
    btnOpenPortal.href = `hostel_app.html?hostel_id=${h.id}&hostel_name=${encodeURIComponent(h.name)}`;
    btnOpenPortal.target = "_blank";
  }

  const modal = document.getElementById('hostelInfoModal');
  if (modal) modal.style.display = 'flex';
}

function closeHostelInfoModal() {
  const modal = document.getElementById('hostelInfoModal');
  if (modal) modal.style.display = 'none';
}

window.showHostelDetails = showHostelDetails;
window.closeHostelInfoModal = closeHostelInfoModal;

// Render Live Hostels Directory
function renderLiveHostels() {
  const tbody = document.getElementById("tblLiveHostels");
  if (!tbody) return;

  const excluded = ["ISHTAA ROYAL PALACE", "ISHTAA PRIME GIRLS", "MADHAPUR"];
  let filtered = adminState.hostels.filter(h => h.name && !excluded.some(ex => h.name.toUpperCase().includes(ex.toUpperCase())));

  // Ensure ISHTAA PRIME is first
  filtered.sort((a, b) => {
    if (a.name.toUpperCase().includes("ISHTAA PRIME")) return -1;
    if (b.name.toUpperCase().includes("ISHTAA PRIME")) return 1;
    return 0;
  });

  tbody.innerHTML = filtered.map(h => {
    const customRate = localStorage.getItem('vustela_hostel_bed_rate_' + h.id);
    const displayRate = customRate ? `₹${customRate}/bed/mo` : '₹25/bed/mo';

    return `
      <tr style="border-bottom: 1px solid rgba(255,255,255,0.06); cursor: pointer;" onclick="showHostelDetails('${h.id}')">
        <td style="padding: 1rem; color: var(--text-dim); font-size: 0.85rem;">#${h.id}</td>
        <td style="padding: 1rem; font-weight: 700; color: #fff;">
          <span style="color: #38bdf8; text-decoration: underline;" onclick="event.stopPropagation(); showHostelDetails('${h.id}')">${h.name}</span>
        </td>
        <td style="padding: 1rem; color: var(--text-muted);">${h.loc || 'NARSINGI'}</td>
        <td style="padding: 1rem; color: var(--accent-cyan); font-weight: 700;">${h.code || 'VUS-101'}</td>
        <td style="padding: 1rem;"><span style="background: rgba(6,182,212,0.15); color: var(--accent-cyan); padding: 0.2rem 0.6rem; border-radius: 99px; font-size: 0.8rem; font-weight: 700;">${h.category || 'Boys PG'}</span></td>
        <td style="padding: 1rem; color: #10b981; font-weight: 800;" onclick="event.stopPropagation();">
          ${displayRate}
          <button onclick="editHostelSubscriptionRate('${h.id}', '${h.name}')" style="background: none; border: none; color: var(--accent-purple); cursor: pointer; margin-left: 4px;" title="Edit Price">
            <i class="fa-solid fa-pen"></i>
          </button>
        </td>
        <td style="padding: 1rem; text-align: right;" onclick="event.stopPropagation();">
          <a href="hostel_app.html?hostel_id=${h.id}&hostel_name=${encodeURIComponent(h.name)}" target="_blank" class="btn btn-primary btn-sm">
            <i class="fa-solid fa-arrow-right"></i> Open Portal
          </a>
        </td>
      </tr>
    `;
  }).join('');
}

// Clear processed requests helper
function clearAllRequests(type) {
  if (type === 'regs') {
    adminState.regRequests = adminState.regRequests.filter(r => r.status === "Pending");
  } else if (type === 'subs') {
    adminState.subRequests = adminState.subRequests.filter(s => s.status === "Pending");
  }
  saveAdminState();
  updateMetrics();
  renderRegistrationRequests();
  renderSubscriptionRequests();
}
