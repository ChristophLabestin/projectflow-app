// Renders the desktop icons from assets/glyph.svg (run after changing the glyph):
//   npx electron scripts/render-icons.cjs && iconutil -c icns assets/icon.iconset -o assets/icon.icns
// - icon.png / icon.iconset: full-bleed app icon; macOS 26+ masks it into the system squircle.
// - trayTemplate*.png (macOS menu bar, template image), tray.png (Windows tray).
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const assets = path.join(__dirname, '..', 'assets');
const glyph = fs.readFileSync(path.join(assets, 'glyph.svg'), 'utf8').replace(/<circle[^>]*\/>/, '');
const glyphPath = glyph.match(/ d="([^"]+)"/)[1];

const toPng = (dataUrl) => Buffer.from(dataUrl.split(',')[1], 'base64');

// `dot`: small status dot bottom-right (active focus) with a transparent ring around it.
const renderGlyph = (win, size, color, dot = null) => win.webContents.executeJavaScript(`new Promise((resolve, reject) => {
    const svg = ${JSON.stringify(glyph)}.replace(/fill="#000000"/g, 'fill="${color}"');
    const img = new Image();
    img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = ${size}; canvas.height = ${size};
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, ${size}, ${size});
        if (${JSON.stringify(dot)}) {
            const r = ${size} * 0.2, cx = ${size} - r - ${size} * 0.02, cy = ${size} - r - ${size} * 0.02;
            ctx.globalCompositeOperation = 'destination-out';
            ctx.beginPath(); ctx.arc(cx, cy, r * 1.45, 0, Math.PI * 2); ctx.fill();
            ctx.globalCompositeOperation = 'source-over';
            ctx.fillStyle = ${JSON.stringify(dot)};
            ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
        }
        resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = reject;
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
})`);

// macOS 26+ masks full-bleed legacy icons into the system squircle itself; icons with their own shape,
// margin or shadow get placed inside a grey container instead. So: full-bleed square, no baked-in shape.
const renderAppIcon = (win, size) => win.webContents.executeJavaScript(`(() => {
    const S = ${size};
    const canvas = document.createElement('canvas');
    canvas.width = S; canvas.height = S;
    const ctx = canvas.getContext('2d');
    const fill = ctx.createLinearGradient(0, 0, 0, S);
    fill.addColorStop(0, '#ffffff');
    fill.addColorStop(1, '#ececef');
    ctx.fillStyle = fill;
    ctx.fillRect(0, 0, S, S);
    // Glyph (viewBox 48) centred, same proportion as the iOS icon.
    const glyphSize = S * 0.56;
    ctx.save();
    ctx.translate((S - glyphSize) / 2, (S - glyphSize) / 2);
    ctx.scale(glyphSize / 48, glyphSize / 48);
    ctx.fillStyle = '#111318';
    ctx.fill(new Path2D(${JSON.stringify(glyphPath)}), 'evenodd');
    ctx.restore();
    return canvas.toDataURL('image/png');
})()`);

app.whenReady().then(async () => {
    const win = new BrowserWindow({ show: false });
    await win.loadURL('about:blank');

    fs.writeFileSync(path.join(assets, 'icon.png'), toPng(await renderAppIcon(win, 1024)));
    const iconset = path.join(assets, 'icon.iconset');
    fs.mkdirSync(iconset, { recursive: true });
    for (const base of [16, 32, 128, 256, 512]) {
        fs.writeFileSync(path.join(iconset, `icon_${base}x${base}.png`), toPng(await renderAppIcon(win, base)));
        fs.writeFileSync(path.join(iconset, `icon_${base}x${base}@2x.png`), toPng(await renderAppIcon(win, base * 2)));
    }

    fs.writeFileSync(path.join(assets, 'trayTemplate.png'), toPng(await renderGlyph(win, 16, '#000000')));
    fs.writeFileSync(path.join(assets, 'trayTemplate@2x.png'), toPng(await renderGlyph(win, 32, '#000000')));
    fs.writeFileSync(path.join(assets, 'tray.png'), toPng(await renderGlyph(win, 32, '#111318')));
    fs.writeFileSync(path.join(assets, 'trayActiveTemplate.png'), toPng(await renderGlyph(win, 16, '#000000', '#000000')));
    fs.writeFileSync(path.join(assets, 'trayActiveTemplate@2x.png'), toPng(await renderGlyph(win, 32, '#000000', '#000000')));
    fs.writeFileSync(path.join(assets, 'trayActive.png'), toPng(await renderGlyph(win, 32, '#111318', '#16a34a')));
    console.log('icons written');
    app.quit();
});
