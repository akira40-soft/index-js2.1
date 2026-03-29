import axios from 'axios';

async function testAPIs() {
    const url = 'https://www.youtube.com/watch?v=04z9ns6T9Vo';

    const apis = [
        { name: 'Ryzen', url: `https://api.ryzendesu.vip/api/downloader/ytmp4?url=${url}` },
        { name: 'AEMT', url: `https://aemt.me/download/ytdl?url=${url}` }
    ];

    for (const api of apis) {
        try {
            console.log(`Testando ${api.name}...`);
            const res = await axios.get(api.url);
            console.log(`Sucesso ${api.name}:`, res.data);
        } catch (e) {
            console.error(`Erro ${api.name}:`, e.message);
        }
    }
}

testAPIs();
