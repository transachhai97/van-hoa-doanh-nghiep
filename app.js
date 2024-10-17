// app.js
const express = require('express');
const multer = require('multer');
const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');

const app = express();
const port = 3000;

// Cấu hình multer để lưu file tạm thời
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Serve static files from the 'assets' directory
app.use('/assets', express.static(path.join(__dirname, 'assets')));

// Phục vụ file import.html khi truy cập /import
app.get('/import', (req, res) => {
    res.sendFile(path.join(__dirname, 'import.html')); // Serve import.html
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html')); // Serve index.html
});

// Route để import file Excel
app.post('/import', upload.single('file'), (req, res) => {
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    // Chuyển đổi dữ liệu và chỉ lấy các thuộc tính cần thiết theo từng cột
    const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]).map(item => ({
        id: item['ID'],
        name: item['NAME'], 
        org: item['ORG'],  
        nickname: item['NICKNAME'],
        map_nickname: item['MAP'],
        score: item['SCORE'],
    }));

    // Ghi dữ liệu vào file data.json
    fs.writeFileSync('assets/data/list.json', JSON.stringify(data, null, 2));

    // Ghi giá trị khởi tạo vào file list.js
    // fs.writeFileSync('assets/js/data.js', `export const dataArray = ${JSON.stringify(data, null, 2)};`);

    res.send('File imported and data.json created, list.js initialized!');
});

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});
