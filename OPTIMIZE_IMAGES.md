# Guia: Otimizar Imagens para Mobile

## 📸 Imagens Atuais

As imagens estão muito pesadas para mobile:

```
coro-logo.png       653 KB
diocese-brasao.png  1,258 KB
TOTAL              1,911 KB
```

## 🛠️ Como Otimizar

### Opção 1: Usar Ferramenta Online (Gratuita)

1. Vá para https://tinypng.com
2. Faça upload de `coro-logo.png` e `diocese-brasao.png`
3. Baixe as versões comprimidas
4. Salve em `src/assets/`

**Resultado esperado**: 1,911 KB → ~200 KB (90% redução)

### Opção 2: Converter para WebP (Melhor Qualidade)

```bash
# Instalar ImageMagick (Windows)
# Baixar em: https://imagemagick.org/script/download.php

# Converter PNG para WebP
magick convert coro-logo.png -quality 80 coro-logo.webp
magick convert diocese-brasao.png -quality 80 diocese-brasao.webp
```

**Resultado esperado**: 1,911 KB → ~150 KB

### Opção 3: Usar Ferramenta CLI (Recomendado)

```bash
# Instalar
npm install -D sharp

# Usar script abaixo
```

**Script para otimizar** (`optimize-images.js`):
```javascript
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const assetsDir = './src/assets';

async function optimizeImages() {
  const files = fs.readdirSync(assetsDir).filter(f => f.endsWith('.png'));

  for (const file of files) {
    const filePath = path.join(assetsDir, file);
    const baseName = path.parse(file).name;

    // Otimizar PNG
    await sharp(filePath)
      .png({ quality: 80, progressive: true })
      .toFile(filePath);

    // Gerar WebP
    await sharp(filePath)
      .webp({ quality: 80 })
      .toFile(path.join(assetsDir, `${baseName}.webp`));

    const pngStats = fs.statSync(filePath);
    const webpStats = fs.statSync(path.join(assetsDir, `${baseName}.webp`));

    console.log(`
    ${file}:
    - PNG: ${(pngStats.size / 1024).toFixed(2)} KB
    - WebP: ${(webpStats.size / 1024).toFixed(2)} KB
    `);
  }
}

optimizeImages().catch(console.error);
```

**Executar:**
```bash
node optimize-images.js
```

## 📝 Próximo Passo: Usar WebP com Fallback

Após otimizar, atualize o código:

```typescript
import { LazyImage } from '@/components/LazyImage';

// Antes:
<img src={coroLogo} />

// Depois:
<picture>
  <source srcSet={coroLogoWebp} type="image/webp" />
  <LazyImage src={coroLogoPng} />
</picture>
```

## 🎯 Targets de Performance

| Métrica | Antes | Depois | Target |
|---------|-------|--------|--------|
| Total Bundle | 5.2 MB | 4.5 MB | 3.0 MB |
| Imagens | 1.9 MB | 0.2 MB | 0.2 MB |
| Initial Load | ~3s (3G) | ~2s (3G) | < 1.8s |
| Paint Time | ~1.2s | ~0.8s | < 0.8s |

## 📊 Impacto Esperado

**Com otimização de imagens:**
- Redução total: 1.7 MB (32%)
- Mobile 3G: -2.5s no First Contentful Paint
- Mobile 4G: -0.8s no First Contentful Paint
- Cache mais rápido em PWA

## ✅ Checklist

- [ ] Fazer backup das imagens atuais
- [ ] Otimizar PNGs com TinyPNG ou Sharp
- [ ] Gerar versões WebP
- [ ] Atualizar imports em componentes
- [ ] Testar em diferentes resoluções
- [ ] Medir nova performance com Lighthouse
- [ ] Atualizar Assets no Supabase se necessário

## 🔗 Recursos

- TinyPNG: https://tinypng.com
- Squoosh: https://squoosh.app (online, sem upload)
- Sharp: https://sharp.pixelplumbing.com/
- ImageMagick: https://imagemagick.org/

---

**Estimado: 30-60 minutos para otimizar**
