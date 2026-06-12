require('dotenv').config();
const http = require('http');
const https = require('https');

// Config
const port = process.env.PORT || 3000;

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

                    const postData = JSON.stringify({
                        messaging_product: "whatsapp",
                        to: formattedTo,
                        type: "text",
                        text: {
                            body: message
                        }
                    });

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
                    const { to, subject, html } = data;
                    if (!to || !subject || !html) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        return res.end(JSON.stringify({ error: 'Missing "to", "subject", or "html"' }));
                    }

                    console.log(`\n[Server] Received request to send Email to: ${to}`);

                    const postData = JSON.stringify({
                        sender: {
                            name: process.env.SENDER_NAME || 'VUSTELA Hostel',
                            email: process.env.SENDER_EMAIL
                        },
                        to: [{ email: to }],
                        subject: subject,
                        htmlContent: html
                    });

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

                    const brevoReq = https.request(options, (brevoRes) => {
                        let responseData = '';
                        brevoRes.on('data', (d) => responseData += d);
                        brevoRes.on('end', () => {
                            let result = {};
                            try {
                                result = JSON.parse(responseData);
                            } catch (e) {
                                console.error('[Server] Failed to parse Brevo response:', responseData);
                            }

                            if (brevoRes.statusCode >= 200 && brevoRes.statusCode < 300) {
                                console.log(`[Server] Email sent successfully via Brevo! Message ID: ${result.messageId}`);
                                res.writeHead(200, { 'Content-Type': 'application/json' });
                                res.end(JSON.stringify({ success: true, messageId: result.messageId }));
                            } else {
                                console.error(`[Server] Brevo API Error (Status ${brevoRes.statusCode}):`, result.message || responseData);
                                res.writeHead(brevoRes.statusCode, { 'Content-Type': 'application/json' });
                                res.end(JSON.stringify({ error: result.message || 'Brevo API Error' }));
                            }
                        });
                    });

                    brevoReq.on('error', (e) => {
                        console.error('[Server] Brevo Request Failed:', e);
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Failed to connect to Brevo' }));
                    });

                    brevoReq.write(postData);
                    brevoReq.end();
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
});
