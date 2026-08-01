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
        1: { name: 'ISHTAA PRIME BOYS', expected: 0, collected: 0, pending: 0, maintenance: 0, paidTenants: 0, unpaidTenants: 0 },
        2: { name: 'ISHTAA PRIME GIRLS', expected: 0, collected: 0, pending: 0, maintenance: 0, paidTenants: 0, unpaidTenants: 0 }
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
        [1, 2].forEach(hid => {
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
    return new Promise(async (resolve, reject) => {
        let formattedTo = to.replace(/\D/g, '');
        if (formattedTo.length === 10) {
            formattedTo = '91' + formattedTo;
        }

        // 1. Try UltraMsg API if configured in env
        const umInst = (process.env.ULTRAMSG_INSTANCE_ID || '').trim();
        const umTok = (process.env.ULTRAMSG_TOKEN || '').trim();
        if (umInst && umTok) {
            try {
                const postData = new URLSearchParams({ token: umTok, to: formattedTo, body: message }).toString();
                const options = {
                    hostname: 'api.ultramsg.com',
                    port: 443,
                    path: `/${umInst}/messages/chat`,
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Content-Length': Buffer.byteLength(postData)
                    }
                };
                const req = https.request(options, res => {
                    let resData = '';
                    res.on('data', chunk => resData += chunk);
                    res.on('end', () => {
                        try {
                            const result = JSON.parse(resData);
                            if (result && (result.sent === 'true' || result.id)) return resolve(result);
                        } catch (e) {}
                        console.warn('[UltraMsg Server Notice]', resData);
                    });
                });
                req.on('error', () => {});
                req.write(postData);
                req.end();
            } catch (e) {
                console.warn('[UltraMsg Server Error]:', e.message);
            }
        }

        // 2. Try Meta WhatsApp Cloud API
        const metaPhoneId = (process.env.META_PHONE_NUMBER_ID || '').trim();
        const metaToken = (process.env.META_ACCESS_TOKEN || '').trim();

        if (!metaPhoneId || !metaToken) {
            return reject(new Error('WhatsApp API Credentials missing. Configure META_PHONE_NUMBER_ID & META_ACCESS_TOKEN or ULTRAMSG_INSTANCE_ID in .env, or use direct WhatsApp link.'));
        }

        const payloadObj = getTemplatePayload(formattedTo, message);
        const postData = JSON.stringify(payloadObj);

        const options = {
            hostname: 'graph.facebook.com',
            port: 443,
            path: `/v20.0/${metaPhoneId}/messages`,
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${metaToken}`,
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
    const ownerEmail = process.env.OWNER_EMAIL || 'ishtaaprimeboyshostel@gmail.com';
    const ownerPhone = process.env.OWNER_PHONE || '919949038383';

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
    const ownerEmail = process.env.OWNER_EMAIL || 'ishtaaprimeboyshostel@gmail.com';
    const ownerPhone = process.env.OWNER_PHONE || '919949038383';

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

async function processBankAlertText(rawText) {
    if (!rawText || typeof rawText !== 'string') return { matched: [], count: 0, utrsFound: [] };
    
    // Extract all 12-digit numeric sequences (UTRs)
    const utrMatches = rawText.match(/\b\d{12}\b/g) || [];
    const uniqueUtrs = [...new Set(utrMatches)];
    
    // Extract credited amount (e.g. Rs:5.00, Rs. 5, Rs 5000, INR 5500)
    let extractedAmt = null;
    const amtRegex = /(?:Rs\.?|INR|₹|Credited for Rs:?)\s*:?\s*([\d,]+(?:\.\d{1,2})?)/i;
    const amtMatch = rawText.match(amtRegex);
    if (amtMatch) {
        const clean = amtMatch[1].replace(/,/g, '');
        if (!isNaN(Number(clean))) extractedAmt = Number(clean);
    }

    if (uniqueUtrs.length === 0 && !extractedAmt) {
        return { matched: [], count: 0, utrsFound: [] };
    }

    console.log(`[BankReconcile] Scanning text. Extracted UTRs: ${uniqueUtrs.join(', ')} | Extracted Amount: ₹${extractedAmt}`);

    let approvedSubmissions = [];

    // Helper to approve sub
    const approveSub = async (sub, utrToUse) => {
        // 1. Mark submission as approved
        await supabase
            .from('payment_submissions')
            .update({ 
                status: 'approved',
                utr_number: utrToUse || sub.utr_number
            })
            .eq('id', sub.id);

        // 2. Mark bed rent as paid
        try {
            if (sub.bed_id) {
                await supabase.from('beds').update({ rent_status: 'paid' }).eq('id', sub.bed_id);
            }
            if (sub.tenant_email) {
                await supabase.from('beds').update({ rent_status: 'paid' }).ilike('tenant_email', sub.tenant_email.trim());
            }
        } catch (bedErr) {
            console.warn('[BankReconcile] Bed update notice:', bedErr);
        }

        // 3. Log in rent_history safely
        try {
            const now = new Date();
            const monthName = now.toLocaleString('default', { month: 'short' });
            const monthNum = now.getMonth() + 1;
            const year = now.getFullYear();

            await supabase.from('rent_history').insert([{
                bed_id: sub.bed_id || 1,
                tenant_name: sub.tenant_name,
                tenant_email: sub.tenant_email,
                room_num: sub.room_num,
                hostel_id: sub.hostel_id || 1,
                month: sub.payment_month || monthName,
                month_num: monthNum,
                year: sub.payment_year || year,
                rent_amount: sub.amount_claimed,
                rent_status: 'paid',
                start_date: new Date(year, monthNum - 1, 1).toISOString().split('T')[0],
                end_date: new Date(year, monthNum, 0).toISOString().split('T')[0]
            }]);
        } catch (rhErr) {
            console.warn('[BankReconcile] Rent history notice:', rhErr);
        }

        // 4. Send WhatsApp & Email receipt if phone / email exists
        const receiptMsg = `🎉 *Payment Confirmed!*\n\nDear ${sub.tenant_name}, your rent payment of *₹${Number(sub.amount_claimed).toLocaleString()}* for Room *${sub.room_num}* has been verified and confirmed.\n\nUTR: ${utrToUse || sub.utr_number}\nStatus: Paid ✅\n\n— VUSTELA PG Hostels`;

        if (sub.tenant_phone) {
            try { await sendWhatsappDirect(sub.tenant_phone, receiptMsg); } catch (waErr) {}
        }
        if (sub.tenant_email) {
            try {
                const emailHtml = `<div style="font-family:sans-serif; padding:20px; border:1px solid #e2e8f0; border-radius:8px;">
                    <h2 style="color:#10b981;">Payment Verified & Confirmed ✅</h2>
                    <p>Hi <strong>${sub.tenant_name}</strong>,</p>
                    <p>Your rent payment of <strong>₹${Number(sub.amount_claimed).toLocaleString()}</strong> for Room <strong>${sub.room_num}</strong> has been verified and logged successfully.</p>
                    <hr style="border:none; border-top:1px solid #e2e8f0; margin:20px 0;">
                    <p><strong>UTR Reference:</strong> ${utrToUse || sub.utr_number}</p>
                    <p><strong>Status:</strong> Paid</p>
                    <br>
                    <p>Thank you,<br><strong>VUSTELA Hostels</strong></p>
                </div>`;
                await sendEmailDirect(sub.tenant_email, `Payment Receipt — Room ${sub.room_num}`, emailHtml);
            } catch (emErr) {}
        }

        approvedSubmissions.push({
            id: sub.id,
            tenant_name: sub.tenant_name,
            room_num: sub.room_num,
            utr: utrToUse || sub.utr_number,
            amount: sub.amount_claimed
        });
    };

    // First pass: UTR exact match
    for (const utr of uniqueUtrs) {
        try {
            const { data: pendingList } = await supabase
                .from('payment_submissions')
                .select('*')
                .eq('utr_number', utr)
                .eq('status', 'pending');

            if (pendingList && pendingList.length > 0) {
                for (const sub of pendingList) {
                    await approveSub(sub, utr);
                }
            }
        } catch (err) {
            console.error(`[BankReconcile] Error processing UTR ${utr}:`, err);
        }
    }

    // Second pass: If UTR match found no rows, but amount match exists
    if (approvedSubmissions.length === 0 && extractedAmt && extractedAmt > 0) {
        try {
            const { data: amountList } = await supabase
                .from('payment_submissions')
                .select('*')
                .eq('amount_claimed', extractedAmt)
                .eq('status', 'pending');

            if (amountList && amountList.length > 0) {
                const primaryUtr = uniqueUtrs.length > 0 ? uniqueUtrs[0] : null;
                for (const sub of amountList) {
                    await approveSub(sub, primaryUtr);
                }
            }
        } catch (err) {
            console.error(`[BankReconcile] Amount matching error:`, err);
        }
    }

    return {
        matched: approvedSubmissions,
        count: approvedSubmissions.length,
        utrsFound: uniqueUtrs
    };
}

function startScheduler() {
    console.log('[Scheduler] Starting automated reports background scheduler loop...');
    setInterval(checkScheduler, 60 * 60 * 1000); // 1 hour
    setTimeout(checkScheduler, 5000); // Trigger check 5 seconds after boot
}

const receivedBankSmsCache = []; // Global in-memory cache of incoming bank SMS UTRs

const server = http.createServer((req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    if (req.url.startsWith('/api/check-utr-status')) {
        const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
        const utr = urlObj.searchParams.get('utr');
        const isMatched = receivedBankSmsCache.some(item => item.utr === utr);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ matched: isMatched, utr }));
    }

    if (req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                let data = {};
                try { data = JSON.parse(body); } catch (e) {}

                // --- BANK SMS / EMAIL RECONCILIATION ENDPOINTS ---
                if (req.url === '/api/bank-sms' || req.url === '/api/inbound-bank-email' || req.url === '/api/reconcile-bank-text') {
                    const alertText = data.text || data.body || data.message || body || '';
                    console.log(`\n[Server] Received Bank Alert Text on ${req.url}:`, alertText.substring(0, 100));
                    
                    // Log UTRs in memory cache for reverse lookup
                    const utrMatches = alertText.match(/\b\d{12}\b/g) || [];
                    utrMatches.forEach(utr => {
                        receivedBankSmsCache.push({ utr, time: Date.now() });
                    });

                    const result = await processBankAlertText(alertText);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ 
                        success: true, 
                        matchedCount: result.count,
                        approved: result.matched,
                        utrsFound: result.utrsFound 
                    }));
                }

                // --- WHATSAPP (META CLOUD API) ---
                if (req.url === '/send-whatsapp') {
                    const { to, message } = data;
                    if (!to || !message) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        return res.end(JSON.stringify({ error: 'Missing "to" or "message"' }));
                    }

                    console.log(`\n[Server] Received request to send WhatsApp to: ${to}`);

                    let formattedTo = to.replace(/\D/g, '');
                    if (formattedTo.length === 10) formattedTo = '91' + formattedTo;

                    const sendMetaPayload = (payloadObj, callback) => {
                        const postData = JSON.stringify(payloadObj);
                        const options = {
                            hostname: 'graph.facebook.com',
                            port: 443,
                            path: `/v20.0/${process.env.META_PHONE_NUMBER_ID}/messages`,
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${(process.env.META_ACCESS_TOKEN || '').trim()}`,
                                'Content-Type': 'application/json',
                                'Content-Length': Buffer.byteLength(postData)
                            }
                        };
                        const metaReq = https.request(options, (metaRes) => {
                            let responseData = '';
                            metaRes.on('data', (d) => responseData += d);
                            metaRes.on('end', () => {
                                let result = {};
                                try { result = JSON.parse(responseData); } catch (e) {}
                                if (metaRes.statusCode >= 200 && metaRes.statusCode < 300) {
                                    callback(null, result);
                                } else {
                                    callback(new Error(result.error?.message || `Meta API Error ${metaRes.statusCode}`));
                                }
                            });
                        });
                        metaReq.on('error', (e) => callback(e));
                        metaReq.write(postData);
                        metaReq.end();
                    };

                    // 1. First attempt: Send freeform text message
                    const textPayload = {
                        messaging_product: "whatsapp",
                        to: formattedTo,
                        type: "text",
                        text: { body: message }
                    };

                    sendMetaPayload(textPayload, (err1, res1) => {
                        if (!err1 && res1 && res1.messages?.[0]?.id) {
                            console.log(`[Server] WhatsApp freeform text sent successfully via Meta! ID: ${res1.messages[0].id}`);
                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            return res.end(JSON.stringify({ success: true, messageId: res1.messages[0].id }));
                        }

                        // 2. Second attempt: Send template payload
                        const templatePayload = getTemplatePayload(formattedTo, message);
                        sendMetaPayload(templatePayload, (err2, res2) => {
                            if (!err2 && res2 && res2.messages?.[0]?.id) {
                                console.log(`[Server] WhatsApp template message sent successfully via Meta! ID: ${res2.messages[0].id}`);
                                res.writeHead(200, { 'Content-Type': 'application/json' });
                                return res.end(JSON.stringify({ success: true, messageId: res2.messages[0].id }));
                            }

                            console.warn(`[Server] Meta API Notice for ${formattedTo}: ${err2?.message || err1?.message}`);
                            const manualUrl = `https://wa.me/${formattedTo}?text=${encodeURIComponent(message)}`;
                            res.writeHead(400, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ 
                                error: err2?.message || err1?.message || 'Meta 24-hour customer window required.',
                                fallbackUrl: manualUrl
                            }));
                        });
                    });
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

                // --- ROOM BOOKING NOTIFICATION (MANAGER & OWNER - WHATSAPP & GMAIL) ---
                else if (req.url === '/send-booking-notification') {
                    const { name, email, phone, hostel_id, room_num, sharing, message, doj, idtype } = data;

                    console.log(`\n[Server] Received Room Booking Request from: ${name} (${email}, ${phone}) for Hostel ID ${hostel_id}`);

                    // 1. Fetch Hostel Name
                    let hostelName = (hostel_id == 2 ? 'ISHTAA PRIME GIRLS' : 'ISHTAA PRIME BOYS');
                    try {
                        const { data: hData } = await db.from('hostels').select('*').eq('id', hostel_id || 1).single();
                        if (hData && hData.name) hostelName = hData.name;
                    } catch (e) {}

                    // 2. Fetch Owner & Manager Emails/Phones
                    const ownerEmail = (process.env.OWNER_EMAIL || 'ishtaaprimeboyshostel@gmail.com').trim();
                    const ownerPhone = (process.env.OWNER_PHONE || '919949038383').trim();
                    const defaultMgrEmail = (process.env.MANAGER_EMAIL || 'saimohan158716@gmail.com').trim();
                    const defaultMgrPhone = (process.env.MANAGER_PHONE || '919700635806').trim();

                    let managerEmails = [defaultMgrEmail];
                    let managerPhones = [defaultMgrPhone];
                    try {
                        const { data: mgrUsers } = await db.from('users').select('*').eq('role', 'manager').eq('hostel_id', hostel_id || 1);
                        if (mgrUsers && mgrUsers.length > 0) {
                            mgrUsers.forEach(m => {
                                if (m.email) managerEmails.push(m.email.trim());
                                if (m.phone) managerPhones.push(m.phone.trim());
                            });
                        }
                    } catch (e) {}

                    // Deduplicate target emails and phones to prevent duplicate sends if owner & manager share contacts
                    const targetEmails = [...new Set([ownerEmail, ...managerEmails].map(e => e.toLowerCase()).filter(Boolean))];
                    const targetPhones = [...new Set([ownerPhone, ...managerPhones].filter(Boolean))];

                    const now = new Date();
                    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
                    const dateStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                    const hours = now.getHours();
                    const timeOfDay = hours < 12 ? 'Morning' : (hours < 17 ? 'Afternoon' : (hours < 21 ? 'Evening' : 'Night'));
                    const fullTimeLabel = `${timeOfDay} (${dateStr} at ${timeStr})`;

                    // Construct Email HTML
                    const emailSubject = `🔔 New Room Booking Request — ${name} (${hostelName})`;
                    const emailHtml = `
                      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.1); border: 1px solid #e2e8f0;">
                        <div style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); color: #ffffff; padding: 24px; text-align: center;">
                          <h1 style="margin: 0; font-size: 22px; font-weight: 700; color: #38bdf8;">🔔 NEW ROOM BOOKING REQUEST</h1>
                          <p style="margin: 6px 0 0 0; opacity: 0.8; font-size: 14px;">VUSTELA PG Hostels & Accommodation</p>
                        </div>
                        <div style="padding: 24px; color: #334155;">
                          <p style="font-size: 15px; margin-top: 0;">A new room booking request has been submitted on the VUSTELA Portal at <strong>${fullTimeLabel}</strong>.</p>

                          <table style="width: 100%; border-collapse: collapse; margin: 20px 0; background: #f8fafc; border-radius: 8px; overflow: hidden;">
                            <tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 12px 16px; font-weight: 600; color: #64748b;">Hostel Branch</td><td style="padding: 12px 16px; font-weight: 700; color: #0f172a;">${hostelName}</td></tr>
                            <tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 12px 16px; font-weight: 600; color: #64748b;">Tenant Name</td><td style="padding: 12px 16px; font-weight: 700; color: #0f172a;">${name}</td></tr>
                            <tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 12px 16px; font-weight: 600; color: #64748b;">Tenant Phone</td><td style="padding: 12px 16px;"><a href="tel:${phone}" style="color: #2563eb; text-decoration: none; font-weight: 600;">${phone}</a></td></tr>
                            <tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 12px 16px; font-weight: 600; color: #64748b;">Tenant Email</td><td style="padding: 12px 16px;"><a href="mailto:${email}" style="color: #2563eb; text-decoration: none;">${email}</a></td></tr>
                            <tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 12px 16px; font-weight: 600; color: #64748b;">Room & Sharing</td><td style="padding: 12px 16px;">Room <strong>${room_num || 'N/A'}</strong> (${sharing || 'Standard'} Sharing)</td></tr>
                            <tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 12px 16px; font-weight: 600; color: #64748b;">Date of Joining</td><td style="padding: 12px 16px;">${doj || 'Immediate'}</td></tr>
                            <tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 12px 16px; font-weight: 600; color: #64748b;">ID Proof Type</td><td style="padding: 12px 16px;">${idtype || 'Aadhaar Card'}</td></tr>
                            ${message ? `<tr><td style="padding: 12px 16px; font-weight: 600; color: #64748b;">Note / Message</td><td style="padding: 12px 16px; font-style: italic;">${message}</td></tr>` : ''}
                          </table>

                          <div style="background: #e0f2fe; border-left: 4px solid #0284c7; padding: 12px 16px; border-radius: 4px; margin: 20px 0; font-size: 13px; color: #0369a1;">
                            ⚡ <strong>Action Required:</strong> Log in to your VUSTELA Manager or Owner Dashboard to accept or manage this booking request.
                          </div>
                        </div>
                        <div style="background: #f1f5f9; padding: 16px; text-align: center; font-size: 12px; color: #94a3b8;">
                          VUSTELA PG Hostel Management System &bull; Automatic Notification
                        </div>
                      </div>
                    `;

                    // Construct WhatsApp Text
                    const waText = `🔔 *NEW ROOM BOOKING REQUEST* 🔔\n_VUSTELA PG Hostels_\n\n🏨 *Hostel:* ${hostelName}\n👤 *Tenant Name:* ${name}\n📞 *Tenant Phone:* ${phone}\n✉️ *Tenant Email:* ${email}\n🛏️ *Room / Bed:* Room ${room_num || 'N/A'} (${sharing || 'Standard'})\n📅 *Joining Date:* ${doj || 'Immediate'}\n🆔 *ID Proof:* ${idtype || 'Aadhaar Card'}\n⏰ *Time:* ${fullTimeLabel}${message ? `\n\n💬 *Note:* ${message}` : ''}\n\n⚡ *Action Needed:* Log in to Manager / Owner Dashboard to review.`;

                    // Dispatch Email to target manager and owner emails
                    const emailResults = [];
                    for (const em of targetEmails) {
                        try {
                            const resEm = await sendEmailDirect(em, emailSubject, emailHtml);
                            emailResults.push({ email: em, success: true, res: resEm });
                            console.log(`[Booking Server] Sent Email successfully to: ${em}`);
                        } catch (e) {
                            console.error(`[Booking Server] Failed Email to ${em}:`, e.message);
                            emailResults.push({ email: em, success: false, error: e.message });
                        }
                    }

                    // Dispatch WhatsApp to target manager and owner phones
                    const waResults = [];
                    for (const ph of targetPhones) {
                        try {
                            const resWa = await sendWhatsappDirect(ph, waText);
                            waResults.push({ phone: ph, success: true, res: resWa });
                            console.log(`[Booking Server] Sent WhatsApp successfully to: ${ph}`);
                        } catch (e) {
                            console.error(`[Booking Server] Failed WhatsApp to ${ph}:`, e.message);
                            waResults.push({ phone: ph, success: false, error: e.message });
                        }
                    }

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, emailResults, waResults, targetEmails, targetPhones }));
                }

                // --- NEW PG REGISTRATION NOTIFICATION (ALERT TO SUPERADMIN / vustela.hostels@gmail.com) ---
                else if (req.url === '/api/notify-new-hostel') {
                    const { name, loc, category, mgr, phone, email, rooms } = data;
                    console.log(`\n[Server] New PG Registration Request received: ${name} (${loc}) by ${mgr}`);

                    const targetEmail = 'vustela.hostels@gmail.com';
                    const emailSubject = `🔔 New PG Registration Request — ${name} (${loc})`;
                    const emailHtml = `
                      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.1); border: 1px solid #e2e8f0;">
                        <div style="background: #0f172a; color: #ffffff; padding: 24px; text-align: center;">
                          <h1 style="margin: 0; font-size: 22px; color: #38bdf8;">🏢 NEW PG REGISTRATION REQUEST</h1>
                          <p style="margin: 6px 0 0 0; opacity: 0.8; font-size: 14px;">Vustela Multi-Tenant PG Platform</p>
                        </div>
                        <div style="padding: 24px; color: #334155;">
                          <p style="font-size: 15px; margin-top: 0;">A new hostel owner has submitted a registration request on the Vustela Gateway.</p>
                          <table style="width: 100%; border-collapse: collapse; margin: 20px 0; background: #f8fafc; border-radius: 8px; overflow: hidden;">
                            <tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 12px; font-weight: 600; color: #64748b;">Hostel / PG Name</td><td style="padding: 12px; font-weight: 700; color: #0f172a;">${name}</td></tr>
                            <tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 12px; font-weight: 600; color: #64748b;">Location / City</td><td style="padding: 12px; font-weight: 700; color: #0f172a;">${loc}</td></tr>
                            <tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 12px; font-weight: 600; color: #64748b;">Category</td><td style="padding: 12px;">${category}</td></tr>
                            <tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 12px; font-weight: 600; color: #64748b;">Owner Full Name</td><td style="padding: 12px; font-weight: 700;">${mgr}</td></tr>
                            <tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 12px; font-weight: 600; color: #64748b;">Owner Email</td><td style="padding: 12px;"><a href="mailto:${email}">${email}</a></td></tr>
                            <tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 12px; font-weight: 600; color: #64748b;">WhatsApp Phone</td><td style="padding: 12px;"><a href="tel:${phone}">${phone}</a></td></tr>
                            <tr><td style="padding: 12px; font-weight: 600; color: #64748b;">Rooms / Capacity</td><td style="padding: 12px;">${rooms || '20 Rooms'}</td></tr>
                          </table>
                          <div style="background: #e0f2fe; border-left: 4px solid #0284c7; padding: 12px; border-radius: 4px; font-size: 13px; color: #0369a1;">
                            ⚡ <strong>Action Required:</strong> Open SuperAdmin Control Center (<code>superadmin.html</code>) to review and approve this hostel request.
                          </div>
                        </div>
                      </div>
                    `;

                    try {
                        await sendEmailDirect(targetEmail, emailSubject, emailHtml);
                        if (email && email !== targetEmail) {
                            await sendEmailDirect(email, emailSubject, emailHtml);
                        }
                    } catch(e) {
                        console.error('[Server] Failed to send registration email:', e.message);
                    }

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, message: 'Registration alert dispatched' }));
                }

                // --- HOSTEL APPROVAL CREDENTIALS DISPATCH (EMAIL & WHATSAPP TO OWNER) ---
                else if (req.url === '/api/approve-hostel-credentials') {
                    const { name, mgr, email, phone, password, slug } = data;
                    console.log(`\n[Server] Approved Hostel ${name}. Dispatching credentials to ${email} / ${phone}`);

                    const emailSubject = `🎉 Your Vustela Portal for ${name} Has Been Approved!`;
                    const emailHtml = `
                      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.1); border: 1px solid #e2e8f0;">
                        <div style="background: #0f172a; color: #ffffff; padding: 24px; text-align: center;">
                          <h1 style="margin: 0; font-size: 22px; color: #10b981;">🎉 HOSTEL REGISTRATION APPROVED</h1>
                          <p style="margin: 6px 0 0 0; opacity: 0.8; font-size: 14px;">Welcome to Vustela PG Management</p>
                        </div>
                        <div style="padding: 24px; color: #334155;">
                          <p style="font-size: 15px; margin-top: 0;">Dear <strong>${mgr}</strong>,</p>
                          <p style="font-size: 14px;">Congratulations! Your registration for <strong>${name}</strong> has been reviewed and approved by Vustela SuperAdmin.</p>
                          
                          <div style="background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 16px; margin: 20px 0;">
                            <h3 style="margin-top: 0; color: #0f172a; font-size: 15px;">🔑 Your Owner Login Credentials</h3>
                            <p style="margin: 4px 0; font-size: 14px;"><strong>Email / Username:</strong> ${email}</p>
                            <p style="margin: 4px 0; font-size: 14px;"><strong>Password:</strong> <code style="background: #e2e8f0; padding: 2px 6px; border-radius: 4px;">${password || 'Vustela#2026'}</code></p>
                            <p style="margin: 4px 0; font-size: 14px;"><strong>Hostel Portal Link:</strong> <a href="https://${slug || 'isthaprime'}.vustelamanagement.com/" style="color: #2563eb; font-weight: 600;">https://${slug || 'isthaprime'}.vustelamanagement.com/</a></p>
                          </div>

                          <p style="font-size: 13px; color: #64748b;">You can now log in to your Owner Portal, add manager profiles, allocate rooms/beds, and invite tenants.</p>
                        </div>
                      </div>
                    `;

                    const waText = `🎉 *HOSTEL REGISTRATION APPROVED!*\n_Vustela PG Management_\n\nDear *${mgr}*,\nYour hostel *${name}* is now live on Vustela PG Network.\n\n🔑 *Login Credentials:*\n📧 *Email:* ${email}\n🔐 *Password:* ${password || 'Vustela#2026'}\n🌐 *Portal Link:* https://${slug || 'isthaprime'}.vustelamanagement.com/\n\nLog in to your Owner Portal to create manager profiles and manage rooms.`;

                    try {
                        if (email) await sendEmailDirect(email, emailSubject, emailHtml);
                        if (phone) await sendWhatsappDirect(phone, waText);
                    } catch(e) {
                        console.error('[Server] Failed to dispatch credentials:', e.message);
                    }

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, message: 'Credentials dispatched successfully' }));
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
                res.end(JSON.stringify({ error: 'Invalid JSON', receivedBody: body, parseError: err.message }));
            }
        });
    } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
    }
});

server.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
        console.log(`[Server] Port ${port} is already running.`);
    } else {
        console.error('[Server] Listen error:', e);
    }
});

if (require.main === module) {
    server.listen(port, () => {
        console.log(`=========================================`);
        console.log(`🚀 VUSTELA Relay Server is running!`);
        console.log(`📡 Listening for WhatsApp & Email on http://localhost:${port}`);
        console.log(`=========================================`);
        
        // Start automated scheduler
        startScheduler();
    });
}

module.exports = {
    sendEmailDirect,
    sendWhatsappDirect
};

