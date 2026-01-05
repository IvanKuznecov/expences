import Papa from 'papaparse';
import type { Transaction } from './db';
import { parse, isValid, format } from 'date-fns';

export interface ParseResult {
    data: Transaction[];
    errors: any[];
}

export function parseBankCSV(fileContent: string): Promise<ParseResult> {
    return new Promise((resolve) => {
        Papa.parse(fileContent, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                const transactions: Transaction[] = [];
                const errors: any[] = [];

                results.data.forEach((row: any, index) => {
                    try {
                        // Required fields check
                        if (!row['Value date'] || !row['Amount']) {
                            // Skip completely empty or invalid rows that might pass skipEmptyLines
                            return;
                        }

                        // Filter Internal Transfers
                        // UPDATE: We no longer skip them here. We import them so they can be categorized as 'INTERNAL'.

                        /* 
                        const beneAccount = row["Beneficiary/payer's account number"];
                        if (beneAccount && ignoredAccounts.includes(beneAccount.trim())) {
                            return;
                        } 
                        */

                        // Map fields
                        const dateStr = row['Value date'];
                        const amountStr = row['Amount'];
                        const type = row['Debit/Credit'];
                        // Fallback ID if Transaction No. is missing (though it shouldn't be for valid txs)
                        const id = row['Transaction No.'] || `gen-${index}-${Date.now()}`;


                        // Parse date: 01.02.2024 -> 2024-02-01
                        // Using date-fns parse
                        const parsedDate = parse(dateStr, 'dd.MM.yyyy', new Date());
                        if (!isValid(parsedDate)) {
                            throw new Error(`Invalid date format: ${dateStr}`);
                        }
                        const isoDate = format(parsedDate, 'yyyy-MM-dd');

                        const amount = parseFloat(amountStr);

                        const beneAccount = row["Beneficiary/payer's account number"];
                        let beneficiary = row['Beneficiary/ Payer'] || '';
                        if (beneAccount) {
                            beneficiary += ` (${beneAccount})`;
                        }

                        transactions.push({
                            id,
                            date: isoDate,
                            amount,
                            type: type as 'D' | 'C',
                            beneficiary: beneficiary,
                            purpose: row['Purpose of payment'] || '',
                            originalRow: row,
                        });
                    } catch (e) {
                        console.error('Error parsing row', row, e);
                        errors.push({ row, error: e });
                    }
                });

                resolve({ data: transactions, errors });
            },
            error: (error: any) => {
                resolve({ data: [], errors: [error] });
            }
        });
    });
}
