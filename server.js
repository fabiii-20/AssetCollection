const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const app = express();
const port = 3000;

app.use(cors());

app.get('/proxy', async (req, res) => {
    const url = req.query.url;
    if (!url) {
        return res.status(400).send('URL is required');
    }

    try {
        const response = await fetch(url);
        const data = await response.text();
        res.send(data);
    } catch (error) {
        res.status(500).send('Error fetching the URL');
    }
});

app.get('/resolve-url', async (req, res) => {
    const url = req.query.url;
    if (!url) {
        return res.status(400).send('URL is required');
    }

    try {
        const response = await fetch(url, { method: 'HEAD', redirect: 'follow' });
        const finalUrl = response.url;
        res.json({ resolvedUrl: finalUrl });
    } catch (error) {
        res.status(500).send('Error resolving the URL');
    }
});

app.get('/check-url', async (req, res) => {
    const url = req.query.url;
    if (!url) {
        return res.status(400).send('URL is required');
    }

    try {
        const response = await fetch(url, { method: 'HEAD' });
        const contentType = response.headers.get('content-type');
        res.json({ isWebsite: contentType && contentType.includes('text/html') });
    } catch (error) {
        res.status(500).send('Error checking the URL');
    }
});

app.listen(port, () => {
    console.log(`Proxy server running at http://localhost:${port}`);
});

