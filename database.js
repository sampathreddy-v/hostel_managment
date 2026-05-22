// ============================================================
// SUPABASE CLIENT & DATA INITIALIZATION
// ============================================================
const { createClient } = supabase;
const db = createClient(
    'https://ybnkqmpjvcvbnwwudqdj.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlibmtxbXBqdmN2Ym53d3VkcWRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxMzg0MjcsImV4cCI6MjA5MzcxNDQyN30.Msd-VylS1ycp0K1LKBQxu15WqOx7jnJZ_VoIaaThprw'
);

const hostels = {
    1: { name: 'VUSTELA Kokapet', mgr: 'Anil Kumar' },
    2: { name: 'VUSTELA Gachibowli', mgr: 'Suresh Babu' },
    3: { name: 'VUSTELA Madhapur', mgr: 'Kavita Reddy' }
};

window.rooms = { 1: [], 2: [], 3: [] };
window.complaints = [];
window.notices = [];
window.foodMenu = { 1: {}, 2: {}, 3: {} };
window.managers = [];

async function loadData(hostelIds) {
    console.log("Starting loadData for:", hostelIds);
    try {
        for (const hid of hostelIds) {
            const { data: roomData, error } = await db
                .from('rooms')
                .select('*, beds(*)')
                .eq('hostel_id', hid)
                .order('floor')
                .order('num');
                
            if (error) throw error;
            
            window.rooms[hid] = (roomData || []).map(r => {
                const defaultRent = r.beds[0]?.rent || 5000;
                const filledBeds = r.beds.map(b => ({ 
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
        }
        
        const { data: compData, error: compErr } = await db.from('complaints').select('*').in('hostel_id', hostelIds);
        if (compErr) throw compErr;
        if (compData) window.complaints = compData.map(c => ({ 
            id: c.id, hostel: c.hostel_id, room: c.room_num, tenant: c.tenant_name, 
            category: c.category, subject: c.subject, desc: c.description, 
            status: c.status, date: c.created_date, cost: c.cost, bill: c.bill 
        }));
        
        const { data: usersData, error: userErr } = await db.from('users').select('*').eq('role', 'manager');
        if (userErr) throw userErr;
        if (usersData) window.managers = usersData;
        
        const { data: noticeData, error: noteErr } = await db.from('notices').select('*').in('hostel_id', [...hostelIds, 0]).order('created_at', { ascending: false });
        if (noteErr) throw noteErr;
        if (noticeData) window.notices = noticeData;

        const { data: menuData, error: menuErr } = await db.from('food_menu').select('*').in('hostel_id', hostelIds);
        if (menuErr) throw menuErr;
        if (menuData) {
            hostelIds.forEach(id => window.foodMenu[id] = {});
            menuData.forEach(row => {
                window.foodMenu[row.hostel_id][row.day] = {
                    tiffin: row.tiffin || '',
                    lunch: row.lunch || '',
                    snacks: row.snacks || '',
                    dinner: row.dinner || ''
                };
            });
        }
        const { data: dbHostels } = await db.from('hostels').select('*');
        if (dbHostels) {
            dbHostels.forEach(h => {
                if (hostels[h.id]) {
                    hostels[h.id].name = h.name;
                    hostels[h.id].mgr = h.manager_name;
                }
            });
        }

        console.log("loadData complete");
    } catch (e) {
        console.error("Critical Data Load Error:", e);
        showToast("Sync Error", "Some data couldn't be loaded, but opening dashboard anyway.");
    }
}
