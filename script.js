async function processLinks() {
    const linkInput = document.getElementById('linkInput').value.trim();
    const links = linkInput ? linkInput.split('\n') : [];
    const proxyUrl = 'http://localhost:3000/proxy?url=';
    const resolveUrl = 'http://localhost:3000/resolve-url?url=';
    const assets = new Set();
    const uniqueDocuments = new Set();

    if (Array.isArray(links) && links.length > 0) {
        for (const link of links) {
            if (link) {
                try {
                    const response = await fetch(proxyUrl + encodeURIComponent(link.trim()));
                    const htmlContent = await response.text();
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(htmlContent, 'text/html');

                    // Handle images and other assets
                    const images = getAllImages(doc, link);
                    const documents = await getAllDocuments(doc, resolveUrl, link, uniqueDocuments);
                    const videos = getAllVideos(doc, link);
                    console.log("VIEOS",videos)
                    images.forEach(src => {
                        const id = extractImageId(src);
                        if (id) {
                            assets.add(JSON.stringify({ type: 'image', id, parentUrl: link }));
                        }
                    });

                    documents.forEach(doc => {
                        assets.add(JSON.stringify({ ...doc, parentUrl: link }));
                    });

                    videos.forEach(doc => {
                        console.log(doc)
                        // const { type, src, parentUrl } = doc
                        assets.add(JSON.stringify({...doc}));
                    });
                } catch (error) {
                    console.error('Error fetching or parsing URL:', link, error);
                }
            }
        }
    }

    displayResult(assets, uniqueDocuments.size);
    writeResultsToExcel(assets, uniqueDocuments.size);
}

function getAllImages(doc, parentUrl) {
    const images = new Set();

    // Add images from <img> tags
    doc.querySelectorAll('img').forEach(img => {
        const src = img.dataset.src || img.dataset.lazy || img.src;
        const id = extractImageId(src);
        if (src && id !== 'RE1Mu3b' && id !== 'index.html' && id !== 't.gif') {
            images.add(src);
        }
    });

    // Add images from elements with lazy loading attributes
    doc.querySelectorAll('[data-src], [data-lazy], [data-srcset]').forEach(element => {
        const src = element.dataset.src || element.dataset.lazy || element.dataset.srcset;
        if (src) {
            images.add(src);
        }
    });

    // Add images from carousels specifically
    doc.querySelectorAll('#primaryArea .carousel img').forEach(img => {
        const src = img.dataset.src || img.dataset.lazy || img.src;
        if (src) {
            images.add(src);
        }
    });

    return Array.from(images);
}

async function getAllDocuments(doc, resolveUrl, parentUrl, uniqueDocuments) {
    const documents = new Set();

    // Add PDFs and Excel files from <a> tags
    const promises = Array.from(doc.querySelectorAll('a')).map(async a => {
        const href = a.href;
        if (href) {
            let resolvedUrl = href;
            console.log(href)
            if (href.includes('aka.ms')) {
                try {
                    let attempt = 1
                    const maxAttempt = 3;
                    while (attempt < maxAttempt && !(resolvedUrl.startsWith('https://query.prod.cms.rt.microsoft.com/cms/') || resolvedUrl.match(/\.pdf$/i) || resolvedUrl.match(/\.xlsx?$/i) || resolvedUrl.match(/\.docx$/i)  || resolvedUrl.match(/\.ics$/i) || resolvedUrl.startsWith('https://query.prod.cms.rt.microsoft.com/cms/api/am/binary/') || resolvedUrl.includes('cdn')) ){
                        console.log(attempt,"ATTEMPT")
                        const res = await fetch(resolveUrl + encodeURIComponent(resolvedUrl));
                        const data = await res.json();
                        console.log("RESOLVED URL",href,resolvedUrl,data.resolvedUrl)
                        resolvedUrl = data.resolvedUrl;
                        attempt = attempt+1
                    }
                    
                    
                    if ((resolvedUrl.startsWith('https://query.prod.cms.rt.microsoft.com/cms/')) || resolvedUrl.match(/\.pdf$/i) || resolvedUrl.match(/\.xlsx?$/i) || resolvedUrl.match(/\.docx$/i)  || resolvedUrl.match(/\.ics$/i) || resolvedUrl.startsWith('https://query.prod.cms.rt.microsoft.com/cms/api/am/binary/') || resolvedUrl.includes('cdn') ){
                        documents.add({ type: 'document', src: href, resolved: resolvedUrl, parentUrl });
                        uniqueDocuments.add(href);
                    }
                } catch (error) {
                    console.error('Error resolving URL:', href, error);
                }
            } else if (href.match(/\.pdf$/i) || href.match(/\.xlsx?$/i) || href.match(/\.docx?$/i)  || href.match(/\.ics$/i) || href.startsWith('https://query.prod.cms.rt.microsoft.com/cms/api/am/binary/') || href.includes('cdn') ) {
                documents.add({ type: 'document', src: href, parentUrl });
                uniqueDocuments.add(href);
            }
        }
    });
    // console.log(uniqueDocuments)

    await Promise.all(promises);
    return Array.from(documents);
}

function getAllVideos(doc, parentUrl) {
    const videos = new Set();

    // Handle links containing 'videoplayer'
    doc.querySelectorAll('a[data-target],a').forEach(video => {
        const src = video.dataset.target || video.href;
        if (src) {
            if (src.includes('videoplayer') && !src.includes('chat')) {
                videos.add({ type: 'video', src, parentUrl });
            }
        }
        console.log(src, video);
    });

    // Handle <video> tags
    doc.querySelectorAll('video').forEach(video => {
        console.log('found video', video.src)
        const src = video.src;
        if (src) {
            videos.add({ type: 'video', src, parentUrl });
        }

        // Handle <source> tags within <video> tags
        video.querySelectorAll('source').forEach(source => {
            const sourceSrc = source.src;
            if (sourceSrc) {
                videos.add({ type: 'video', src: sourceSrc, parentUrl });
            }
        });
    });

    return Array.from(videos);
}



function extractImageId(url) {
    if (!url) return null;
    try {
        const urlObj = new URL(url);
        const pathPart = urlObj.pathname.split('/').pop();
        return pathPart;
    } catch (error) {
        console.error('Invalid URL:', url, error);
        return null;
    }
}

function displayResult(assets, uniqueDocumentsCount) {
    const resultDiv = document.getElementById('result');
    const allIds = []
    assets.forEach(asset => {
        const assetObj = JSON.parse(asset);
        allIds.push(assetObj.id || assetObj.src)
    });
    const uniqueIds = new Set()
    allIds.forEach(id => {
        uniqueIds.add(id)
    })
    resultDiv.innerHTML = `<p>Total Assets (${assets.size}):</p>`;
    resultDiv.innerHTML += `<p>Documents (count without duplicates): ${uniqueIds.size}</p>`;
    resultDiv.innerHTML += '<ul>';
    assets.forEach(asset => {
        const assetObj = JSON.parse(asset);
        resultDiv.innerHTML += `<li>${assetObj.type}: ${assetObj.id || assetObj.src} ${assetObj.resolved ? `-> ${assetObj.resolved}` : ''} (Parent URL: ${assetObj.parentUrl})</li>`;
    });
    resultDiv.innerHTML += '</ul>';
}

function writeResultsToExcel(assets, uniqueDocumentsCount) {
    const wb = XLSX.utils.book_new();

    const wsData = [['Type', 'Assets', 'Resolved URL', 'Parent URL']];
    // const allIds = assets.map((asset) =>  {
    //     const assetObj = JSON.parse(asset);
    //     return assetObj.id || assetObj.src})
    const allIds = []
    assets.forEach(asset => {
        const assetObj = JSON.parse(asset);
        allIds.push(assetObj.id || assetObj.src)
        wsData.push([assetObj.type, assetObj.id || assetObj.src, assetObj.resolved || '', assetObj.parentUrl]);
    });
    const uniqueIds = new Set()
    allIds.forEach(id => {
        uniqueIds.add(id)
    })
    // console.log("UNIQUE ID",uniqueIds, uniqueIds.size)


    // Add unique documents count as a separate row
    wsData.push([]);
    wsData.push(['Documents (count without duplicates):', uniqueIds.size]);

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, 'Results');
    XLSX.writeFile(wb, 'assets_links.xlsx');
}

document.getElementById('processButton').addEventListener('click', processLinks);

