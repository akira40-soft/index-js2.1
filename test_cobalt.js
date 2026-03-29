import axios from 'axios';

async function testCobalt() {
    try {
        console.log('Testando Cobalt API...');
        const res = await axios.post('https://api.cobalt.tools/api/json', {
            url: 'https://www.youtube.com/watch?v=04z9ns6T9Vo',
            vQuality: '720'
        }, {
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });
        console.log('Sucesso Cobalt:', res.data);
    } catch (e) {
        console.error('Erro Cobalt:', e.response?.data || e.message);
    }
}

testCobalt();
