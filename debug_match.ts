
const pattern = "Izmaksa no noguldījuma";
const purpose = "Izmaksa no noguldījuma. Rīkojums C19488-KKM-0029, pieteikts 10/12/25";

const pLower = pattern.toLowerCase();
const tLower = purpose.toLowerCase();

console.log('Pattern:', pLower);
console.log('Target:', tLower);
console.log('Match?', tLower.includes(pLower));

console.log('Pattern codes:', pLower.split('').map(c => c.charCodeAt(0)));
console.log('Target prefix codes:', tLower.substring(0, pLower.length).split('').map(c => c.charCodeAt(0)));
