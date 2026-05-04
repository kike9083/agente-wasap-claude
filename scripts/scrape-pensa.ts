import { ApifyClient } from 'apify-client';
import * as fs from 'fs';

const client = new ApifyClient({
    token: 'apify_api_0ETJhLziH4TFYayl9TItfl5C8OuzRH3bDhZR',
});

async function main() {
    console.log("Starting Apify Website Content Crawler on pensapanama.com...");
    const input = {
        "startUrls": [
            { "url": "https://pensapanama.com/tienda/" },
            { "url": "https://pensapanama.com/nosotros/" },
            { "url": "https://pensapanama.com/categoria-producto/linea-blanca/" },
            { "url": "https://pensapanama.com/categoria-producto/muebles/" },
            { "url": "https://pensapanama.com/categoria-producto/colchones/" }
        ],
        "maxCrawlPages": 50,
        "crawlerType": "playwright:adaptive",
        "saveMarkdown": true,
    };

    const run = await client.actor("apify/website-content-crawler").call(input);
    console.log(`Run finished! Dataset ID: ${run.defaultDatasetId}`);

    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    
    let combinedMarkdown = "";
    for (const item of items) {
        if (item.markdown) {
            combinedMarkdown += `\n\n--- PAGE: ${item.url} ---\n\n`;
            combinedMarkdown += item.markdown;
        }
    }

    fs.writeFileSync("pensa_scraped_data.md", combinedMarkdown);
    console.log("Saved to pensa_scraped_data.md");
}

main().catch(console.error);
