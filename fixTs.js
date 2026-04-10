const fs = require('fs');
let code = fs.readFileSync('frontend/src/components/GraphView.tsx', 'utf8');

// 1. ctx possibly null
code = code.replace(/ctx\.clearRect/g, 'ctx!.clearRect');
code = code.replace(/ctx\.beginPath/g, 'ctx!.beginPath');
code = code.replace(/ctx\.arc/g, 'ctx!.arc');
code = code.replace(/ctx\.fillStyle/g, 'ctx!.fillStyle');
code = code.replace(/ctx\.fill/g, 'ctx!.fill');

// 2. Implicit any in lambda
code = code.replace(/\(n, idx\)/g, '(n: any, idx: number)');
code = code.replace(/finalLinks = \[\]/g, 'finalLinks: AppLink[] = []');
code = code.replace(/sats\.forEach\(s =>/g, 'sats.forEach((s: AppNode) =>');
code = code.replace(/s\.nextNodeIds\.forEach\(nId =>/g, 's.nextNodeIds!.forEach((nId: string) =>');

fs.writeFileSync('frontend/src/components/GraphView.tsx', code);
console.log("Patched implicit anys and null ctx successfully!");
