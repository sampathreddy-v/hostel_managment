// ============================================================
// SUPABASE CLIENT & DATA INITIALIZATION
// ============================================================
const { createClient } = supabase;
const db = createClient(
    'https://ybnkqmpjvcvbnwwudqdj.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlibmtxbXBqdmN2Ym53d3VkcWRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxMzg0MjcsImV4cCI6MjA5MzcxNDQyN30.Msd-VylS1ycp0K1LKBQxu15WqOx7jnJZ_VoIaaThprw'
);

const hostels = {
    1: { name: 'VUSTELA BOYS', loc: 'NARSINGI', mgr: 'sampath' },
    2: { name: 'VUSTELA GIRLS', loc: 'NARSINGI', mgr: 'Suresh Babu' }
};

window.rooms = { 1: [], 2: [] };
window.complaints = [];
window.notices = [];
window.foodMenu = { 1: {}, 2: {} };
window.managers = [];

async function loadData(hostelIds) {
    console.log("Starting parallel loadData for:", hostelIds);
    try {
        const [roomResults, compRes, usersRes, noticeRes, menuRes, hostelsRes] = await Promise.all([
            Promise.all(hostelIds.map(hid =>
                db.from('rooms').select('*, beds(*)').eq('hostel_id', hid).order('floor').order('num')
            )),
            db.from('complaints').select('*').in('hostel_id', hostelIds),
            db.from('users').select('*').eq('role', 'manager'),
            db.from('notices').select('*').in('hostel_id', [...hostelIds, 0]).order('created_at', { ascending: false }),
            db.from('food_menu').select('*').in('hostel_id', hostelIds),
            db.from('hostels').select('*')
        ]);

        // Process rooms
        hostelIds.forEach((hid, idx) => {
            const roomData = roomResults[idx]?.data || [];
            window.rooms[hid] = roomData.map(r => {
                const defaultRent = r.beds?.[0]?.rent || 5000;
                const filledBeds = (r.beds || []).map(b => ({ 
                    _id: b.id, 
                    tenant: b.tenant_name || '', 
                    tenant_email: b.tenant_email, 
                    tenant_phone: b.tenant_phone, 
                    tenant_password: b.tenant_password,
                    rent: b.rent, 
                    rentStatus: b.rent_status 
                }));
                while (filledBeds.length < r.capacity) filledBeds.push({ tenant: '', rent: defaultRent, rentStatus: null });
                return { _roomId: r.id, num: r.num, floor: r.floor, type: r.type, capacity: r.capacity, beds: filledBeds };
            });
        });

        // Process complaints
        if (compRes.data) {
            window.complaints = compRes.data.map(c => ({ 
                id: c.id, hostel: c.hostel_id, room: c.room_num, tenant: c.tenant_name, 
                category: c.category, subject: c.subject, desc: c.description, 
                status: c.status, date: c.created_date, cost: c.cost, bill: c.bill 
            }));
        }

        // Process managers
        if (usersRes.data) window.managers = usersRes.data;

        // Process notices
        if (noticeRes.data) window.notices = noticeRes.data;

        // Process food menu
        if (menuRes.data) {
            hostelIds.forEach(id => window.foodMenu[id] = {});
            menuRes.data.forEach(row => {
                window.foodMenu[row.hostel_id][row.day] = {
                    tiffin: row.tiffin || '',
                    lunch: row.lunch || '',
                    snacks: row.snacks || '',
                    dinner: row.dinner || ''
                };
            });
        }

        // Process hostels
        if (hostelsRes.data) {
            hostelsRes.data.forEach(h => {
                if (hostels[h.id]) {
                    hostels[h.id].name = h.name;
                    hostels[h.id].mgr = h.manager_name;
                }
            });
        }

        console.log("Parallel loadData complete");
    } catch (e) {
        console.error("Critical Data Load Error:", e);
        showToast("Sync Error", "Some data couldn't be loaded, but opening dashboard anyway.");
    }
}
