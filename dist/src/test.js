"use strict";
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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        for (let i = 0; i < 14; i += 3) {
            console.log(i);
            yield wait(500); // <-- 1 second between prints
        }
    });
}
run();
