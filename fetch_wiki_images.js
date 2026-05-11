const https = require('https');
const fs = require('fs');

async function downloadWikiImage(title, filename) {
  const url = `https://en.wikipedia.org/w/api.php?action=query&titles=${title}&prop=pageimages&format=json&pithumbsize=800`;
  const options = {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) App/1.0' }
  };
  
  return new Promise((resolve, reject) => {
    https.get(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const pages = json.query.pages;
          const pageId = Object.keys(pages)[0];
          if (pages[pageId].thumbnail) {
            const imageUrl = pages[pageId].thumbnail.source;
            console.log(`Downloading ${imageUrl} to ${filename}`);
            
            const file = fs.createWriteStream(filename);
            https.get(imageUrl, options, (response) => {
              response.pipe(file);
              file.on('finish', () => {
                file.close();
                console.log(`Saved ${filename}`);
                resolve();
              });
            }).on('error', reject);
          } else {
            console.log(`No image found for ${title}.`);
            resolve();
          }
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function main() {
  await downloadWikiImage('Patty', 'c:\\Users\\Emanuel\\Desktop\\ecritorio\\heladeria\\public\\cat_hamburguesa.png');
  await downloadWikiImage('French_fries', 'c:\\Users\\Emanuel\\Desktop\\ecritorio\\heladeria\\public\\cat_papas.png');
  console.log("Done.");
}

main().catch(console.error);
