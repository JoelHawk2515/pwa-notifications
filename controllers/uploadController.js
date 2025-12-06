const fs = require('fs');
const path = require('path');

async function uploadImage(req, res) {
    try {
        const { dataUrl } = req.body;
        if (!dataUrl || !dataUrl.startsWith('data:image/')) {
            return res.status(400).json({ error: 'Invalid image data' });
        }
        const matches = dataUrl.match(/^data:(image\/\w+);base64,(.+)$/);
        const mime = matches[1];
        const buffer = Buffer.from(matches[2], 'base64');
        const ext = mime.split('/')[1];
        const name = `img_${Date.now()}.${ext}`;
        const uploadDir = path.join(__dirname, '../public/uploads');
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
        const filepath = path.join(uploadDir, name);
        fs.writeFileSync(filepath, buffer);
        res.json({ success: true, location: `/uploads/${name}` });
    } catch (err) {
        console.error('uploadImage error:', err);
        res.status(500).json({ error: 'Failed to upload image' });
    }
}

module.exports = { uploadImage };
