/**
import express from 'express';

const app = express();
const port = 3001;

app.get('/', (req, res) => {
    res.json({ message: 'Test server working!' });
});

app.listen(port, () => {
    console.log(`✅ Test server running on http://localhost:${port}`);
});
*/

function wait(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
    for (let i = 0; i < 14; i += 3) {
        console.log(i);
        await wait(500); // <-- 1 second between prints
    }
}

run();
