<<<<<<< HEAD
import fs from 'fs';
import path from 'path';
const target='d:/Disco/Programação/index-js2.1/modules/MediaProcessor.ts';
let data=fs.readFileSync(target,'binary');
let res='';
for(let i=0;i<data.length;i++){
    const code=data.charCodeAt(i);
    if(code===5||code===8) continue;
    res+=data[i];
}
fs.writeFileSync(target,res,'binary');
console.log('cleaned control chars');
// remove this script
fs.unlinkSync(process.argv[1]);
=======
import fs from 'fs';
import path from 'path';
const target='d:/Disco/Programação/index-js2.1/modules/MediaProcessor.ts';
let data=fs.readFileSync(target,'binary');
let res='';
for(let i=0;i<data.length;i++){
    const code=data.charCodeAt(i);
    if(code===5||code===8) continue;
    res+=data[i];
}
fs.writeFileSync(target,res,'binary');
console.log('cleaned control chars');
// remove this script
fs.unlinkSync(process.argv[1]);
>>>>>>> bca33df3e80ad01e3a871bb67a7d0a8ff9a621a3
el