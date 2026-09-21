// test_embed.js
import { embed, embedBatch } from './src/services/embedding.service.js';

async function test() {
    const result = await embed('earthquake near Tokyo');
    console.log('Length:', result.length);
    console.log('Type:', typeof result[0]);
    console.log('In range:', result.every(v => v >= -1 && v <= 1));

    const batch = await embedBatch(['test one', 'test two', 'test three']);
    console.log('Batch length:', batch.length);
    console.log('Each length:', batch[0].length);
}

test().catch(console.error);