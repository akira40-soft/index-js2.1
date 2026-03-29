import axios from 'axios';

async function testAPIs() {
    const url = 'https://www.youtube.com/watch?v=04z9ns6T9Vo';

    const apis = [
        { name: 'Siputzx', url: `https://api.siputzx.my.id/api/d/ytmp4?url=${url}` },
        { name: 'Siputzx Audio', url: `https://api.siputzx.my.id/api/d/ytmp3?url=${url}` },
        { name: 'NYX', url: `https://api.nyxs.pw/dl/yt-direct?url=${url}` },
        { name: 'Zeltoria', url: `https://api.zeltoria.my.id/api/download/youtube?url=${url}` },
        { name: 'Datanode', url: `https://api.datanode.my.id/api/download/youtube?url=${url}` }
    ];

    for (const api of apis) {
        try {
            console.log(`Testando ${api.name}...`);
            const res = await axios.get(api.url, { timeout: 15000 });
            console.log(`Sucesso ${api.name}:`, JSON.stringify(res.data).substring(0, 150));
        } catch (e) {
            console.error(`Erro ${api.name}:`, e.message);
        }
    }
}

testAPIs();
