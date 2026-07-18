require('dotenv').config();
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const PDFDocument = require('pdfkit');

// Config
const port = process.env.PORT || 3000;

// Initialize Supabase Client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const db = createClient(supabaseUrl, supabaseKey);

const LOG_FILE = path.join(__dirname, 'sent_reports_log.json');

// --- DATABASE FETCHING & CALCULATION HELPERS ---
async function getReportData() {
    // 1. Fetch Rooms & Beds
    let rooms = [];
    try {
        const { data, error } = await db.from('rooms').select('*, beds(*)');
        if (error) throw error;
        rooms = data || [];
    } catch (err) {
        console.warn('[Scheduler] Warning: Failed to fetch rooms from DB:', err.message || err);
    }

    // 2. Fetch Expenses
    let expenses = [];
    try {
        const { data, error } = await db.from('expenses').select('*');
        if (error) throw error;
        expenses = data || [];
    } catch (err) {
        console.warn('[Scheduler] Warning: Failed to fetch expenses from DB:', err.message || err);
    }

    // 3. Fetch Complaints
    let complaints = [];
    try {
        const { data, error } = await db.from('complaints').select('*');
        if (error) throw error;
        complaints = data || [];
    } catch (err) {
        console.warn('[Scheduler] Warning: Failed to fetch complaints from DB:', err.message || err);
    }

    let totalExpected = 0;
    let totalCollected = 0;
    let totalPending = 0;
    let totalMaintenance = 0;
    let totalTenants = 0;
    let totalPaidTenants = 0;
    let totalUnpaidTenants = 0;

    const hostelStats = {
        1: { name: 'VUSTELA Kokapet', expected: 0, collected: 0, pending: 0, maintenance: 0, paidTenants: 0, unpaidTenants: 0 },
        2: { name: 'VUSTELA Gachibowli', expected: 0, collected: 0, pending: 0, maintenance: 0, paidTenants: 0, unpaidTenants: 0 },
        3: { name: 'VUSTELA Madhapur', expected: 0, collected: 0, pending: 0, maintenance: 0, paidTenants: 0, unpaidTenants: 0 }
    };

    if (rooms) {
        rooms.forEach(r => {
            const hid = r.hostel_id;
            if (hostelStats[hid] && r.beds) {
                r.beds.forEach(b => {
                    if (b.tenant_name) {
                        hostelStats[hid].expected += b.rent;
                        totalExpected += b.rent;
                        totalTenants++;
                        
                        if (b.rent_status === 'paid') {
                            hostelStats[hid].collected += b.rent;
                            totalCollected += b.rent;
                            hostelStats[hid].paidTenants++;
                            totalPaidTenants++;
                        } else {
                            hostelStats[hid].pending += b.rent;
                            totalPending += b.rent;
                            hostelStats[hid].unpaidTenants++;
                            totalUnpaidTenants++;
                        }
                    }
                });
            }
        });
    }

    if (expenses) {
        expenses.forEach(e => {
            const hid = e.hostel_id;
            if (hostelStats[hid]) {
                hostelStats[hid].maintenance += e.amount;
                totalMaintenance += e.amount;
            }
        });
    }

    return {
        totalExpected,
        totalCollected,
        totalPending,
        totalMaintenance,
        totalTenants,
        totalPaidTenants,
        totalUnpaidTenants,
        hostelStats,
        expenses: expenses || [],
        complaints: complaints || []
    };
}

// --- SERVER-SIDE PDF GENERATOR ---
function generateMonthlyPDFBuffer(data, periodName) {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ margin: 40, size: 'A4' });
        const chunks = [];

        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', err => reject(err));

        // Draw Header background rectangle
        doc.fillColor('#1A1814')
           .rect(0, 0, 595.28, 100) // A4 width is 595.28 pt, height is 841.89 pt
           .fill();

        // Title
        doc.fillColor('#FFFFFF')
           .font('Helvetica-Bold')
           .fontSize(24)
           .text('V U S T E L A', 40, 30);

        doc.font('Helvetica')
           .fontSize(10)
           .fillColor('#CCCCCC')
           .text('PREMIUM PG HOSTELS PORTAL - MONTHLY REPORT', 40, 60);

        doc.fillColor('#FFFFFF')
           .fontSize(10)
           .text(`REPORT PERIOD: ${periodName.toUpperCase()}`, 380, 30, { align: 'right', width: 175 });
        doc.text(`GENERATED: ${new Date().toLocaleDateString()}`, 380, 45, { align: 'right', width: 175 });

        // Section Title
        doc.fillColor('#1A1814')
           .font('Helvetica-Bold')
           .fontSize(18)
           .text('Financial & Occupancy Summary', 40, 130);

        // Stats boxes
        const boxY = 160;
        
        // Stats 1: Tenants
        doc.fillColor('#F7F5F0')
           .roundedRect(40, boxY, 150, 60, 4)
           .fill();
        doc.fillColor('#7A756E')
           .font('Helvetica')
           .fontSize(9)
           .text('TOTAL TENANTS', 50, boxY + 12);
        doc.fillColor('#1A1814')
           .font('Helvetica-Bold')
           .fontSize(16)
           .text(`${data.totalTenants} Active`, 50, boxY + 30);

        // Stats 2: Rent Collected
        doc.fillColor('#F7F5F0')
           .roundedRect(210, boxY, 160, 60, 4)
           .fill();
        doc.fillColor('#7A756E')
           .font('Helvetica')
           .fontSize(9)
           .text('RENT COLLECTED', 220, boxY + 12);
        doc.fillColor('#2D7D5A')
           .font('Helvetica-Bold')
           .fontSize(16)
           .text(`Rs. ${data.totalCollected.toLocaleString()}`, 220, boxY + 30);

        // Stats 3: Expenses
        doc.fillColor('#F7F5F0')
           .roundedRect(390, boxY, 160, 60, 4)
           .fill();
        doc.fillColor('#7A756E')
           .font('Helvetica')
           .fontSize(9)
           .text('MAINTENANCE SPENT', 400, boxY + 12);
        doc.fillColor('#C84B31')
           .font('Helvetica-Bold')
           .fontSize(16)
           .text(`Rs. ${data.totalMaintenance.toLocaleString()}`, 400, boxY + 30);

        // Table
        doc.fillColor('#1A1814')
           .font('Helvetica-Bold')
           .fontSize(14)
           .text('Hostel Wise Financial Breakdown', 40, 250);

        // Headers
        let tableY = 275;
        doc.fillColor('#EFECEA')
           .rect(40, tableY, 515, 20)
           .fill();
        
        doc.fillColor('#1A1814')
           .font('Helvetica-Bold')
           .fontSize(9);
        doc.text('Hostel Branch', 45, tableY + 6);
        doc.text('Expected', 180, tableY + 6);
        doc.text('Collected', 250, tableY + 6);
        doc.text('Pending', 320, tableY + 6);
        doc.text('Maintenance', 390, tableY + 6);
        doc.text('Net Income', 470, tableY + 6);

        // Rows
        doc.font('Helvetica')
           .fontSize(9);
        [1, 2, 3].forEach(hid => {
            tableY += 22;
            const stats = data.hostelStats[hid];
            const netIncome = stats.collected - stats.maintenance;

            doc.fillColor('#E5E1DB')
               .rect(40, tableY + 18, 515, 0.5)
               .fill();

            doc.fillColor('#1A1814');
            doc.text(stats.name, 45, tableY + 5);
            doc.text(`Rs. ${stats.expected.toLocaleString()}`, 180, tableY + 5);
            doc.text(`Rs. ${stats.collected.toLocaleString()}`, 250, tableY + 5);
            doc.text(`Rs. ${stats.pending.toLocaleString()}`, 320, tableY + 5);
            doc.text(`Rs. ${stats.maintenance.toLocaleString()}`, 390, tableY + 5);
            doc.text(`Rs. ${netIncome.toLocaleString()}`, 470, tableY + 5);
        });

        // Total Row
        tableY += 22;
        doc.fillColor('#EFECEA')
           .rect(40, tableY, 515, 20)
           .fill();
        
        doc.fillColor('#1A1814')
           .font('Helvetica-Bold');
        doc.text('TOTAL', 45, tableY + 6);
        doc.text(`Rs. ${data.totalExpected.toLocaleString()}`, 180, tableY + 6);
        doc.text(`Rs. ${data.totalCollected.toLocaleString()}`, 250, tableY + 6);
        doc.text(`Rs. ${data.totalPending.toLocaleString()}`, 320, tableY + 6);
        doc.text(`Rs. ${data.totalMaintenance.toLocaleString()}`, 390, tableY + 6);
        doc.text(`Rs. ${(data.totalCollected - data.totalMaintenance).toLocaleString()}`, 470, tableY + 6);

        // Simple Chart representation (horizontal bars drawn directly)
        doc.fillColor('#1A1814')
           .font('Helvetica-Bold')
           .fontSize(14)
           .text('Visual Financial Breakdown', 40, tableY + 50);

        const chartY = tableY + 80;
        const barMaxW = 350;
        const scaleVal = data.totalExpected ? barMaxW / data.totalExpected : 1;

        // Row 1: Expected Rent
        doc.fillColor('#7A756E').font('Helvetica').fontSize(9).text('Expected Rent', 40, chartY + 5);
        doc.fillColor('#2B5EA7').rect(150, chartY, data.totalExpected * scaleVal, 15).fill();
        doc.fillColor('#1A1814').text(`Rs. ${data.totalExpected.toLocaleString()}`, 160 + data.totalExpected * scaleVal, chartY + 4);

        // Row 2: Collected Rent
        doc.fillColor('#7A756E').text('Collected Rent', 40, chartY + 30);
        doc.fillColor('#2D7D5A').rect(150, chartY + 25, data.totalCollected * scaleVal, 15).fill();
        doc.fillColor('#1A1814').text(`Rs. ${data.totalCollected.toLocaleString()}`, 160 + data.totalCollected * scaleVal, chartY + 29);

        // Row 3: Maintenance spent
        doc.fillColor('#7A756E').text('Maintenance Spent', 40, chartY + 55);
        doc.fillColor('#C84B31').rect(150, chartY + 50, data.totalMaintenance * scaleVal, 15).fill();
        doc.fillColor('#1A1814').text(`Rs. ${data.totalMaintenance.toLocaleString()}`, 160 + data.totalMaintenance * scaleVal, chartY + 54);

        // Footer
        doc.fillColor('#7A756E')
           .font('Helvetica')
           .fontSize(8)
           .text('Confidential report generated for Ramesh Sharma, Owner of Vustela PG Hostels.', 40, 770);
        doc.text('Page 1 of 1', 500, 770);

        doc.end();
    });
}

// --- DIRECT SENDING LOGIC ---
async function sendEmailDirect(to, subject, html, attachment = null) {
    return new Promise((resolve, reject) => {
        const postDataObj = {
            sender: {
                name: process.env.SENDER_NAME || 'VUSTELA PG Hostel',
                email: process.env.SENDER_EMAIL
            },
            to: [{ email: to }],
            subject: subject,
            htmlContent: html
        };
        if (attachment) {
            postDataObj.attachment = attachment;
        }
        const postData = JSON.stringify(postDataObj);

        const options = {
            hostname: 'api.brevo.com',
            port: 443,
            path: '/v3/smtp/email',
            method: 'POST',
            headers: {
                'api-key': process.env.BREVO_API_KEY,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const req = https.request(options, (res) => {
            let resData = '';
            res.on('data', chunk => resData += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        resolve(JSON.parse(resData));
                    } catch (e) {
                        resolve({ success: true, message: resData });
                    }
                } else {
                    reject(new Error(`Brevo error ${res.statusCode}: ${resData}`));
                }
            });
        });
        req.on('error', err => reject(err));
        req.write(postData);
        req.end();
    });
}

function getTemplatePayload(toPhone, rawMessage) {
    // 1. Welcome / Registration Pattern
    const welcomeRegex = /Welcome to VUSTELA![\s\S]*?Hi\s+([^\n,]+),[\s\S]*?registered at \*([^*]+)\* \(Room ([^)]+)\)[\s\S]*?🔑 Login:\s*([^\n\s]+)[\s\S]*?🔑 Password:\s*([^\n\s]+)[\s\S]*?Login here:\s*([^\n\s]+)/i;
    // 1b. Booking Confirmed Welcome Pattern
    const bookingRegex = /Booking Confirmed![\s\S]*?Hi\s+([^\n,]+),[\s\S]*?booking at \*([^*]+)\* \(Room ([^)]+)\)[\s\S]*?🔑 Login:\s*([^\n\s]+)[\s\S]*?🔑 Password:\s*([^\n\s]+)/i;
    
    // 2. Rent Reminder Pattern
    const rentRegex = /Rent Reminder[\s\S]*?Hi\s+([^\n,]+),[\s\S]*?monthly rent of \*₹([^*]+)\* for \*Room ([^*]+)\* at \*([^*]+)\* is currently pending/i;
    
    // 3. Notice Pattern
    const noticeRegex = /📢 \*VUSTELA Notice:\s*([^*]+)\*\n\n([\s\S]+)/i;

    if (welcomeRegex.test(rawMessage)) {
        const match = rawMessage.match(welcomeRegex);
        return {
            messaging_product: "whatsapp",
            to: toPhone,
            type: "template",
            template: {
                name: "welcome_student",
                language: { code: "en" },
                components: [{
                    type: "body",
                    parameters: [
                        { type: "text", text: match[1].trim() },
                        { type: "text", text: match[2].trim() },
                        { type: "text", text: match[3].trim() },
                        { type: "text", text: match[4].trim() },
                        { type: "text", text: match[5].trim() },
                        { type: "text", text: match[6].trim() }
                    ]
                }]
            }
        };
    }
    
    if (bookingRegex.test(rawMessage)) {
        const match = rawMessage.match(bookingRegex);
        return {
            messaging_product: "whatsapp",
            to: toPhone,
            type: "template",
            template: {
                name: "welcome_student",
                language: { code: "en" },
                components: [{
                    type: "body",
                    parameters: [
                        { type: "text", text: match[1].trim() },
                        { type: "text", text: match[2].trim() },
                        { type: "text", text: match[3].trim() },
                        { type: "text", text: match[4].trim() },
                        { type: "text", text: match[5].trim() },
                        { type: "text", text: "https://financepro.life" }
                    ]
                }]
            }
        };
    }

    if (rentRegex.test(rawMessage)) {
        const match = rawMessage.match(rentRegex);
        return {
            messaging_product: "whatsapp",
            to: toPhone,
            type: "template",
            template: {
                name: "rent_payment_reminder",
                language: { code: "en" },
                components: [{
                    type: "body",
                    parameters: [
                        { type: "text", text: match[1].trim() },
                        { type: "text", text: match[2].trim() },
                        { type: "text", text: match[3].trim() },
                        { type: "text", text: "pending" }
                    ]
                }]
            }
        };
    }

    if (noticeRegex.test(rawMessage)) {
        const match = rawMessage.match(noticeRegex);
        return {
            messaging_product: "whatsapp",
            to: toPhone,
            type: "template",
            template: {
                name: "hostel_general_notice",
                language: { code: "en" },
                components: [{
                    type: "body",
                    parameters: [
                        { type: "text", text: match[1].trim() },
                        { type: "text", text: match[2].trim().substring(0, 1024) }
                    ]
                }]
            }
        };
    }

    return {
        messaging_product: "whatsapp",
        to: toPhone,
        type: "text",
        text: { body: rawMessage }
    };
}

async function sendWhatsappDirect(to, message) {
    return new Promise((resolve, reject) => {
        let formattedTo = to.replace(/\D/g, '');
        if (formattedTo.length === 10) {
            formattedTo = '91' + formattedTo;
        }

        const payloadObj = getTemplatePayload(formattedTo, message);
        const postData = JSON.stringify(payloadObj);

        const options = {
            hostname: 'graph.facebook.com',
            port: 443,
            path: `/v20.0/${process.env.META_PHONE_NUMBER_ID}/messages`,
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.META_ACCESS_TOKEN}`,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const req = https.request(options, (res) => {
            let resData = '';
            res.on('data', chunk => resData += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        resolve(JSON.parse(resData));
                    } catch (e) {
                        resolve({ success: true, messageId: 'unknown' });
                    }
                } else {
                    reject(new Error(`Meta error ${res.statusCode}: ${resData}`));
                }
            });
        });
        req.on('error', err => reject(err));
        req.write(postData);
        req.end();
    });
}

// --- LOGGING PERSISTENCE ---
function loadSentLog() {
    if (fs.existsSync(LOG_FILE)) {
        try {
            return JSON.parse(fs.readFileSync(LOG_FILE, 'utf8'));
        } catch (e) {
            console.error('[Scheduler] Error parsing sent log, resetting:', e);
        }
    }
    return { daily: [], monthly: [] };
}

function saveSentLog(log) {
    try {
        fs.writeFileSync(LOG_FILE, JSON.stringify(log, null, 2), 'utf8');
    } catch (e) {
        console.error('[Scheduler] Error saving sent log:', e);
    }
}

// --- TRIGGERS ---
async function triggerDailyReport() {
    console.log('[Scheduler] Triggering Daily Report...');
    const ownerEmail = process.env.OWNER_EMAIL || 'sampathreddyvustela4@gmail.com';
    const ownerPhone = process.env.OWNER_PHONE || '916300642776';

    try {
        const data = await getReportData();
        
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yestStr = yesterday.toDateString();
        const yestDateOnly = yesterday.toISOString().split('T')[0];

        // Filter complaints raised yesterday
        const yesterdayComplaints = data.complaints.filter(c => {
            if (!c.created_date) return false;
            const cDate = new Date(c.created_date).toISOString().split('T')[0];
            return cDate === yestDateOnly;
        });

        // Filter expenses yesterday
        const yesterdayExpenses = data.expenses.filter(e => {
            if (!e.created_at) return false;
            const eDate = new Date(e.created_at).toISOString().split('T')[0];
            return eDate === yestDateOnly;
        });

        const emailHtml = `
            <div style="font-family: 'DM Sans', Arial, sans-serif; background-color: #F7F5F0; padding: 30px; color: #1A1814;">
                <div style="max-width: 600px; margin: 0 auto; background-color: #FFFFFF; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.05); padding: 30px; border-top: 5px solid #C84B31;">
                    <h2 style="font-family: 'Syne', sans-serif; font-size: 24px; color: #1A1814; margin-top: 0;">VUSTELA Daily Digest</h2>
                    <p style="color: #7A756E; font-size: 13px;">Summary for yesterday: <strong>${yestStr}</strong></p>
                    
                    <hr style="border: 0; border-top: 1px solid #E5E1DB; margin: 20px 0;">
                    
                    <h3 style="color: #1A1814; font-size: 16px;">🏠 Current Collection Status</h3>
                    <table style="width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 14px;">
                        <tr>
                            <td style="padding: 8px 0; border-bottom: 1px solid #E5E1DB; color: #7A756E;">Expected Rent</td>
                            <td style="padding: 8px 0; border-bottom: 1px solid #E5E1DB; font-weight: bold; text-align: right;">₹${data.totalExpected.toLocaleString()}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; border-bottom: 1px solid #E5E1DB; color: #7A756E;">Collected Rent</td>
                            <td style="padding: 8px 0; border-bottom: 1px solid #E5E1DB; font-weight: bold; color: #2D7D5A; text-align: right;">₹${data.totalCollected.toLocaleString()} (${data.totalPaidTenants} tenants)</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; border-bottom: 1px solid #E5E1DB; color: #7A756E;">Pending Rent</td>
                            <td style="padding: 8px 0; border-bottom: 1px solid #E5E1DB; font-weight: bold; color: #C84B31; text-align: right;">₹${data.totalPending.toLocaleString()} (${data.totalUnpaidTenants} tenants)</td>
                        </tr>
                    </table>

                    <h3 style="color: #1A1814; font-size: 16px; margin-top: 25px;">🛠️ Maintenance & Complaints</h3>
                    <p style="font-size: 14px; margin-bottom: 5px;">New complaints raised: <strong>${yesterdayComplaints.length}</strong></p>
                    ${yesterdayComplaints.length > 0 
                        ? yesterdayComplaints.map(c => `<div style="font-size:13px; background:#FAEEE9; color:#C84B31; padding:8px; border-radius:4px; margin-bottom:5px;">⚠️ <strong>${c.subject}</strong> (Room ${c.room_num || 'N/A'})</div>`).join('')
                        : '<div style="font-size:13px; color:#7A756E; font-style:italic;">No complaints filed yesterday.</div>'}

                    <h3 style="color: #1A1814; font-size: 16px; margin-top: 25px;">💸 Expenses Logged Yesterday</h3>
                    <p style="font-size: 14px; margin-bottom: 5px;">New expenses: <strong>${yesterdayExpenses.length}</strong></p>
                    ${yesterdayExpenses.length > 0 
                        ? yesterdayExpenses.map(e => `<div style="font-size:13px; background:#F7F5F0; padding:8px; border-radius:4px; margin-bottom:5px;">💵 <strong>₹${e.amount.toLocaleString()}</strong> - ${e.description} (${e.category})</div>`).join('')
                        : '<div style="font-size:13px; color:#7A756E; font-style:italic;">No expenses logged yesterday.</div>'}

                    <hr style="border: 0; border-top: 1px solid #E5E1DB; margin: 30px 0;">
                    <p style="font-size: 11px; color: #7A756E; text-align: center; margin-bottom: 0;">This is an automated report generated by the VUSTELA PG Hostels System.</p>
                </div>
            </div>
        `;

        const waMessage = `📊 *VUSTELA Daily Digest* 📊\n_Report for ${yestStr}_\n\n💰 *Financial Snapshot:*\n• Expected Rent: ₹${data.totalExpected.toLocaleString()}\n• Collected: *₹${data.totalCollected.toLocaleString()}* (${data.totalPaidTenants} paid)\n• Pending: *₹${data.totalPending.toLocaleString()}* (${data.totalUnpaidTenants} unpaid)\n\n🔧 *Maintenance & Issues:*\n• New Complaints: *${yesterdayComplaints.length}*\n\n💸 *Expenses Yesterday:*\n• Total Logged: *${yesterdayExpenses.length}* new expenses\n\n👉 Login to Dashboard to view details.`;

        await sendEmailDirect(ownerEmail, `VUSTELA Daily Digest — ${yestStr}`, emailHtml);
        console.log(`[Scheduler] Daily report Email sent to: ${ownerEmail}`);

        await sendWhatsappDirect(ownerPhone, waMessage);
        console.log(`[Scheduler] Daily report WhatsApp sent to: ${ownerPhone}`);

        const log = loadSentLog();
        if (!log.daily.includes(yestDateOnly)) {
            log.daily.push(yestDateOnly);
            saveSentLog(log);
        }
    } catch (e) {
        console.error('[Scheduler] Error running daily report:', e);
    }
}

async function triggerMonthlyReport() {
    console.log('[Scheduler] Triggering Monthly Report...');
    const ownerEmail = process.env.OWNER_EMAIL || 'sampathreddyvustela4@gmail.com';
    const ownerPhone = process.env.OWNER_PHONE || '916300642776';

    try {
        const data = await getReportData();

        const now = new Date();
        const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const monthName = prevMonth.toLocaleString('en-US', { month: 'long' });
        const year = prevMonth.getFullYear();
        const periodName = `${monthName} ${year}`;
        const logMonth = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}`;

        const pdfBuffer = await generateMonthlyPDFBuffer(data, periodName);
        const base64Pdf = pdfBuffer.toString('base64');

        const emailHtml = `
            <div style="font-family: 'DM Sans', Arial, sans-serif; background-color: #F7F5F0; padding: 30px; color: #1A1814;">
                <div style="max-width: 600px; margin: 0 auto; background-color: #FFFFFF; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.05); padding: 30px; border-top: 5px solid #2D7D5A;">
                    <h2 style="font-family: 'Syne', sans-serif; font-size: 24px; color: #1A1814; margin-top: 0;">VUSTELA Monthly Summary</h2>
                    <p style="color: #7A756E; font-size: 13px;">Financial Report for <strong>${periodName}</strong></p>
                    
                    <hr style="border: 0; border-top: 1px solid #E5E1DB; margin: 20px 0;">
                    
                    <p>Dear Owner,</p>
                    <p>Please find attached the official PDF financial report for <strong>${periodName}</strong> containing detailed tables, tenant stats, and charts of income vs expenses.</p>
                    
                    <h3 style="color: #1A1814; font-size: 16px; margin-top: 25px;">📊 Monthly Highlights</h3>
                    <table style="width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 14px;">
                        <tr>
                            <td style="padding: 8px 0; border-bottom: 1px solid #E5E1DB; color: #7A756E;">Occupancy Rate</td>
                            <td style="padding: 8px 0; border-bottom: 1px solid #E5E1DB; font-weight: bold; text-align: right;">${data.totalTenants} Active Tenants</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; border-bottom: 1px solid #E5E1DB; color: #7A756E;">Total Collected Rent</td>
                            <td style="padding: 8px 0; border-bottom: 1px solid #E5E1DB; font-weight: bold; color: #2D7D5A; text-align: right;">₹${data.totalCollected.toLocaleString()}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; border-bottom: 1px solid #E5E1DB; color: #7A756E;">Total Spent (Maintenance)</td>
                            <td style="padding: 8px 0; border-bottom: 1px solid #E5E1DB; font-weight: bold; color: #C84B31; text-align: right;">₹${data.totalMaintenance.toLocaleString()}</td>
                        </tr>
                        <tr style="background:#EBF5EF">
                            <td style="padding: 8px; font-weight: bold;">Net Profit</td>
                            <td style="padding: 8px; font-weight: bold; color: #2D7D5A; text-align: right;">₹${(data.totalCollected - data.totalMaintenance).toLocaleString()}</td>
                        </tr>
                    </table>

                    <p style="margin-top: 25px;">The detailed PDF report is attached to this email.</p>
                    
                    <hr style="border: 0; border-top: 1px solid #E5E1DB; margin: 30px 0;">
                    <p style="font-size: 11px; color: #7A756E; text-align: center; margin-bottom: 0;">This is an automated report generated by the VUSTELA PG Hostels System.</p>
                </div>
            </div>
        `;

        const waMessage = `📈 *VUSTELA Monthly Summary* 📈\n_Report for ${periodName}_\n\n📋 *Overall Highlights:*\n• Active Tenants: *${data.totalTenants}*\n• Collected Rent: *₹${data.totalCollected.toLocaleString()}*\n• Spent (Maintenance): *₹${data.totalMaintenance.toLocaleString()}*\n• Net Profit: *₹${(data.totalCollected - data.totalMaintenance).toLocaleString()}*\n\n✉️ The detailed PDF report containing charts and itemized transactions has been sent to your registered Gmail address: ${ownerEmail}.\n\nThank you for using VUSTELA PG Hostels!`;

        const attachment = [
            {
                content: base64Pdf,
                name: `VUSTELA_Hostel_Report_${monthName}_${year}.pdf`
            }
        ];

        await sendEmailDirect(ownerEmail, `VUSTELA Financial Report — ${periodName}`, emailHtml, attachment);
        console.log(`[Scheduler] Monthly report Email with PDF sent to: ${ownerEmail}`);

        await sendWhatsappDirect(ownerPhone, waMessage);
        console.log(`[Scheduler] Monthly report WhatsApp sent to: ${ownerPhone}`);

        const log = loadSentLog();
        if (!log.monthly.includes(logMonth)) {
            log.monthly.push(logMonth);
            saveSentLog(log);
        }
    } catch (e) {
        console.error('[Scheduler] Error running monthly report:', e);
    }
}

// --- RESET MONTHLY RENTS ---
async function resetMonthlyRents() {
    console.log('[Scheduler] Executing monthly rent status reset...');
    try {
        const { data, error } = await db.from('beds')
            .update({ rent_status: 'pending' })
            .not('tenant_name', 'is', null);
            
        if (error) throw error;
        console.log('[Scheduler] Successfully reset all occupied beds rent status to pending.');
    } catch (e) {
        console.error('[Scheduler] Error resetting monthly rents:', e);
        throw e;
    }
}

// --- SCHEDULER CHECK LOOP ---
async function checkScheduler() {
    const now = new Date();
    const currentHour = now.getHours();
    
    if (currentHour === 9) {
        const log = loadSentLog();
        const todayStr = now.toISOString().split('T')[0];
        
        if (!log.daily.includes(todayStr)) {
            await triggerDailyReport();
        }
        
        const currentDay = now.getDate();
        if (currentDay === 1) {
            const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`; // YYYY-MM
            
            // 1. Reset Rent status for the new month
            if (!log.rent_reset) log.rent_reset = [];
            if (!log.rent_reset.includes(currentMonthStr)) {
                try {
                    await resetMonthlyRents();
                    log.rent_reset.push(currentMonthStr);
                    saveSentLog(log);
                } catch (e) {
                    console.error('[Scheduler] Failed to reset rents in schedule:', e);
                }
            }

            // 2. Send Monthly Report (for previous month)
            const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const logMonth = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}`;
            if (!log.monthly.includes(logMonth)) {
                await triggerMonthlyReport();
            }
        }
    }
}

function startScheduler() {
    console.log('[Scheduler] Starting automated reports background scheduler loop...');
    setInterval(checkScheduler, 60 * 60 * 1000); // 1 hour
    setTimeout(checkScheduler, 5000); // Trigger check 5 seconds after boot
}

const server = http.createServer((req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    if (req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const data = JSON.parse(body);

                // --- WHATSAPP (META CLOUD API) ---
                if (req.url === '/send-whatsapp') {
                    const { to, message } = data;
                    if (!to || !message) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        return res.end(JSON.stringify({ error: 'Missing "to" or "message"' }));
                    }

                    console.log(`\n[Server] Received request to send WhatsApp to: ${to}`);

                    // Clean phone number format for Meta (numbers only, e.g., 919876543210)
                    let formattedTo = to.replace(/\D/g, '');
                    if (formattedTo.length === 10) {
                        formattedTo = '91' + formattedTo; // Default to India country code if 10 digits
                    }

                    const payloadObj = getTemplatePayload(formattedTo, message);
                    const postData = JSON.stringify(payloadObj);

                    const options = {
                        hostname: 'graph.facebook.com',
                        port: 443,
                        path: `/v20.0/${process.env.META_PHONE_NUMBER_ID}/messages`,
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${process.env.META_ACCESS_TOKEN}`,
                            'Content-Type': 'application/json',
                            'Content-Length': Buffer.byteLength(postData)
                        }
                    };

                    const metaReq = https.request(options, (metaRes) => {
                        let responseData = '';
                        metaRes.on('data', (d) => responseData += d);
                        metaRes.on('end', () => {
                            let result = {};
                            try {
                                result = JSON.parse(responseData);
                            } catch (e) {
                                console.error('[Server] Failed to parse Meta response:', responseData);
                            }

                            if (metaRes.statusCode >= 200 && metaRes.statusCode < 300) {
                                console.log(`[Server] WhatsApp Message sent successfully via Meta! Message ID: ${result.messages?.[0]?.id}`);
                                res.writeHead(200, { 'Content-Type': 'application/json' });
                                res.end(JSON.stringify({ success: true, messageId: result.messages?.[0]?.id }));
                            } else {
                                console.error(`[Server] Meta API Error (Status ${metaRes.statusCode}):`, result.error?.message || responseData);
                                res.writeHead(metaRes.statusCode, { 'Content-Type': 'application/json' });
                                res.end(JSON.stringify({ error: result.error?.message || 'Meta API Error' }));
                            }
                        });
                    });

                    metaReq.on('error', (e) => {
                        console.error('[Server] Meta Request Failed:', e);
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Failed to connect to Meta' }));
                    });

                    metaReq.write(postData);
                    metaReq.end();
                }

                // --- EMAIL (BREVO API) ---
                else if (req.url === '/send-email') {
                    const { to, subject, html, attachment } = data;
                    if (!to || !subject || !html) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        return res.end(JSON.stringify({ error: 'Missing "to", "subject", or "html"' }));
                    }

                    console.log(`\n[Server] Received request to send Email to: ${to}`);

                    try {
                        const result = await sendEmailDirect(to, subject, html, attachment);
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: true, messageId: result.messageId }));
                    } catch (err) {
                        console.error('[Server] Send Email Error:', err);
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: err.message }));
                    }
                }

                // --- TEST DAILY REPORT ---
                else if (req.url === '/test-daily-report') {
                    console.log('[Server] Manual trigger of Daily Report test');
                    try {
                        await triggerDailyReport();
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: true, message: 'Daily report triggered successfully.' }));
                    } catch (err) {
                        console.error('[Server] Test Daily Report Error:', err);
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: err.message }));
                    }
                }

                // --- TEST MONTHLY REPORT ---
                else if (req.url === '/test-monthly-report') {
                    console.log('[Server] Manual trigger of Monthly Report test');
                    try {
                        await triggerMonthlyReport();
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: true, message: 'Monthly report triggered successfully.' }));
                    } catch (err) {
                        console.error('[Server] Test Monthly Report Error:', err);
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: err.message }));
                    }
                }

                // --- TEST RENT RESET ---
                else if (req.url === '/test-rent-reset') {
                    console.log('[Server] Manual trigger of Rent Reset test');
                    try {
                        await resetMonthlyRents();
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: true, message: 'Rent reset triggered successfully.' }));
                    } catch (err) {
                        console.error('[Server] Test Rent Reset Error:', err);
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: err.message }));
                    }
                }

                else {
                    res.writeHead(404, { 'Content-Type': 'text/plain' });
                    res.end('Not Found');
                }
            } catch (err) {
                console.error('[Server] Request error:', err);
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid JSON' }));
            }
        });
    } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
    }
});

server.listen(port, () => {
    console.log(`=========================================`);
    console.log(`🚀 VUSTELA Relay Server is running!`);
    console.log(`📡 Listening for WhatsApp & Email on http://localhost:${port}`);
    console.log(`=========================================`);
    
    // Start automated scheduler
    startScheduler();
});

