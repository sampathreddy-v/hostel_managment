const nodemailer = require('nodemailer');

async function test() {
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: 'sampathreddyvustela4@gmail.com',
            pass: 'ezkrdnvuigidgdxw'
        }
    });

    try {
        const info = await transporter.sendMail({
            from: '"VUSTELA" <sampathreddyvustela4@gmail.com>',
            to: 'sampathreddyvustela4@gmail.com',
            subject: 'Test',
            text: 'Hello World'
        });
        console.log('Success:', info.messageId);
    } catch (e) {
        console.error('Error:', e);
    }
}
test();
