import type { Transaction, Mapping } from './db';

export function applyMappings(transaction: Transaction, mappings: Mapping[], ignoredAccounts: string[] = []): { match?: string, conflicts?: string[] } {
    // 1. Internal Transfer Rule (Top Priority)
    // If beneficiary or purpose contains an explicit account number from "My Accounts" list
    const relevantText = (transaction.beneficiary + ' ' + transaction.purpose).toLowerCase();

    // Normalize ignored accounts to lowercase and trim
    const normalizedIgnored = ignoredAccounts
        .map(acc => acc.toLowerCase().trim())
        .filter(acc => acc.length > 0);

    const isInternal = normalizedIgnored.some(acc => relevantText.includes(acc));

    if (isInternal) {
        return { match: 'INTERNAL' };
    }

    // 2. Removed Global Rule: Positive transactions -> IN
    // We want user mappings to take precedence. 
    // Fallback to IN is handled in Import/Categories logic.


    const matches = new Set<string>();

    for (const mapping of mappings) {
        const pattern = mapping.pattern.toLowerCase();
        const beneficiary = transaction.beneficiary.toLowerCase();
        const purpose = transaction.purpose.toLowerCase();

        // Simple substring match
        if (beneficiary.includes(pattern) || purpose.includes(pattern)) {
            matches.add(mapping.categoryId);
        }
    }

    if (matches.size === 1) {
        return { match: Array.from(matches)[0] };
    } else if (matches.size > 1) {
        return { conflicts: Array.from(matches) };
    }

    return {};
}
