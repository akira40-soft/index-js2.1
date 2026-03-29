import axios from 'axios';

async function testAPIs() {
    const url = 'https://www.youtube.com/watch?v=04z9ns6T9Vo';

    const apis = [
        { name: 'Itzpire', url: `https://itzpire.com/download/youtube?url=${url}` },
        { name: 'Widipe', url: `https://widipe.com/download/ytdl?url=${url}` },
        { name: 'Vreden', url: `https://api.vreden.web.id/api/ytdl?url=${url}` },
        { name: 'Bochil', url: `https://api.bochilteam.me/api/ytmp4?url=${url}` }
    ];

    for (const api of apis) {
        try {
            console.log(`Testando ${api.name}...`);
            const res = await axios.get(api.url, { timeout: 10000 });
            console.log(`Sucesso ${api.name}:`, JSON.stringify(res.data).substring(0, 200));
        } catch (e) {
            console.error(`Erro ${api.name}:`, e.message);
        }
    }
}

testAPIs();
