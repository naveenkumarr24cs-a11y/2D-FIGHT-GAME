/**
 * background.js – Static background loader and renderer.
 *
 * Loads a single composite background image (useX.png) per stage
 * and renders it statically to fill the canvas.
 */

function loadImage(src) {
  return new Promise((resolve) => {
    const img   = new Image();
    img.onload  = () => resolve(img);
    img.onerror = () => { console.warn(`[BG] Failed: ${src}`); resolve(null); };
    img.src     = src;
  });
}

export class Background {
  constructor(manifest) {
    this.manifest  = manifest;   // bg-manifest.json data
    this.bgKey     = null;
    this.flatImage = null;
  }

  /**
   * Load a background by its manifest key (e.g. "bg_1").
   * @param {string} key
   */
  async load(key) {
    const entry = this.manifest[key];
    if (!entry) {
      console.warn(`[BG] No manifest entry for "${key}"`);
      return;
    }

    this.bgKey = key;
    const base = `background/${key}`;

    // Load composite image (e.g. use1.png)
    this.flatImage = await loadImage(`${base}/${entry.flat}`);

    console.log(`[BG] Loaded "${key}": static background`);
  }

  /**
   * Update parallax scroll - disabled for static backgrounds.
   */
  update(p1x, p2x, canvasW) {
    // No-op for static backgrounds
  }

  /**
   * Render the background.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} canvasW
   * @param {number} canvasH
   */
  draw(ctx, canvasW, canvasH) {
    if (this.flatImage) {
      ctx.drawImage(this.flatImage, 0, 0, canvasW, canvasH);
    } else {
      // Dark fallback fill
      ctx.fillStyle = '#0d0d18';
      ctx.fillRect(0, 0, canvasW, canvasH);
    }
    
    this._drawFloorTiles(ctx, canvasW, canvasH, 628);
  }

  _drawFloorTiles(ctx, w, h, groundY) {
    ctx.save();
    
    const floorHeight = h - groundY;
    
    // Fading gradient to blend tiles into the background image
    const grad = ctx.createLinearGradient(0, groundY, 0, h);
    grad.addColorStop(0, 'rgba(0,0,0,0.85)');
    grad.addColorStop(0.15, 'rgba(10,15,30,0.5)');
    grad.addColorStop(1, 'rgba(15,25,45,0.1)');
    
    ctx.fillStyle = grad;
    ctx.fillRect(0, groundY, w, floorHeight);
    
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    
    // Horizontal perspective lines
    for (let i = 0; i <= 6; i++) {
      const y = groundY + Math.pow(i / 6, 1.8) * floorHeight;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    
    // Vertical perspective lines originating from vanishing point
    const vanishingY = groundY - 100;
    for (let i = -14; i <= 14; i++) {
      const xOrigin = w / 2 + i * 80;
      
      // Calculate intersection at groundY
      const dx = xOrigin - w/2;
      const dy = groundY - vanishingY;
      const slope = dx / dy;
      
      const xTop = w/2 + slope * (groundY - vanishingY);
      const xBottom = w/2 + slope * (h - vanishingY);
      
      ctx.beginPath();
      ctx.moveTo(xTop, groundY);
      ctx.lineTo(xBottom, h);
      ctx.stroke();
    }
    
    ctx.restore();
  }
}

