import express from 'express';

const app = express();
const port = 3001;

app.get('/', (req, res) => {
    res.json({ message: 'Test server working!' });
});

app.listen(port, () => {
    console.log(`✅ Test server running on http://localhost:${port}`);
});