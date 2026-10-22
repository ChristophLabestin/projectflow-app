// One-off: renders the tray icons from assets/glyph.svg. Run: npx electron scripts/render-icons.cjs
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const assets = path.join(__dirname, '..', 'assets');
const glyph = fs.readFileSync(path.join(assets, 'glyph.svg'), 'utf8').replace(/<circle[^>]*\/>/, '');

const render = async (win, size, color) => {
    const svg = glyph.replace(/fill="#000000"/g, `fill="${color}"`);
    const dataUrl = await win.webContents.executeJavaScript(`new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = ${size}; canvas.height = ${size};
            canvas.getContext('2d').drawImage(img, 0, 0, ${size}, ${size});
            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = reject;
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(${JSON.stringify(svg)});
    })`);
    return Buffer.from(dataUrl.split(',')[1], 'base64');
};

app.whenReady().then(async () => {
    const win = new BrowserWindow({ show: false });
    await win.loadURL('about:blank');
    fs.writeFileSync(path.join(assets, 'trayTemplate.png'), await render(win, 16, '#000000'));
    fs.writeFileSync(path.join(assets, 'trayTemplate@2x.png'), await render(win, 32, '#000000'));
    fs.writeFileSync(path.join(assets, 'tray.png'), await render(win, 32, '#2563eb'));
    console.log('tray icons written');
    app.quit();
});
