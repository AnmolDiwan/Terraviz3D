import { ragQuery } from './src/ragAgent.js';

async function run() {
  try {
    const res = await ragQuery('Where are the strongest earthquakes?');
    console.log("SUCCESS:", res);
  } catch(e) {
    console.error("FAIL:", e);
  }
}
run();
