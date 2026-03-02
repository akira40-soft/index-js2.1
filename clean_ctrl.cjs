<<<<<<< HEAD
import fs from 'fs';
const path='d:/Disco/Programação/index-js2.1/modules/MediaProcessor.ts';
let data=fs.readFileSync(path,'binary');
// remove codepoints 5 and 8
let res='';
for(let i=0;i<data.length;i++){
    const code=data.charCodeAt(i);
    if(code===5||code===8) continue;
    res+=data[i];
}
fs.writeFileSync(path,res,'binary');
=======
import fs from 'fs';
const path='d:/Disco/Programação/index-js2.1/modules/MediaProcessor.ts';
let data=fs.readFileSync(path,'binary');
// remove codepoints 5 and 8
let res='';
for(let i=0;i<data.length;i++){
    const code=data.charCodeAt(i);
    if(code===5||code===8) continue;
    res+=data[i];
}
fs.writeFileSync(path,res,'binary');
>>>>>>> bca33df3e80ad01e3a871bb67a7d0a8ff9a621a3
console.log('cleaned');