
import { parseBankCSV } from './lib/parser';
import { applyMappings } from './lib/matcher';

// Mock DB objects
const mockMapping = { id: '1', pattern: 'RIMI', categoryId: 'cat-1' };
const csv = `Account number,Payment No.,Value date,Beneficiary/payer's account number,Beneficiary/ Payer,Debit/Credit,Amount,Transaction No.,Purpose of payment,Currency,Registration number/ Personal ID
"LV11","","01.02.2024","","","D","1.09","ID123","Karte: ... Pirkums - RIMI MHM ADAZI","EUR",""`;

async function runTest() {
    console.log("Running logic verification...");

    // 1. Parse
    const result = await parseBankCSV(csv);
    if (result.errors.length > 0) {
        console.error("Parse errors:", result.errors);
        return;
    }

    const tx = result.data[0];
    console.log("Parsed TX:", tx.beneficiary, tx.purpose);

    // 2. Match
    const catId = applyMappings(tx, [mockMapping]);
    console.log("Matched Category ID:", catId);

    if (catId === 'cat-1') {
        console.log("PASSED: Category matched correctly.");
    } else {
        console.error("FAILED: Category matching failed.");
    }
}

runTest();
