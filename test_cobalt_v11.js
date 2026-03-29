import axios from 'axios';

async function testCobaltV11() {
    try {
        console.log('Testando Cobalt API v11...');
        const res = await axios.post('https://api.cobalt.tools/', {
            url: 'https://www.youtube.com/watch?v=04z9ns6T9Vo',
            videoQuality: '720' // v11 spec
        }, {
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            }
        });
        console.log('Sucesso Cobalt v11:', res.data);
    } catch (e) {
        console.error('Erro Cobalt v11:', e.response?.data || e.message);
    }
}

testCobaltV11();
